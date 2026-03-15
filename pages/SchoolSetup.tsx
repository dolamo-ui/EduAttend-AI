// pages/SchoolSetup.tsx
// Uses setupSchool() from AuthContext which handles the entire
// create-account + write-Firestore flow atomically while signed in.

import React, { useState } from 'react';
import { useNavigate }     from 'react-router-dom';
import { useAuth }         from '../src/context/AuthContext';

const inp = (focused: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px 16px', borderRadius: 12,
  border: `1.5px solid ${focused ? '#6366f1' : '#e2e8f0'}`,
  background: '#fff', fontSize: 14, color: '#0f172a', outline: 'none',
  fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
  boxShadow: focused ? '0 0 0 3px rgba(99,102,241,.1)' : 'none',
});

const Label = ({ text }: { text: string }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>
    {text}
  </div>
);

const Err = ({ msg }: { msg: string }) => (
  <div style={{ padding: '11px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626', display: 'flex', gap: 8, alignItems: 'flex-start', fontFamily: "'DM Sans',sans-serif" }}>
    <span style={{ flexShrink: 0 }}>⚠️</span><span>{msg}</span>
  </div>
);

const Spin = () => (
  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }}/>
);

const Dot = ({ n, active, done }: { n: number; active: boolean; done: boolean }) => (
  <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: "'DM Sans',sans-serif", background: done ? '#10b981' : active ? '#6366f1' : '#e2e8f0', color: done || active ? '#fff' : '#94a3b8', transition: 'all .3s' }}>
    {done ? '✓' : n}
  </div>
);

export default function SchoolSetup(): React.ReactElement {
  const navigate    = useNavigate();
  const { setupSchool } = useAuth();

  // Step 1 fields
  const [schoolName,    setSchoolName]    = useState('');
  const [schoolEmail,   setSchoolEmail]   = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolContact, setSchoolContact] = useState('');

  // Step 2 fields
  const [principalName,  setPrincipalName]  = useState('');
  const [principalEmail, setPrincipalEmail] = useState('');
  const [password,       setPassword]       = useState('');
  const [confirmPass,    setConfirmPass]    = useState('');
  const [showPass,       setShowPass]       = useState(false);

  const [step,      setStep]      = useState<1 | 2 | 3>(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [focus,     setFocus]     = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [copied,     setCopied]     = useState(false);

  const F = (k: string) => () => setFocus(k);
  const B = () => setFocus('');

  // ── Step 1 validation ─────────────────────────────────────────────────────
  const next = () => {
    if (!schoolName.trim())  { setError('School name is required.');  return; }
    if (!schoolEmail.trim()) { setError('School email is required.'); return; }
    setError(''); setStep(2);
  };

  // ── Step 2 submit — delegates everything to AuthContext ──────────────────
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!principalName.trim())   { setError('Your name is required.');              return; }
    if (!principalEmail.trim())  { setError('Your email is required.');             return; }
    if (password.length < 8)     { setError('Password must be at least 8 chars.'); return; }
    if (password !== confirmPass) { setError('Passwords do not match.');            return; }

    setLoading(true);
    const result = await setupSchool({
      schoolName, schoolEmail, schoolAddress, schoolContact,
      principalName, principalEmail, password,
    });
    setLoading(false);

    if (result.success && result.schoolCode) {
      setSchoolCode(result.schoolCode);
      setStep(3);
    } else {
      setError(result.error ?? 'Setup failed. Please try again.');
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(schoolCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f0f4ff,#faf5ff,#fff8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: "'DM Sans',sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pop{0%{transform:scale(.85);opacity:0;}70%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;}}
        ::placeholder{color:#cbd5e1;}
      `}</style>

      {/* blobs */}
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,.07),transparent 70%)', top:-150, right:-150, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,158,11,.07),transparent 70%)', bottom:-100, left:-100, pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:560, animation:'fadeUp .45s ease both' }}>

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(99,102,241,.35)', fontSize:20 }}>🏫</div>
            <span style={{ fontSize:22, fontWeight:800, color:'#0f172a', letterSpacing:'-.02em' }}>EduAttend <span style={{ color:'#6366f1' }}>AI</span></span>
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#0f172a', margin:'0 0 6px', letterSpacing:'-.03em' }}>
            {step === 3 ? '🎉 Setup Complete!' : 'Set Up Your School'}
          </h1>
          <p style={{ fontSize:14, color:'#64748b', margin:0 }}>
            {step === 1 && 'Step 1 of 2 — School information'}
            {step === 2 && 'Step 2 of 2 — Principal account'}
            {step === 3 && 'Share the code with your teachers.'}
          </p>
        </div>

        {/* Step dots */}
        {step !== 3 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28 }}>
            <Dot n={1} active={step===1} done={step>1}/>
            <div style={{ width:80, height:2, background:step>1?'#6366f1':'#e2e8f0', margin:'0 8px', transition:'background .3s' }}/>
            <Dot n={2} active={step===2} done={step>2}/>
          </div>
        )}

        {/* Card */}
        <div style={{ background:'#fff', borderRadius:24, boxShadow:'0 20px 60px rgba(0,0,0,.09)', overflow:'hidden' }}>
          <div style={{ height:4, background:'linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)' }}/>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={{ padding:'32px 36px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div><Label text="School Name *"/>
                  <input value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder="e.g. Greenwood High School" style={inp(focus==='sn')} onFocus={F('sn')} onBlur={B}/>
                </div>
                <div><Label text="School Email *"/>
                  <input type="email" value={schoolEmail} onChange={e=>setSchoolEmail(e.target.value)} placeholder="admin@school.com" style={inp(focus==='se')} onFocus={F('se')} onBlur={B}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div><Label text="Address"/>
                    <input value={schoolAddress} onChange={e=>setSchoolAddress(e.target.value)} placeholder="123 Main Street" style={inp(focus==='sa')} onFocus={F('sa')} onBlur={B}/>
                  </div>
                  <div><Label text="Contact Number"/>
                    <input value={schoolContact} onChange={e=>setSchoolContact(e.target.value)} placeholder="+27 11 123 4567" style={inp(focus==='sc')} onFocus={F('sc')} onBlur={B}/>
                  </div>
                </div>
                {error && <Err msg={error}/>}
                <button onClick={next} style={{ width:'100%', padding:'14px', borderRadius:13, border:'none', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(99,102,241,.35)', fontFamily:"'DM Sans',sans-serif" }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <form onSubmit={submit} style={{ padding:'32px 36px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div><Label text="Your Full Name *"/>
                  <input value={principalName} onChange={e=>setPrincipalName(e.target.value)} placeholder="Dr. Sarah Johnson" style={inp(focus==='pn')} onFocus={F('pn')} onBlur={B}/>
                </div>
                <div><Label text="Your Email Address *"/>
                  <input type="email" value={principalEmail} onChange={e=>setPrincipalEmail(e.target.value)} placeholder="principal@school.com" style={inp(focus==='pe')} onFocus={F('pe')} onBlur={B}/>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>This will be your login email.</div>
                </div>
                <div><Label text="Password * (min 8 characters)"/>
                  <div style={{ position:'relative' }}>
                    <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ ...inp(focus==='pw'), paddingRight:44 }} onFocus={F('pw')} onBlur={B}/>
                    <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#94a3b8' }}>{showPass?'🙈':'👁'}</button>
                  </div>
                </div>
                <div><Label text="Confirm Password *"/>
                  <input type={showPass?'text':'password'} value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="••••••••"
                    style={{ ...inp(focus==='cp'), borderColor: confirmPass&&confirmPass!==password?'#ef4444':focus==='cp'?'#6366f1':'#e2e8f0' }}
                    onFocus={F('cp')} onBlur={B}/>
                  {confirmPass && confirmPass!==password && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>Passwords do not match.</div>}
                </div>

                {/* Firebase checklist */}
                <div style={{ padding:'14px 16px', borderRadius:12, background:'#f8fafc', border:'1px solid #e2e8f0', fontSize:12, color:'#64748b', lineHeight:1.9 }}>
                  <div style={{ fontWeight:700, color:'#374151', marginBottom:4 }}>📋 Firebase Console checklist:</div>
                  <div>✅ Authentication → Sign-in method → <strong>Email/Password</strong> enabled</div>
                  <div>✅ Firestore Database created in <strong>test mode</strong></div>
                  <div>✅ Latest <strong>firestore.rules</strong> published</div>
                </div>

                {error && <Err msg={error}/>}

                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" onClick={()=>{setStep(1);setError('');}} style={{ flex:1, padding:'13px', borderRadius:12, border:'1.5px solid #e2e8f0', background:'#fff', color:'#64748b', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
                  <button type="submit" disabled={loading} style={{ flex:2, padding:'13px', borderRadius:12, border:'none', background:loading?'#e2e8f0':'linear-gradient(135deg,#6366f1,#8b5cf6)', color:loading?'#94a3b8':'#fff', fontSize:14, fontWeight:800, cursor:loading?'not-allowed':'pointer', boxShadow:loading?'none':'0 6px 20px rgba(99,102,241,.35)', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    {loading ? <><Spin/> Creating School…</> : '🏫 Create School & Account'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div style={{ padding:'36px', textAlign:'center', animation:'fadeUp .4s ease both' }}>
              <div style={{ fontSize:72, marginBottom:16, animation:'pop .5s cubic-bezier(.34,1.56,.64,1) both' }}>🎉</div>
              <p style={{ fontSize:14, color:'#64748b', lineHeight:1.8, marginBottom:28 }}>
                <strong style={{ color:'#0f172a' }}>{schoolName}</strong> is live!<br/>
                Share this code with your teachers:
              </p>
              <div style={{ background:'linear-gradient(135deg,#eef2ff,#f0fdf4)', border:'2px dashed #a5b4fc', borderRadius:18, padding:'24px 28px', marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>School Code</div>
                <div style={{ fontSize:36, fontWeight:900, color:'#1e1b4b', letterSpacing:'.08em', fontFamily:"'DM Sans',sans-serif", marginBottom:14 }}>{schoolCode}</div>
                <button onClick={copy} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:copied?'#10b981':'#6366f1', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'background .2s' }}>
                  {copied ? '✓ Copied!' : '📋 Copy Code'}
                </button>
              </div>
              <div style={{ background:'#fef9c3', border:'1px solid #fde68a', borderRadius:12, padding:'14px 18px', marginBottom:28, textAlign:'left' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:4 }}>📌 Keep this safe</div>
                <div style={{ fontSize:12, color:'#78350f', lineHeight:1.7 }}>Teachers enter this code when registering. You must approve them in <strong>Staff Approvals</strong> before they can log in.</div>
              </div>
              <button onClick={()=>navigate('/dashboard')} style={{ width:'100%', padding:'14px', borderRadius:13, border:'none', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(99,102,241,.35)', fontFamily:"'DM Sans',sans-serif" }}>
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>

        {step !== 3 && (
          <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#94a3b8' }}>
            Already set up?{' '}
            <button onClick={()=>navigate('/login')} style={{ background:'none', border:'none', color:'#6366f1', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>Sign In</button>
          </p>
        )}
      </div>
    </div>
  );
}