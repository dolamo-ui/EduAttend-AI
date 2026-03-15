// pages/Register.tsx
// Teacher self-registration with school code verification.
//
// KEY FIX: verifyCode() queries Firestore WITHOUT being signed in.
// This works because schools collection now has `allow read: if true`
// in the Firestore rules — school codes are intentionally public.

import React, { useState } from 'react';
import { useNavigate }     from 'react-router-dom';

import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';

import {
  doc, setDoc, collection,
  query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../src/firebase/firebaseConfig';

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = (focus: boolean, err = false): React.CSSProperties => ({
  width: '100%', padding: '12px 15px', borderRadius: 11,
  border: `1.5px solid ${err ? '#ef4444' : focus ? '#6366f1' : '#e2e8f0'}`,
  background: '#fff', fontSize: 14, color: '#0f172a', outline: 'none',
  fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
  boxShadow: focus ? '0 0 0 3px rgba(99,102,241,.1)' : 'none',
});

const Label = ({ text }: { text: string }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>
    {text}
  </div>
);

const ErrBox = ({ msg }: { msg: string }) => (
  <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626', display: 'flex', gap: 8, alignItems: 'flex-start', fontFamily: "'DM Sans',sans-serif" }}>
    <span style={{ flexShrink: 0 }}>⚠️</span><span>{msg}</span>
  </div>
);

const Spin = () => (
  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }}/>
);

// ─── Firebase error → readable message ───────────────────────────────────────
function firebaseMsg(err: unknown): string {
  const e    = err as any;
  const code = e?.code ?? '';
  const msg  = String(e?.message ?? err);
  console.error('[Register]', code, msg);        // always log real error
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try signing in.';
  if (code === 'auth/invalid-email')        return 'Invalid email address.';
  if (code === 'auth/weak-password')        return 'Password is too weak — use at least 8 characters.';
  if (code === 'permission-denied' || msg.includes('permission'))
    return 'Firestore permission denied. Make sure you published the latest firestore.rules in Firebase Console (schools collection must have `allow read: if true`).';
  if (code === 'unavailable' || msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Check your internet connection and try again.';
  return `Error: ${msg}`;
}

// ═══════════════════════════════════════════════════════════════════════════════

interface SchoolSnap { id: string; name: string; principalId: string; }

export default function Register(): React.ReactElement {
  const navigate = useNavigate();

  // Step 1 — school code
  const [codeInput,  setCodeInput]  = useState('');
  const [schoolSnap, setSchoolSnap] = useState<SchoolSnap | null>(null);
  const [verifying,  setVerifying]  = useState(false);
  const [codeErr,    setCodeErr]    = useState('');

  // Step 2 — personal details
  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [assignedClass, setAssignedClass] = useState('');
  const [password,      setPassword]      = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showPass,      setShowPass]      = useState(false);

  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [focus,   setFocus]   = useState('');

  const F = (k: string) => () => setFocus(k);
  const B = () => setFocus('');

  // ── Verify school code — runs WITHOUT being signed in ─────────────────────
  const verifyCode = async () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) { setCodeErr('Please enter your school code.'); return; }

    setVerifying(true); setCodeErr('');
    try {
      // This query works without auth because schools has `allow read: if true`
      const q    = query(collection(db, 'schools'), where('schoolCode', '==', trimmed));
      const snap = await getDocs(q);

      if (snap.empty) {
        setCodeErr(`School code "${trimmed}" not found. Double-check with your principal.`);
        setVerifying(false);
        return;
      }

      const d = snap.docs[0];
      setSchoolSnap({ id: d.id, name: d.data().name, principalId: d.data().principalId });
      setStep(2);
    } catch (err: any) {
      const code = err?.code ?? '';
      const msg  = String(err?.message ?? err);
      console.error('[Register verifyCode]', code, msg);

      if (code === 'permission-denied' || msg.includes('permission')) {
        setCodeErr(
          'Firestore permission denied. ' +
          'Fix: In Firebase Console → Firestore Database → Rules, ' +
          'make sure schools has `allow read: if true` and click Publish.',
        );
      } else if (code === 'unavailable' || msg.includes('network') || msg.includes('fetch')) {
        setCodeErr('Network error. Check your internet connection and try again.');
      } else {
        setCodeErr(`Verification failed: ${msg}`);
      }
    } finally {
      setVerifying(false);
    }
  };

  // ── Submit registration ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!name.trim())           { setError('Your name is required.');              return; }
    if (!email.trim())          { setError('Your email is required.');             return; }
    if (!assignedClass.trim())  { setError('Assigned class is required.');         return; }
    if (password.length < 8)    { setError('Password must be at least 8 chars.'); return; }
    if (password !== confirmPass) { setError('Passwords do not match.');           return; }

    setLoading(true);
    try {
      // 1. Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid  = cred.user.uid;
      await updateProfile(cred.user, { displayName: name.trim() });

      // 2. Write Firestore user doc with status: 'pending'
      await setDoc(doc(db, 'users', uid), {
        id:            uid,
        name:          name.trim(),
        email:         email.trim(),
        role:          'TEACHER',
        status:        'pending',
        schoolId:      schoolSnap!.id,
        schoolCode:    codeInput.trim().toUpperCase(),
        assignedClass: assignedClass.trim(),
        createdAt:     serverTimestamp(),
      });

      // 3. Sign out — they can't use the app until the principal approves
      await signOut(auth);

      setStep(3);
    } catch (err) {
      setError(firebaseMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f0fdf4,#f0f4ff,#fff8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: "'DM Sans',sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pop{0%{transform:scale(.85);opacity:0;}70%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;}}
        ::placeholder{color:#cbd5e1;}
      `}</style>

      {/* blobs */}
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,.07),transparent 70%)', top:-100, left:-100, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,.07),transparent 70%)', bottom:-100, right:-100, pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:520, animation:'fadeUp .45s ease both' }}>

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#059669,#10b981)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(16,185,129,.3)', fontSize:20 }}>👩‍🏫</div>
            <span style={{ fontSize:22, fontWeight:800, color:'#0f172a', letterSpacing:'-.02em' }}>EduAttend <span style={{ color:'#059669' }}>AI</span></span>
          </div>
          <h1 style={{ fontSize:26, fontWeight:800, color:'#0f172a', margin:'0 0 6px', letterSpacing:'-.02em' }}>
            {step === 3 ? '✅ Application Submitted' : 'Teacher Registration'}
          </h1>
          <p style={{ fontSize:13, color:'#64748b', margin:0 }}>
            {step === 1 && 'Enter your school code to get started'}
            {step === 2 && `Registering for ${schoolSnap?.name}`}
            {step === 3 && 'Your principal will review and approve your account'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 20px 60px rgba(0,0,0,.09)', overflow:'hidden' }}>
          <div style={{ height:4, background:'linear-gradient(90deg,#059669,#10b981,#34d399)' }}/>

          {/* ── STEP 1: School code ── */}
          {step === 1 && (
            <div style={{ padding:'32px 36px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                <div style={{ padding:'16px 18px', borderRadius:14, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#065f46', marginBottom:4 }}>📌 What is the school code?</div>
                  <div style={{ fontSize:12, color:'#047857', lineHeight:1.7 }}>
                    Your principal received a unique code when they set up the school on this platform. Ask them to share it with you.
                  </div>
                </div>

                <div>
                  <Label text="School Code *"/>
                  <input
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeErr(''); }}
                    placeholder="e.g. GREENWOOD2024"
                    style={{ ...inp(focus === 'code'), letterSpacing: '.06em', fontWeight: 700, fontSize: 16, textTransform: 'uppercase' }}
                    onFocus={F('code')} onBlur={B}
                    onKeyDown={e => { if (e.key === 'Enter') verifyCode(); }}
                  />
                  {codeErr && (
                    <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', lineHeight: 1.6 }}>
                      ⚠️ {codeErr}
                    </div>
                  )}
                </div>

                <button onClick={verifyCode} disabled={verifying}
                  style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:verifying?'#e2e8f0':'linear-gradient(135deg,#059669,#10b981)', color:verifying?'#94a3b8':'#fff', fontSize:14, fontWeight:800, cursor:verifying?'not-allowed':'pointer', boxShadow:verifying?'none':'0 6px 20px rgba(16,185,129,.3)', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {verifying ? <><Spin/> Verifying…</> : 'Verify School Code →'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Personal details ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ padding:'32px 36px' }}>

              {/* School confirmed banner */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12, background:'#f0fdf4', border:'1px solid #bbf7d0', marginBottom:22 }}>
                <span style={{ fontSize:20 }}>🏫</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#065f46' }}>School Verified</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>{schoolSnap?.name}</div>
                </div>
                <div style={{ fontSize:10, fontWeight:800, color:'#059669', background:'#dcfce7', padding:'3px 10px', borderRadius:999 }}>✓ VALID</div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div><Label text="Full Name *"/>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Mr. John Smith" style={inp(focus==='name')} onFocus={F('name')} onBlur={B}/>
                </div>
                <div><Label text="Email Address *"/>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="john.smith@school.com" style={inp(focus==='email')} onFocus={F('email')} onBlur={B}/>
                </div>
                <div><Label text="Assigned Class *"/>
                  <input value={assignedClass} onChange={e=>setAssignedClass(e.target.value)} placeholder="e.g. 10-A" style={inp(focus==='class')} onFocus={F('class')} onBlur={B}/>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>The class you will be responsible for.</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><Label text="Password *"/>
                    <div style={{ position:'relative' }}>
                      <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 8 characters" style={{ ...inp(focus==='pass'), paddingRight:42 }} onFocus={F('pass')} onBlur={B}/>
                      <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:15, color:'#94a3b8' }}>{showPass?'🙈':'👁'}</button>
                    </div>
                  </div>
                  <div><Label text="Confirm Password *"/>
                    <input type={showPass?'text':'password'} value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="Repeat password" style={inp(focus==='cpass', !!(confirmPass && confirmPass!==password))} onFocus={F('cpass')} onBlur={B}/>
                  </div>
                </div>

                <div style={{ padding:'13px 16px', borderRadius:12, background:'#fef9c3', border:'1px solid #fde68a', fontSize:12, color:'#92400e', lineHeight:1.7 }}>
                  <strong>⏳ Approval required:</strong> After submitting, the principal of <em>{schoolSnap?.name}</em> must approve your account before you can log in.
                </div>

                {error && <ErrBox msg={error}/>}

                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" onClick={()=>{setStep(1);setError('');}}
                    style={{ flex:1, padding:'12px', borderRadius:11, border:'1.5px solid #e2e8f0', background:'#fff', color:'#64748b', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    ← Back
                  </button>
                  <button type="submit" disabled={loading}
                    style={{ flex:2, padding:'12px', borderRadius:11, border:'none', background:loading?'#e2e8f0':'linear-gradient(135deg,#059669,#10b981)', color:loading?'#94a3b8':'#fff', fontSize:13, fontWeight:800, cursor:loading?'not-allowed':'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:loading?'none':'0 6px 20px rgba(16,185,129,.3)' }}>
                    {loading ? <><Spin/> Submitting…</> : '📤 Submit Application'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div style={{ padding:'36px', textAlign:'center', animation:'fadeUp .4s ease both' }}>
              <div style={{ fontSize:72, marginBottom:16, animation:'pop .5s cubic-bezier(.34,1.56,.64,1) both' }}>📬</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#0f172a', marginBottom:12 }}>Application Received!</div>
              <p style={{ fontSize:13, color:'#64748b', lineHeight:1.8, marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
                Your application has been sent to the principal of <strong>{schoolSnap?.name}</strong>.<br/><br/>
                Once approved, you can log in with your email and password.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:280, margin:'0 auto 28px' }}>
                {[
                  { label: '📧 Email',   val: email },
                  { label: '🏫 School',  val: schoolSnap?.name ?? '' },
                  { label: '📚 Class',   val: assignedClass },
                ].map(r => (
                  <div key={r.label} style={{ padding:'11px 16px', borderRadius:12, background:'#f8fafc', border:'1px solid #e2e8f0', fontSize:12, color:'#64748b', textAlign:'left' }}>
                    <strong style={{ color:'#374151' }}>{r.label}:</strong> {r.val}
                  </div>
                ))}
              </div>
              <button onClick={()=>navigate('/login')}
                style={{ width:'100%', maxWidth:280, padding:'13px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 6px 20px rgba(99,102,241,.3)' }}>
                Back to Login
              </button>
            </div>
          )}
        </div>

        {step !== 3 && (
          <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#94a3b8' }}>
            Already registered?{' '}
            <button onClick={()=>navigate('/login')} style={{ background:'none', border:'none', color:'#059669', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
              Sign In
            </button>
          </p>
        )}
      </div>
    </div>
  );
}