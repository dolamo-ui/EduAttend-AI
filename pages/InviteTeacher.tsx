// pages/InviteTeacher.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVE TO SCHOOL CODE REGISTRATION
//
// The principal fills in the teacher's details and clicks "Create Account".
// This page creates both the Firebase Auth account AND the Firestore user doc
// directly — no school code, no teacher self-registration needed.
//
// The teacher just receives their email + password from the principal and
// logs in immediately (status is 'active' from the start).
//
// Route: /invite-teacher  (principal only)
// Add to App.tsx: { path: '/invite-teacher', pageName: 'Invite Teacher', routeKey: 'invite-teacher', element: <InviteTeacher /> }
// Add to auth.ts ROUTE_PERMISSIONS: 'invite-teacher': ['PRINCIPAL']
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useNavigate }     from 'react-router-dom';

import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../src/firebase/firebaseConfig';
import { useAuth }  from '../src/context/AuthContext';

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = (focus: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 15px', borderRadius: 11,
  border: `1.5px solid ${focus ? '#6366f1' : '#e2e8f0'}`,
  background: '#fff', fontSize: 14, color: '#0f172a', outline: 'none',
  fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
  boxShadow: focus ? '0 0 0 3px rgba(99,102,241,.1)' : 'none',
});
const Label = ({ text }: { text: string }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>{text}</div>
);
const Spin = () => (
  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }}/>
);

interface CreatedTeacher {
  name: string; email: string; password: string; assignedClass: string;
}

export default function InviteTeacher(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();   // principal's info — gives us schoolId + schoolCode

  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [assignedClass, setAssignedClass] = useState('');
  const [password,      setPassword]      = useState('');
  const [showPass,      setShowPass]      = useState(false);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [focus,    setFocus]    = useState('');
  const [created,  setCreated]  = useState<CreatedTeacher | null>(null);
  const [copied,   setCopied]   = useState<'email'|'pass'|null>(null);

  const F = (k: string) => () => setFocus(k);
  const B = () => setFocus('');

  // Generate a random strong password
  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    const pwd   = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setPassword(pwd);
    setShowPass(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!name.trim())          { setError('Teacher name is required.');         return; }
    if (!email.trim())         { setError('Teacher email is required.');        return; }
    if (!assignedClass.trim()) { setError('Assigned class is required.');       return; }
    if (password.length < 8)   { setError('Password must be at least 8 chars.'); return; }

    setLoading(true);

    // We need the principal's email + password to re-authenticate after
    // creating the teacher account (creating another account signs you in as them).
    // We store these in sessionStorage for this operation only.
    const principalEmail    = user?.email ?? '';
    const principalPassword = sessionStorage.getItem('__pp') ?? '';

    if (!principalPassword) {
      setError('Session expired. Please log out and log back in, then try again.');
      setLoading(false);
      return;
    }

    try {
      // 1. Create teacher Firebase Auth account
      //    NOTE: this signs the browser into the teacher account temporarily
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid  = cred.user.uid;
      await updateProfile(cred.user, { displayName: name.trim() });

      // 2. Write teacher Firestore doc — status 'active' (no approval needed)
      await setDoc(doc(db, 'users', uid), {
        id:            uid,
        name:          name.trim(),
        email:         email.trim(),
        role:          'TEACHER',
        status:        'active',          // ← already approved
        schoolId:      user?.schoolId,
        schoolCode:    user?.schoolCode,
        assignedClass: assignedClass.trim(),
        createdAt:     serverTimestamp(),
        invitedBy:     user?.id,
      });

      // 3. Sign out of the teacher account
      await fbSignOut(auth);

      // 4. Sign the principal back in
      await signInWithEmailAndPassword(auth, principalEmail, principalPassword);

      // 5. Show success
      setCreated({ name: name.trim(), email: email.trim(), password, assignedClass: assignedClass.trim() });

      // Reset form
      setName(''); setEmail(''); setAssignedClass(''); setPassword('');

    } catch (err: any) {
      const code = err?.code ?? '';
      const msg  = String(err?.message ?? err);
      console.error('[InviteTeacher]', code, msg);

      // Sign back in as principal if something went wrong
      try { await fbSignOut(auth); } catch {}
      if (principalPassword) {
        try { await signInWithEmailAndPassword(auth, principalEmail, principalPassword); } catch {}
      }

      if (code === 'auth/email-already-in-use') setError('A teacher with this email already exists.');
      else if (code === 'auth/invalid-email')   setError('Invalid email address.');
      else if (code === 'auth/weak-password')   setError('Password too weak — use at least 8 characters.');
      else                                      setError(`Failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, key: 'email' | 'pass') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(null), 2500);
    });
  };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 720 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pop{0%{transform:scale(.85);opacity:0;}70%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;}}
        ::placeholder{color:#cbd5e1;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, animation: 'fadeUp .4s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#1e3a8a,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👩‍🏫</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>Add Teacher Directly</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0' }}>Create a teacher account without requiring a school code</p>
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 14, background: '#eef2ff', border: '1px solid #c7d2fe', fontSize: 13, color: '#3730a3', lineHeight: 1.8 }}>
          <strong>How this works:</strong> You fill in the teacher's details and set their password. Their account is created immediately as <strong>active</strong> — no approval needed. Share their email and password with them so they can log in.
        </div>
      </div>

      {/* Password re-entry notice */}
      <PrincipalPasswordPrompt principalEmail={user?.email ?? ''} />

      <div style={{ display: 'grid', gridTemplateColumns: created ? '1fr 1fr' : '1fr', gap: 20, animation: 'fadeUp .45s ease both .05s' }}>

        {/* ── FORM ── */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }}/>
          <form onSubmit={handleSubmit} style={{ padding: '28px 30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div><Label text="Teacher Full Name *"/>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Mr. John Smith" style={inp(focus==='name')} onFocus={F('name')} onBlur={B}/>
              </div>

              <div><Label text="Teacher Email *"/>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="john.smith@school.com" style={inp(focus==='email')} onFocus={F('email')} onBlur={B}/>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>The teacher will use this to log in.</div>
              </div>

              <div><Label text="Assigned Class *"/>
                <input value={assignedClass} onChange={e=>setAssignedClass(e.target.value)} placeholder="e.g. 10-A or Grade 8B" style={inp(focus==='class')} onFocus={F('class')} onBlur={B}/>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Label text="Temporary Password *"/>
                  <button type="button" onClick={genPassword}
                    style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '3px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                    🎲 Generate
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 8 characters" style={{ ...inp(focus==='pass'), paddingRight: 42 }} onFocus={F('pass')} onBlur={B}/>
                  <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:15, color:'#94a3b8' }}>{showPass?'🙈':'👁'}</button>
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Share this with the teacher. They can change it after logging in.</div>
              </div>

              {error && (
                <div style={{ padding:'10px 14px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', fontSize:13, color:'#dc2626', display:'flex', gap:8, fontFamily:"'DM Sans',sans-serif" }}>
                  <span>⚠️</span><span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:loading?'#e2e8f0':'linear-gradient(135deg,#6366f1,#8b5cf6)', color:loading?'#94a3b8':'#fff', fontSize:14, fontWeight:800, cursor:loading?'not-allowed':'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:loading?'none':'0 6px 20px rgba(99,102,241,.3)', marginTop:4 }}>
                {loading ? <><Spin/> Creating Account…</> : '✅ Create Teacher Account'}
              </button>
            </div>
          </form>
        </div>

        {/* ── SUCCESS CARD ── */}
        {created && (
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #bbf7d0', boxShadow: '0 4px 20px rgba(16,185,129,.1)', overflow: 'hidden', animation: 'fadeUp .4s ease both' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg,#059669,#10b981)' }}/>
            <div style={{ padding: '28px 30px' }}>
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 12, animation: 'pop .5s cubic-bezier(.34,1.56,.64,1) both' }}>🎉</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#065f46', textAlign: 'center', marginBottom: 4 }}>Account Created!</div>
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 22 }}>Share these login details with the teacher</div>

              {/* Credentials to share */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: '👤 Name',     val: created.name          },
                  { label: '📚 Class',    val: created.assignedClass },
                ].map(r => (
                  <div key={r.label} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#374151' }}>
                    <strong>{r.label}:</strong> {r.val}
                  </div>
                ))}

                {/* Email — copyable */}
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong style={{ color:'#065f46' }}>📧 Email:</strong> <span style={{ color:'#0f172a' }}>{created.email}</span></span>
                  <button onClick={() => copy(created.email, 'email')} style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#dcfce7', border: 'none', padding: '3px 10px', borderRadius: 7, cursor: 'pointer', flexShrink: 0, fontFamily:"'DM Sans',sans-serif" }}>
                    {copied === 'email' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {/* Password — copyable */}
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef9c3', border: '1px solid #fde68a', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong style={{ color:'#92400e' }}>🔑 Password:</strong> <span style={{ color:'#0f172a', fontFamily:'monospace', letterSpacing:'.05em' }}>{created.password}</span></span>
                  <button onClick={() => copy(created.password, 'pass')} style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: 'none', padding: '3px 10px', borderRadius: 7, cursor: 'pointer', flexShrink: 0, fontFamily:"'DM Sans',sans-serif" }}>
                    {copied === 'pass' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 11, color: '#dc2626', lineHeight: 1.7 }}>
                ⚠️ <strong>Save this password now.</strong> It won't be shown again. The teacher should change it after their first login.
              </div>

              <button onClick={() => setCreated(null)}
                style={{ width:'100%', marginTop:16, padding:'11px', borderRadius:11, border:'1.5px solid #e2e8f0', background:'#fff', color:'#6366f1', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                + Add Another Teacher
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ display:'flex', gap:10, marginTop:24, animation:'fadeUp .5s ease both .1s' }}>
        <button onClick={()=>navigate('/approvals')}
          style={{ padding:'10px 20px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          ← Approvals
        </button>
        <button onClick={()=>navigate('/dashboard')}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#1e3a8a,#1e40af)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          Dashboard →
        </button>
      </div>
    </div>
  );
}

// ─── Principal password prompt ────────────────────────────────────────────────
// We need the principal to re-enter their password once per session so we can
// re-sign them back in after temporarily signing in as the new teacher.

function PrincipalPasswordPrompt({ principalEmail }: { principalEmail: string }) {
  const [pass,    setPass]    = useState(() => sessionStorage.getItem('__pp') ?? '');
  const [saved,   setSaved]   = useState(() => !!sessionStorage.getItem('__pp'));
  const [visible, setVisible] = useState(false);

  const save = () => {
    if (pass.length < 6) return;
    sessionStorage.setItem('__pp', pass);
    setSaved(true);
  };

  if (saved) {
    return (
      <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif", animation: 'fadeUp .4s ease both' }}>
        ✅ Principal session saved. You can create teacher accounts.
        <button onClick={() => { sessionStorage.removeItem('__pp'); setSaved(false); setPass(''); }}
          style={{ marginLeft: 'auto', fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>
          Clear
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20, padding: '16px 18px', borderRadius: 14, background: '#fef9c3', border: '1px solid #fde68a', animation: 'fadeUp .4s ease both' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>
        🔐 Re-enter your principal password to continue
      </div>
      <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12, lineHeight: 1.6 }}>
        Creating a teacher account temporarily signs the browser into their account. We need your password to sign you back in automatically. This is stored only in your browser session and never sent anywhere.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type={visible ? 'text' : 'password'}
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="Your password"
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            style={{ width: '100%', padding: '10px 40px 10px 13px', borderRadius: 10, border: '1.5px solid #fde68a', background: '#fff', fontSize: 13, color: '#0f172a', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
          />
          <button type="button" onClick={() => setVisible(v => !v)} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8' }}>
            {visible ? '🙈' : '👁'}
          </button>
        </div>
        <button onClick={save} disabled={pass.length < 6}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: pass.length < 6 ? '#e2e8f0' : '#f59e0b', color: pass.length < 6 ? '#94a3b8' : '#fff', fontWeight: 700, fontSize: 13, cursor: pass.length < 6 ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
          Save
        </button>
      </div>
    </div>
  );
}