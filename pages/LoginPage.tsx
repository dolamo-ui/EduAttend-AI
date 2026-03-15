// pages/LoginPage.tsx
// Fully responsive: mobile (< 640px) · tablet (640–1023px) · desktop (1024px+)
// Updated: added "Parent Registration" button in RoleChooser footer
//          added "Register as parent" link on ParentLogin form

import React, { useState, useEffect } from 'react';
import { useNavigate }                from 'react-router-dom';
import { useAuth, StudentMatch }      from '../src/context/AuthContext';
import { AuthUser }                   from '../src/types/auth';

type StaffRole = 'principal' | 'teacher';
type Screen    = 'choose' | 'parent' | 'staff';

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
}

const GLOBAL = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Poppins', sans-serif; }
  input, button, textarea, select { font-family: 'Poppins', sans-serif; }
  @keyframes fadeIn  { from { opacity:0; transform:translateY(12px);  } to { opacity:1; transform:translateY(0);  } }
  @keyframes slideUp { from { opacity:0; transform:translateY(100%);  } to { opacity:1; transform:translateY(0);  } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  ::placeholder { color: rgba(255,255,255,0.35); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 99px; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Child Picker
// ═══════════════════════════════════════════════════════════════════════════════
function ChildPicker({ students, pendingUser, onConfirm, onBack }: {
  students: StudentMatch[]; pendingUser: AuthUser;
  onConfirm: (u: AuthUser, s: StudentMatch) => void; onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div style={{ padding: '24px 20px 28px', animation: 'fadeIn .3s ease both' }}>
      <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,.65)', fontWeight:500, marginBottom:16, display:'flex', alignItems:'center', gap:5, padding:0 }}>← Back</button>
      <h3 style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:4 }}>Select Your Child</h3>
      <p style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:14 }}>{students.length} students found in class <strong>{students[0]?.class_name}</strong></p>
      <input type="text" placeholder="Search by name or roll number…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus
        style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'#fff', fontSize:13, outline:'none', marginBottom:10 }}/>
      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' }}>
        {filtered.length === 0
          ? <p style={{ color:'rgba(255,255,255,.35)', fontSize:13, textAlign:'center', padding:'16px 0' }}>No match for "{search}"</p>
          : filtered.map(s => (
            <button key={s.id} onClick={() => onConfirm(pendingUser, s)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 13px', borderRadius:12, border:'1.5px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.08)', cursor:'pointer', textAlign:'left', transition:'background .15s', width:'100%' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,.16)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.08)'; }}>
              <div style={{ width:36, height:36, borderRadius:9, background:'#f59e0b', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, color:'#fff', flexShrink:0 }}>{s.name[0].toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', marginTop:1 }}>Class {s.class_name} · Roll {s.roll_no}</div>
              </div>
              <span style={{ color:'#f59e0b', fontSize:18, flexShrink:0 }}>›</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — Role Chooser
// ═══════════════════════════════════════════════════════════════════════════════
const ROLES = [
  { key:'principal' as const, label:'Principal', desc:'Full school management, analytics & AI risk alerts', img:'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=500&q=80', accent:'#4f46e5', badge:'Admin'    },
  { key:'teacher'   as const, label:'Teacher',   desc:'Manage your class, mark attendance & view trends',  img:'https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&q=80', accent:'#059669', badge:'Staff'    },
  { key:'parent'    as const, label:'Parent',    desc:"Track your child's attendance and receive alerts",  img:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&q=80', accent:'#d97706', badge:'Guardian' },
];

function RoleChooser({ onSelect }: { onSelect: (r: 'principal'|'teacher'|'parent') => void }) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const [hov, setHov] = useState<string|null>(null);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#f8fafc 0%,#eef2ff 50%,#f0fdf4 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: isMobile ? '28px 16px' : '48px 24px', fontFamily:"'Poppins',sans-serif" }}>
      <style>{GLOBAL}</style>

      {/* Brand */}
      <div style={{ textAlign:'center', marginBottom: isMobile ? 28 : 44, animation:'fadeIn .4s ease both' }}>
        <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:54, height:54, borderRadius:15, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow:'0 8px 24px rgba(99,102,241,.35)', marginBottom:14, fontSize:26 }}>🏫</div>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight:800, color:'#0f172a', letterSpacing:'-0.03em', lineHeight:1.2, margin:'0 0 8px' }}>
          Welcome to <span style={{ color:'#4f46e5' }}>EduAttend AI</span>
        </h1>
        <p style={{ fontSize: isMobile ? 13 : 15, color:'#64748b', fontWeight:400 }}>Select your role to sign in.</p>
      </div>

      {/* Role cards */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
        gap: isMobile ? 12 : 20,
        maxWidth: isMobile ? 420 : 860,
        width:'100%',
      }}>
        {ROLES.map((role, idx) => {
          const isH = hov === role.key;
          return (
            <button key={role.key} onClick={() => onSelect(role.key)}
              onMouseEnter={() => setHov(role.key)} onMouseLeave={() => setHov(null)}
              style={{
                background:'#fff', border:`2px solid ${isH ? role.accent : '#e8ecf4'}`,
                borderRadius: isMobile ? 14 : 20, overflow:'hidden', cursor:'pointer',
                textAlign:'left', padding:0,
                boxShadow: isH ? '0 12px 36px rgba(0,0,0,.11)' : '0 2px 10px rgba(0,0,0,.05)',
                transform: isH && !isMobile ? 'translateY(-3px)' : 'none',
                transition:'border-color .2s, box-shadow .2s, transform .18s',
                animation: `fadeIn .4s ease ${idx*.08}s both`,
                display: isMobile ? 'flex' : 'block',
                alignItems: isMobile ? 'center' : undefined,
              }}>
              {/* Photo */}
              <div style={{ height: isMobile ? 80 : 165, width: isMobile ? 80 : '100%', flexShrink:0, overflow:'hidden', position:'relative', borderRadius: isMobile ? '12px 0 0 12px' : undefined }}>
                <img src={role.img} alt={role.label} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', display:'block', transition:'transform .35s', transform: isH ? 'scale(1.06)' : 'scale(1)' }}/>
                {!isMobile && <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.25) 100%)' }}/>}
                <span style={{ position:'absolute', top:8, right:8, background:role.accent, color:'#fff', fontSize:9, fontWeight:700, letterSpacing:'.07em', padding:'2px 8px', borderRadius:999, textTransform:'uppercase' }}>{role.badge}</span>
              </div>
              {/* Text */}
              <div style={{ padding: isMobile ? '12px 14px' : '16px 18px 18px', flex: isMobile ? 1 : undefined }}>
                <div style={{ fontSize: isMobile ? 14 : 16, fontWeight:700, color:'#0f172a', marginBottom: isMobile ? 2 : 4 }}>{role.label}</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color:'#64748b', lineHeight:1.5, display: isMobile ? 'none' : 'block' }}>{role.desc}</div>
                <div style={{ marginTop: isMobile ? 4 : 12, fontSize:12, fontWeight:600, color:role.accent, display:'flex', alignItems:'center', gap:4 }}>
                  Sign in <span>→</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Footer links — UPDATED with Parent Registration ── */}
      <div style={{ marginTop: isMobile ? 24 : 38, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
        <div style={{ display:'flex', gap: isMobile ? 10 : 18, flexWrap:'wrap', justifyContent:'center' }}>
          {/* NEW: Parent registration */}
          <button
            onClick={() => navigate('/parent-register')}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#d97706', fontWeight:600, fontFamily:"'Poppins',sans-serif", textDecoration:'underline' }}
          >
            👨‍👩‍👧 Parent Registration
          </button>
          <button onClick={() => navigate('/register')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#6366f1', fontWeight:600, fontFamily:"'Poppins',sans-serif", textDecoration:'underline' }}>👩‍🏫 Teacher Registration</button>
          <button onClick={() => navigate('/setup')}    style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#059669', fontWeight:600, fontFamily:"'Poppins',sans-serif", textDecoration:'underline' }}>🏫 New School Setup</button>
        </div>
        <p style={{ fontSize:11, color:'#94a3b8' }}>© {new Date().getFullYear()} EduAttend AI · School Attendance Management</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — Parent Login
// ═══════════════════════════════════════════════════════════════════════════════
const PARENT_SLIDES = [
  { url:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=85', caption:"See your child's progress" },
  { url:'https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=85', caption:'Get instant absence alerts'  },
  { url:'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=85', caption:'Stay connected with school'   },
];

function ParentLogin({ onBack }: { onBack: () => void }) {
  const { login, confirmChild } = useAuth();
  const navigate                = useNavigate();
  const { isMobile, isTablet }  = useBreakpoint();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [childClass, setChildClass] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [slide,      setSlide]      = useState(0);
  const [pickerStudents, setPickerStudents] = useState<StudentMatch[]|null>(null);
  const [pickerPending,  setPickerPending]  = useState<AuthUser|null>(null);

  useEffect(() => {
    const iv = setInterval(() => setSlide(s => (s + 1) % PARENT_SLIDES.length), 4500);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const result = await login(email, password, childClass);
    setLoading(false);
    if (result.studentsInClass && result.pendingUser) {
      setPickerStudents(result.studentsInClass);
      setPickerPending(result.pendingUser);
    } else if (!result.success && result.error) {
      setError(result.error);
    }
  };

  if (pickerStudents && pickerPending) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#0d9488,#065f46)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, fontFamily:"'Poppins',sans-serif" }}>
        <style>{GLOBAL}</style>
        <div style={{ width:'100%', maxWidth:440, background:'rgba(255,255,255,.07)', borderRadius:22, border:'1px solid rgba(255,255,255,.14)', backdropFilter:'blur(12px)' }}>
          <ChildPicker students={pickerStudents} pendingUser={pickerPending}
            onConfirm={(u,s)=>confirmChild(u,s)}
            onBack={()=>{ setPickerStudents(null); setPickerPending(null); }}/>
        </div>
      </div>
    );
  }

  const inp: React.CSSProperties = { width:'100%', padding:'13px 16px', borderRadius:12, border:'1.5px solid transparent', background:'rgba(255,255,255,.13)', fontSize:14, color:'#fff', outline:'none', fontWeight:400, transition:'border-color .18s' };
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor='rgba(255,255,255,.45)'; };
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor='transparent'; };

  const slideDots = (
    <div style={{ display:'flex', justifyContent:'center', gap:7, marginTop:14 }}>
      {PARENT_SLIDES.map((_,i)=><button key={i} onClick={()=>setSlide(i)} style={{ width:i===slide?24:7, height:7, borderRadius:999, background:i===slide?'#f59e0b':'rgba(255,255,255,.35)', border:'none', cursor:'pointer', padding:0, transition:'width .25s, background .25s' }}/>)}
    </div>
  );

  const formContent = (
    <>
      {error && <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, background:'rgba(239,68,68,.18)', border:'1px solid rgba(239,68,68,.35)', fontSize:13, color:'#fca5a5' }}>⚠️ {error}</div>}
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email address" required autoComplete="email" style={inp} onFocus={focus} onBlur={blur}/>
        <div style={{ position:'relative' }}>
          <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required style={{ ...inp, padding:'13px 44px 13px 16px' }} onFocus={focus} onBlur={blur}/>
          <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.5)', fontSize:15 }}>{showPass?'🙈':'👁'}</button>
        </div>
        <input type="text" value={childClass} onChange={e=>setChildClass(e.target.value)} placeholder="Child's Class (e.g. 10-A)" required style={inp} onFocus={focus} onBlur={blur}/>
        <button type="submit" disabled={loading}
          style={{ width:'100%', padding:'14px', borderRadius:13, border:'none', background:'#f59e0b', color:'#0f172a', fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 4px 18px rgba(245,158,11,.32)', opacity:loading ? .75 : 1, marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {loading ? <><span style={{ display:'inline-block', width:14, height:14, borderRadius:999, border:'2px solid rgba(0,0,0,.15)', borderTopColor:'#0f172a', animation:'spin .7s linear infinite' }}/> Signing in…</> : 'Sign In'}
        </button>
      </form>

      {/* ── UPDATED: Register link ── */}
      <div style={{ marginTop:16, textAlign:'center' }}>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>Don't have an account? </span>
        <button
          type="button"
          onClick={() => navigate('/parent-register')}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#f59e0b', fontWeight:700, fontSize:12, padding:0, textDecoration:'underline' }}
        >
          Register as a parent
        </button>
      </div>
    </>
  );

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(165deg,#0d9488,#0e7a6e,#065f46)', fontFamily:"'Poppins',sans-serif", position:'relative', overflowX:'hidden' }}>
        <style>{GLOBAL}</style>
        {PARENT_SLIDES.map((s,i)=>(
          <img key={i} src={s.url} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity: i===slide ? .12 : 0, transition:'opacity .8s', pointerEvents:'none' }}/>
        ))}
        <div style={{ position:'absolute', inset:0, background:'rgba(6,95,70,.55)', pointerEvents:'none' }}/>
        <button onClick={onBack} style={{ position:'absolute', top:16, left:16, zIndex:20, background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:10, padding:'8px 14px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>← Back</button>
        <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', minHeight:'100vh', padding:'72px 20px 36px' }}>
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:52, height:52, borderRadius:14, background:'rgba(255,255,255,.15)', marginBottom:12, fontSize:24 }}>🏫</div>
            <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>Parents Portal</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>{PARENT_SLIDES[slide].caption}</p>
            {slideDots}
          </div>
          <div style={{ background:'rgba(255,255,255,.1)', backdropFilter:'blur(20px)', borderRadius:20, border:'1px solid rgba(255,255,255,.15)', padding:'22px 18px', animation:'slideUp .4s ease both' }}>
            {formContent}
          </div>
        </div>
      </div>
    );
  }

  // ── TABLET ────────────────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Poppins',sans-serif" }}>
        <style>{GLOBAL}</style>
        <div style={{ height:200, position:'relative', overflow:'hidden', flexShrink:0 }}>
          {PARENT_SLIDES.map((s,i)=>(
            <img key={i} src={s.url} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 35%', opacity:i===slide?1:0, transition:'opacity .8s' }}/>
          ))}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(13,148,136,.35), rgba(6,95,70,.9))' }}/>
          <button onClick={onBack} style={{ position:'absolute', top:16, left:16, background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:10, padding:'8px 14px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', zIndex:5 }}>← Back</button>
          <div style={{ position:'absolute', bottom:16, left:0, right:0, textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:4 }}>Parents Portal</div>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.65)' }}>{PARENT_SLIDES[slide].caption}</p>
            {slideDots}
          </div>
        </div>
        <div style={{ flex:1, display:'flex', justifyContent:'center', background:'linear-gradient(180deg,#065f46,#0d9488)', padding:'28px 24px 40px' }}>
          <div style={{ width:'100%', maxWidth:480, background:'rgba(255,255,255,.1)', backdropFilter:'blur(20px)', borderRadius:22, border:'1px solid rgba(255,255,255,.15)', padding:'26px 28px' }}>
            {formContent}
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'Poppins',sans-serif" }}>
      <style>{GLOBAL}</style>
      {/* LEFT */}
      <div style={{ width:'45%', minHeight:'100vh', background:'linear-gradient(165deg,#0d9488 0%,#0e7a6e 55%,#065f46 100%)', display:'flex', flexDirection:'column', padding:'32px 44px 28px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:340, height:340, borderRadius:'50%', background:'rgba(255,255,255,.04)', top:-120, left:-120, pointerEvents:'none' }}/>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:52, position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:14, height:14, borderRadius:4, background:'#f59e0b' }}/>
            <div style={{ width:4, height:14, borderRadius:2, background:'rgba(255,255,255,.45)' }}/>
          </div>
          <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,.6)', fontWeight:400, textDecoration:'underline' }}>Back to home</button>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:1, animation:'fadeIn .4s ease both' }}>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#fff', marginBottom:6, letterSpacing:'-0.02em' }}>Parents Portal</h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,.55)', marginBottom:28, fontWeight:400 }}>Sign in to track your child's attendance</p>
          {formContent}
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,.2)', position:'relative', zIndex:1 }}>© {new Date().getFullYear()} EduAttend AI</p>
      </div>
      {/* RIGHT photo */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {PARENT_SLIDES.map((s,i)=>(
          <img key={i} src={s.url} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:i===slide?1:0, transition:'opacity .8s ease' }}/>
        ))}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.55) 100%)' }}/>
        <div style={{ position:'absolute', bottom:32, left:0, right:0, textAlign:'center', zIndex:2 }}>
          <p style={{ fontSize:20, fontWeight:700, color:'#fff', marginBottom:14, textShadow:'0 2px 6px rgba(0,0,0,.35)' }}>{PARENT_SLIDES[slide].caption}</p>
          <div style={{ display:'flex', justifyContent:'center', gap:7 }}>
            {PARENT_SLIDES.map((_,i)=><button key={i} onClick={()=>setSlide(i)} style={{ width:i===slide?24:7, height:7, borderRadius:999, background:i===slide?'#f59e0b':'rgba(255,255,255,.35)', border:'none', cursor:'pointer', padding:0, transition:'width .25s, background .25s' }}/>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — Staff Login
// ═══════════════════════════════════════════════════════════════════════════════
function StaffLogin({ defaultRole, onBack }: { defaultRole: StaffRole; onBack: () => void }) {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();

  const [activeTab, setActiveTab] = useState<StaffRole>(defaultRole);
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showPass,  setShowPass]  = useState(false);

  const switchTab = (role: StaffRole) => { setActiveTab(role); setEmail(''); setPassword(''); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const result = await login(email, password, undefined);
    setLoading(false);
    if (!result.success && result.error) setError(result.error);
  };

  const cardInp: React.CSSProperties = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontSize:14, color:'#0f172a', outline:'none', background:'#fff', transition:'border-color .15s', fontFamily:"'Poppins',sans-serif" };

  const card = (
    <div style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:22, boxShadow:'0 20px 56px rgba(0,0,0,.09)', overflow:'hidden', animation:'fadeIn .4s ease both' }}>
      <div style={{ height:4, background:'linear-gradient(90deg,#6366f1,#8b5cf6,#6366f1)' }}/>
      <div style={{ padding: isMobile ? '22px 18px 24px' : '26px 28px 30px' }}>
        {/* Tabs */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
          <div style={{ display:'inline-flex', background:'#f1f5f9', borderRadius:999, padding:3, gap:2 }}>
            {(['principal','teacher'] as StaffRole[]).map(role=>(
              <button key={role} type="button" onClick={()=>switchTab(role)}
                style={{ padding:'8px 18px', borderRadius:999, border:'none', background:activeTab===role?'#6366f1':'transparent', color:activeTab===role?'#fff':'#94a3b8', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:activeTab===role?'0 2px 8px rgba(99,102,241,.28)':'none', transition:'all .2s' }}>
                {role==='principal'?'Principal':'Teacher'}
              </button>
            ))}
          </div>
        </div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'#0f172a', textAlign:'center', marginBottom:18, letterSpacing:'-0.02em' }}>Log In</h2>
        {error && <div style={{ padding:'10px 13px', borderRadius:9, marginBottom:12, background:'#fef2f2', border:'1px solid #fecaca', fontSize:13, color:'#dc2626' }}>⚠️ {error}</div>}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:13 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#64748b', marginBottom:5 }}>Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@school.com" required style={cardInp}
              onFocus={e=>{e.currentTarget.style.borderColor='#6366f1';}} onBlur={e=>{e.currentTarget.style.borderColor='#e2e8f0';}}/>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <label style={{ fontSize:12, fontWeight:500, color:'#64748b' }}>Password</label>
              <a href="#" style={{ fontSize:12, color:'#6366f1', fontWeight:500, textDecoration:'none' }}>Forgot?</a>
            </div>
            <div style={{ position:'relative' }}>
              <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={{ ...cardInp, padding:'12px 40px 12px 14px' }}
                onFocus={e=>{e.currentTarget.style.borderColor='#6366f1';}} onBlur={e=>{e.currentTarget.style.borderColor='#e2e8f0';}}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:15 }}>{showPass?'🙈':'👁'}</button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:loading?'#e2e8f0':'linear-gradient(135deg,#6366f1,#8b5cf6)', color:loading?'#94a3b8':'#fff', fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:loading?'none':'0 4px 16px rgba(99,102,241,.32)', marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {loading ? <><span style={{ display:'inline-block', width:13, height:13, borderRadius:999, border:'2px solid #c7d2fe', borderTopColor:'#6366f1', animation:'spin .7s linear infinite' }}/> Signing in…</> : 'Log In'}
          </button>
        </form>
        {activeTab==='teacher' && (
          <div style={{ marginTop:12, padding:'11px 13px', borderRadius:10, background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:12, color:'#065f46', textAlign:'center' }}>
            New teacher? <button onClick={()=>navigate('/register')} style={{ background:'none', border:'none', cursor:'pointer', color:'#059669', fontWeight:700, fontSize:12, padding:0, fontFamily:"'Poppins',sans-serif" }}>Register here →</button>
          </div>
        )}
        {activeTab==='principal' && (
          <div style={{ marginTop:12, padding:'11px 13px', borderRadius:10, background:'#eef2ff', border:'1px solid #c7d2fe', fontSize:12, color:'#3730a3', textAlign:'center' }}>
            New school? <button onClick={()=>navigate('/setup')} style={{ background:'none', border:'none', cursor:'pointer', color:'#6366f1', fontWeight:700, fontSize:12, padding:0, fontFamily:"'Poppins',sans-serif" }}>Start here →</button>
          </div>
        )}
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'center' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12.5, color:'#94a3b8', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>← Back to roles</button>
        </div>
      </div>
    </div>
  );

  if (isMobile || isTablet) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f0f4ff,#f5f0ff,#fff8f0)', display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? '20px 16px' : '32px 24px', fontFamily:"'Poppins',sans-serif", position:'relative', overflow:'hidden' }}>
        <style>{GLOBAL}</style>
        {isTablet && (
          <>
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'22%', overflow:'hidden' }}>
              <img src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.5 }}/>
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, transparent 20%, #f0f4ff 100%)' }}/>
            </div>
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'22%', overflow:'hidden' }}>
              <img src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top', opacity:.6 }}/>
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to left, transparent 20%, #f5f0ff 100%)' }}/>
            </div>
          </>
        )}
        <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:10 }}>{card}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f0f4ff,#f5f0ff,#fff8f0)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Poppins',sans-serif", position:'relative', overflow:'hidden', padding:'24px 16px' }}>
      <style>{GLOBAL}</style>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'30%', overflow:'hidden' }}>
        <img src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.6 }}/>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, transparent 50%, #f0f4ff 100%)' }}/>
      </div>
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'28%', overflow:'hidden' }}>
        <img src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&q=80" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top', opacity:.7 }}/>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to left, transparent 50%, #f5f0ff 100%)' }}/>
      </div>
      {card}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const [screen,    setScreen]    = useState<Screen>('choose');
  const [staffRole, setStaffRole] = useState<StaffRole>('principal');
  const handleRoleSelect = (role: 'principal'|'teacher'|'parent') => {
    if (role==='parent') setScreen('parent');
    else { setStaffRole(role); setScreen('staff'); }
  };
  if (screen==='parent') return <ParentLogin onBack={()=>setScreen('choose')}/>;
  if (screen==='staff')  return <StaffLogin defaultRole={staffRole} onBack={()=>setScreen('choose')}/>;
  return <RoleChooser onSelect={handleRoleSelect}/>;
}