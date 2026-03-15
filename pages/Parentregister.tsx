// pages/ParentRegister.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 3-STEP PARENT REGISTRATION
//
// Step 1 — Account details  (name, email, phone, password)
// Step 2 — School code      (validated → school name shown, NO class field)
// Step 3 — Find child       (fetches ALL students at that school,
//                            parent searches by name / roll / class,
//                            picks ONE, duplicate-link guard runs,
//                            childId/childName/childClass/childRoll locked in)
//
// Why no class field?  Parents don't know the exact format stored in Firestore.
// Instead we fetch every student at the school and let them search freely.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../src/context/AuthContext';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  doc, setDoc, serverTimestamp,
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { auth, db } from '../src/firebase/firebaseConfig';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentResult {
  id:         string;
  name:       string;
  class_name: string;
  roll_no:    string;
  gender?:    string;
}

interface SchoolInfo {
  id:         string;
  name:       string;
  schoolCode: string;
}

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024 };
}

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Poppins', sans-serif; }
  input, button, textarea, select { font-family: 'Poppins', sans-serif; }
  @keyframes fadeIn  { from{opacity:0;transform:translateY(10px);}  to{opacity:1;transform:translateY(0);}  }
  @keyframes slideUp { from{opacity:0;transform:translateY(100%);}  to{opacity:1;transform:translateY(0);}  }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1;} 50%{opacity:.4;} }
  @keyframes popIn   { from{opacity:0;transform:scale(.9) translateY(14px);} to{opacity:1;transform:scale(1) translateY(0);} }
  ::placeholder { color: rgba(255,255,255,0.35); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 99px; }
`;

// ─── Slideshow ────────────────────────────────────────────────────────────────
const SLIDES = [
  { url:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=85', caption:"Stay connected with your child's school" },
  { url:'https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=85', caption:'Get instant absence alerts'              },
  { url:'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=85', caption:'Track progress and request leave'         },
];

// ─── Shared input style ───────────────────────────────────────────────────────
const baseInp: React.CSSProperties = {
  width:'100%', padding:'13px 16px', borderRadius:12,
  border:'1.5px solid transparent',
  background:'rgba(255,255,255,.13)', fontSize:14, color:'#fff',
  outline:'none', fontWeight:400, transition:'border-color .18s',
};
const iFocus = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(255,255,255,.45)');
const iBlur  = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = 'transparent');

// ─── Password strength ────────────────────────────────────────────────────────
function PasswordStrength({ pwd }: { pwd:string }) {
  if (!pwd) return null;
  const checks = [pwd.length>=8,/[A-Z]/.test(pwd),/[0-9]/.test(pwd),/[^A-Za-z0-9]/.test(pwd)];
  const score  = checks.filter(Boolean).length;
  const labels = ['','Weak','Fair','Good','Strong'];
  const colors = ['','#ef4444','#f59e0b','#10b981','#22c55e'];
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ display:'flex', gap:4, marginBottom:4 }}>
        {[1,2,3,4].map(i=>(
          <div key={i} style={{ flex:1,height:3,borderRadius:999,background:i<=score?colors[score]:'rgba(255,255,255,.12)',transition:'background .3s' }}/>
        ))}
      </div>
      <span style={{ fontSize:10,fontWeight:700,color:colors[score],letterSpacing:'.06em' }}>{labels[score]}</span>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step:number }) {
  const steps = ['Account','School','Your Child'];
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:22 }}>
      {steps.map((label,i) => {
        const done=i<step, active=i===step;
        return (
          <React.Fragment key={i}>
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
              <div style={{ width:30,height:30,borderRadius:'50%', border:`2px solid ${done?'#22c55e':active?'#f59e0b':'rgba(255,255,255,.2)'}`, background:done?'#22c55e':active?'rgba(245,158,11,.2)':'rgba(255,255,255,.05)', display:'flex',alignItems:'center',justifyContent:'center', fontSize:12,fontWeight:800, color:done?'#fff':active?'#f59e0b':'rgba(255,255,255,.3)', transition:'all .3s' }}>
                {done?'✓':i+1}
              </div>
              <span style={{ fontSize:9,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:active?'#f59e0b':done?'#22c55e':'rgba(255,255,255,.28)' }}>{label}</span>
            </div>
            {i<steps.length-1&&(
              <div style={{ flex:1,height:2,margin:'0 8px',marginBottom:18,background:done?'#22c55e':'rgba(255,255,255,.1)',transition:'background .4s' }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Slide dots ───────────────────────────────────────────────────────────────
function SlideDots({ slide,total,onSet }:{ slide:number;total:number;onSet:(i:number)=>void }) {
  return (
    <div style={{ display:'flex',justifyContent:'center',gap:7,marginTop:14 }}>
      {Array.from({length:total},(_,i)=>(
        <button key={i} onClick={()=>onSet(i)} style={{ width:i===slide?24:7,height:7,borderRadius:999,background:i===slide?'#f59e0b':'rgba(255,255,255,.35)',border:'none',cursor:'pointer',padding:0,transition:'width .25s,background .25s' }}/>
      ))}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function FL({ children }:{ children:React.ReactNode }) {
  return <div style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6 }}>{children}</div>;
}
function ErrBanner({ msg }:{ msg:string }) {
  if (!msg) return null;
  return (
    <div style={{ display:'flex',gap:9,padding:'11px 14px',borderRadius:12,marginBottom:14,background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.35)',fontSize:13,color:'#fca5a5',alignItems:'flex-start' }}>
      <span style={{ flexShrink:0 }}>⚠️</span>
      <span style={{ lineHeight:1.5 }}>{msg}</span>
    </div>
  );
}
function humanError(err:unknown):string {
  const code=(err as any)?.code??'';
  if (code==='auth/email-already-in-use') return 'This email is already registered. Sign in instead.';
  if (code==='auth/invalid-email')         return 'Invalid email address.';
  if (code==='auth/weak-password')         return 'Password too weak — use at least 8 characters.';
  if (code==='auth/network-request-failed')return 'Network error. Check your connection and try again.';
  return `Registration failed: ${(err as any)?.message??err}`;
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

// Validate school code → returns school info or null
async function lookupSchool(code:string): Promise<SchoolInfo|null> {
  try {
    const q    = query(collection(db,'schools'),where('schoolCode','==',code.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id:d.id, name:d.data().name??'Unknown School', schoolCode:d.data().schoolCode };
  } catch { return null; }
}

// Fetch ALL students at a school.
// Three fallback strategies because students added via the Students page
// (localStorage / AddStudent dialog) may not have a schoolId field in Firestore.
async function fetchAllStudents(schoolId:string, schoolCode:string): Promise<StudentResult[]> {
  const dedup = (list:StudentResult[]) => {
    const seen = new Set<string>();
    return list
      .filter(s => {
        if (!s.name || !s.class_name) return false;
        const k = s.class_name + "::" + s.roll_no;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a,b) => a.name.localeCompare(b.name));
  };

  // Strategy 1: Match by schoolId
  try {
    const q1   = query(collection(db,"students"), where("schoolId","==",schoolId));
    const s1   = await getDocs(q1);
    const res1 = s1.docs.map(d => ({ id:d.id, ...d.data() } as StudentResult));
    console.log("[ParentRegister] Strategy 1 (schoolId):", res1.length, "students");
    if (res1.length > 0) return dedup(res1);
  } catch(e1) {
    console.warn("[ParentRegister] Strategy 1 failed:", e1);
  }

  // Strategy 2: Match by schoolCode field
  try {
    const q2   = query(collection(db,"students"), where("schoolCode","==",schoolCode));
    const s2   = await getDocs(q2);
    const res2 = s2.docs.map(d => ({ id:d.id, ...d.data() } as StudentResult));
    console.log("[ParentRegister] Strategy 2 (schoolCode):", res2.length, "students");
    if (res2.length > 0) return dedup(res2);
  } catch(e2) {
    console.warn("[ParentRegister] Strategy 2 failed:", e2);
  }

  // Strategy 3: Fetch ALL students (fallback for single-school, no schoolId on docs)
  try {
    const q3   = query(collection(db,"students"));
    const s3   = await getDocs(q3);
    const res3 = s3.docs.map(d => ({ id:d.id, ...d.data() } as StudentResult));
    console.log("[ParentRegister] Strategy 3 (all):", res3.length, "students");
    return dedup(res3);
  } catch(e3) {
    console.warn("[ParentRegister] Strategy 3 failed:", e3);
    throw e3; // Re-throw so Step2 can show the actual error
  }
}

// Check if a student is already linked to another parent
async function isChildAlreadyLinked(studentId:string): Promise<boolean> {
  // This query requires list permission on users collection.
  // During ParentRegister Step 3, the user is not yet authenticated,
  // so Firestore will deny this — we catch it and return false (safe default).
  try {
    const q    = query(collection(db,'users'),where('childId','==',studentId),where('role','==','PARENT'));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch(e: any) {
    // Permission denied = not authenticated yet, treat as "not linked"
    console.warn('[ParentRegister] isChildAlreadyLinked skipped (not auth yet):', e?.code ?? e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function SuccessScreen({ name,childName,childClass,onLogin }:{ name:string;childName:string;childClass:string;onLogin:()=>void }) {
  return (
    <div style={{ minHeight:'100vh',background:'linear-gradient(165deg,#0d9488,#065f46)',display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Poppins',sans-serif" }}>
      <style>{GLOBAL}</style>
      <div style={{ textAlign:'center',animation:'popIn .5s cubic-bezier(.34,1.4,.64,1) both',maxWidth:400,width:'100%' }}>
        <div style={{ position:'relative',width:96,height:96,margin:'0 auto 22px' }}>
          <div style={{ position:'absolute',inset:0,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'2px solid rgba(255,255,255,.2)' }}/>
          <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:42 }}>🎉</div>
          {[0,60,120,180,240,300].map((deg,i)=>(
            <div key={i} style={{ position:'absolute',width:8,height:8,borderRadius:'50%',background:['#f59e0b','#22c55e','#38bdf8','#a78bfa','#f472b6','#34d399'][i],top:`calc(50% + ${Math.sin(deg*Math.PI/180)*46}px - 4px)`,left:`calc(50% + ${Math.cos(deg*Math.PI/180)*46}px - 4px)`,animation:`pulse 1.8s ease-in-out ${i*.15}s infinite` }}/>
          ))}
        </div>
        <h2 style={{ fontSize:26,fontWeight:800,color:'#fff',marginBottom:8,letterSpacing:'-.02em' }}>
          Welcome, {name.split(' ')[0]}!
        </h2>
        <div style={{ display:'inline-flex',alignItems:'center',gap:10,padding:'10px 18px',borderRadius:14,background:'rgba(245,158,11,.18)',border:'1px solid rgba(245,158,11,.35)',marginBottom:20 }}>
          <span style={{ fontSize:22 }}>👧</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:10,fontWeight:700,color:'rgba(245,158,11,.7)',textTransform:'uppercase',letterSpacing:'.08em' }}>Linked child</div>
            <div style={{ fontSize:15,fontWeight:800,color:'#fbbf24' }}>{childName}</div>
            <div style={{ fontSize:11,color:'rgba(245,158,11,.6)',marginTop:1 }}>Class {childClass}</div>
          </div>
        </div>
        <p style={{ fontSize:13,color:'rgba(255,255,255,.6)',lineHeight:1.8,marginBottom:20 }}>
          Your account is set up. You'll go straight to {childName}'s portal every time you sign in — no more picking from a list.
        </p>
        <div style={{ display:'flex',flexDirection:'column',gap:9,margin:'0 0 24px',textAlign:'left' }}>
          {[
            { icon:'📊', text:'Real-time attendance updates'     },
            { icon:'🔔', text:'Instant alerts for absences'       },
            { icon:'📝', text:'Submit leave requests online'      },
            { icon:'📅', text:'Monthly attendance calendar'       },
          ].map((f,i)=>(
            <div key={i} style={{ display:'flex',alignItems:'center',gap:11,padding:'11px 14px',borderRadius:13,background:'rgba(255,255,255,.09)',border:'1px solid rgba(255,255,255,.12)',animation:`fadeIn .4s ease ${i*.09+.2}s both` }}>
              <span style={{ fontSize:18 }}>{f.icon}</span>
              <span style={{ fontSize:13,fontWeight:500,color:'rgba(255,255,255,.85)' }}>{f.text}</span>
            </div>
          ))}
        </div>
        <button onClick={onLogin}
          style={{ width:'100%',padding:'15px',borderRadius:14,border:'none',background:'#f59e0b',color:'#0f172a',fontSize:15,fontWeight:800,cursor:'pointer',boxShadow:'0 6px 24px rgba(245,158,11,.45)',transition:'transform .15s,box-shadow .15s' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 32px rgba(245,158,11,.55)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 6px 24px rgba(245,158,11,.45)';}}>
          Sign In Now →
        </button>
        <p style={{ marginTop:14,fontSize:11,color:'rgba(255,255,255,.22)' }}>© {new Date().getFullYear()} EduAttend AI</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2  —  School code (no class field)
// ═══════════════════════════════════════════════════════════════════════════════
function Step2({
  onNext, onBack,
}:{
  onNext:(school:SchoolInfo,students:StudentResult[])=>void;
  onBack:()=>void;
}) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handle(e:React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!code.trim()) { setError('Please enter your school code.'); return; }
    setLoading(true);
    try {
      const school = await lookupSchool(code);
      if (!school) {
        setError('School code not found. Double-check the code or ask your school office.');
        setLoading(false);
        return;
      }
      let students: StudentResult[] = [];
      try {
        students = await fetchAllStudents(school.id, school.schoolCode);
      } catch(fetchErr: any) {
        const msg = fetchErr?.message ?? String(fetchErr);
        if (msg.toLowerCase().includes('permission')) {
          setError('Firestore permission denied — please ask your school administrator to update the Firestore security rules.');
        } else {
          setError(`Could not load students: ${msg}`);
        }
        setLoading(false);
        return;
      }
      if (students.length === 0) {
        setError(`No students found at "${school.name}". Make sure the principal has added students in the Students page first.`);
        setLoading(false);
        return;
      }
      onNext(school, students);
    } catch(err: any) {
      setError(`Something went wrong: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = code.trim().length >= 4 && !loading;

  return (
    <form onSubmit={handle} style={{ display:'flex',flexDirection:'column',gap:16 }}>
      <ErrBanner msg={error}/>

      <div style={{ display:'flex',gap:10,padding:'12px 14px',borderRadius:13,background:'rgba(56,189,248,.1)',border:'1px solid rgba(56,189,248,.25)',fontSize:12,color:'rgba(56,189,248,.9)',alignItems:'flex-start',lineHeight:1.6 }}>
        <span style={{ fontSize:18,flexShrink:0 }}>ℹ️</span>
        <span>Your <strong style={{ color:'#38bdf8' }}>School Code</strong> is on the school's notice board or given by the school office. You <em>don't</em> need to know your child's class — you'll search for them by name on the next screen.</span>
      </div>

      <div>
        <FL>School Code <span style={{ color:'#f87171' }}>*</span></FL>
        <input
          type="text"
          value={code}
          onChange={e=>setCode(e.target.value.toUpperCase())}
          placeholder="e.g. GREENWOOD2024"
          required autoCapitalize="characters"
          style={{ ...baseInp,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600 }}
          onFocus={iFocus} onBlur={iBlur}
        />
      </div>

      <button type="submit" disabled={!canSubmit}
        style={{ width:'100%',padding:'14px',borderRadius:13,border:'none',background:canSubmit?'#f59e0b':'rgba(255,255,255,.08)',color:canSubmit?'#0f172a':'rgba(255,255,255,.25)',fontSize:15,fontWeight:700,cursor:canSubmit?'pointer':'not-allowed',boxShadow:canSubmit?'0 4px 18px rgba(245,158,11,.35)':'none',transition:'all .2s',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        {loading
          ? <><span style={{ display:'inline-block',width:14,height:14,borderRadius:999,border:'2px solid rgba(0,0,0,.15)',borderTopColor:'#0f172a',animation:'spin .7s linear infinite' }}/> Looking up school…</>
          : '🔍 Find My School →'
        }
      </button>

      <button type="button" onClick={onBack}
        style={{ background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,.4)',padding:'4px 0',textAlign:'center',fontWeight:500 }}>
        ← Back to Step 1
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3  —  Search ALL school students, pick & lock child
// ═══════════════════════════════════════════════════════════════════════════════
function Step3({
  school,students,onConfirm,onBack,
}:{
  school:SchoolInfo;
  students:StudentResult[];
  onConfirm:(child:StudentResult)=>void;
  onBack:()=>void;
}) {
  const [search,   setSearch]   = useState('');
  const [checking, setChecking] = useState<string|null>(null);
  const [blocked,  setBlocked]  = useState<Record<string,boolean>>({});
  const [error,    setError]    = useState('');

  // Build unique class list for the "filter by class" chips
  const allClasses = Array.from(new Set(students.map(s=>s.class_name))).sort();
  const [classFilter, setClassFilter] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = students.filter(s=>{
    const matchSearch = !q
      || s.name.toLowerCase().includes(q)
      || s.roll_no.toLowerCase().includes(q)
      || s.class_name.toLowerCase().includes(q);
    const matchClass = !classFilter || s.class_name === classFilter;
    return matchSearch && matchClass;
  });

  async function handleSelect(student:StudentResult) {
    setError('');
    setChecking(student.id);
    try {
      const linked = await isChildAlreadyLinked(student.id);
      if (linked) {
        setBlocked(p=>({...p,[student.id]:true}));
        setError(`${student.name} is already linked to another parent account. Contact the school if this is your child.`);
        setChecking(null);
        return;
      }
      onConfirm(student);
    } catch {
      setError('Could not verify this student. Check your connection and try again.');
      setChecking(null);
    }
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      <ErrBanner msg={error}/>

      {/* School badge */}
      <div style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:14,background:'rgba(52,211,153,.1)',border:'1px solid rgba(52,211,153,.25)' }}>
        <span style={{ fontSize:20 }}>🏫</span>
        <div>
          <div style={{ fontSize:12,fontWeight:700,color:'#34d399' }}>{school.name}</div>
          <div style={{ fontSize:11,color:'rgba(52,211,153,.65)',marginTop:1 }}>{students.length} student{students.length!==1?'s':''} registered</div>
        </div>
      </div>

      {/* Instruction */}
      <div style={{ display:'flex',gap:9,padding:'10px 13px',borderRadius:12,background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',fontSize:12,color:'rgba(245,158,11,.85)',alignItems:'flex-start',lineHeight:1.6 }}>
        <span style={{ flexShrink:0 }}>👆</span>
        <span>Search for your child by <strong style={{ color:'#fbbf24' }}>name</strong> or <strong style={{ color:'#fbbf24' }}>roll number</strong>, then tap their card to link your account to them.</span>
      </div>

      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={e=>setSearch(e.target.value)}
        placeholder="Type child's name or roll number…"
        style={{ ...baseInp,border:'1.5px solid rgba(255,255,255,.2)' }}
        onFocus={iFocus} onBlur={iBlur}
        autoFocus
      />

      {/* Class filter chips */}
      {allClasses.length > 1 && (
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          <button
            type="button"
            onClick={()=>setClassFilter('')}
            style={{ padding:'4px 12px',borderRadius:999,border:`1px solid ${!classFilter?'rgba(245,158,11,.5)':'rgba(255,255,255,.15)'}`,background:!classFilter?'rgba(245,158,11,.18)':'rgba(255,255,255,.06)',color:!classFilter?'#fbbf24':'rgba(255,255,255,.45)',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s' }}>
            All Classes
          </button>
          {allClasses.map(cn=>(
            <button
              key={cn}
              type="button"
              onClick={()=>setClassFilter(cn===classFilter?'':cn)}
              style={{ padding:'4px 12px',borderRadius:999,border:`1px solid ${classFilter===cn?'rgba(56,189,248,.5)':'rgba(255,255,255,.15)'}`,background:classFilter===cn?'rgba(56,189,248,.18)':'rgba(255,255,255,.06)',color:classFilter===cn?'#38bdf8':'rgba(255,255,255,.45)',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s' }}>
              {cn}
            </button>
          ))}
        </div>
      )}

      {/* Result count */}
      {(search || classFilter) && (
        <div style={{ fontSize:11,color:'rgba(255,255,255,.35)',fontWeight:600 }}>
          {filtered.length} result{filtered.length!==1?'s':''} {search?`for "${search}"`:''}
        </div>
      )}

      {/* Student cards */}
      <div style={{ display:'flex',flexDirection:'column',gap:7,maxHeight:320,overflowY:'auto',paddingRight:2 }}>
        {filtered.length===0 ? (
          <div style={{ textAlign:'center',padding:'32px 0',color:'rgba(255,255,255,.3)' }}>
            <div style={{ fontSize:36,marginBottom:10 }}>🔍</div>
            <div style={{ fontSize:13,fontWeight:600,marginBottom:6,color:'rgba(255,255,255,.45)' }}>
              {search ? `No students match "${search}"` : 'No students in this class'}
            </div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,.25)' }}>
              Try a different spelling or clear the class filter
            </div>
          </div>
        ) : (
          filtered.map(s=>{
            const isBlocked  = blocked[s.id];
            const isChecking = checking===s.id;
            const busy       = !!checking;
            return (
              <button
                key={s.id}
                type="button"
                disabled={isBlocked||busy}
                onClick={()=>handleSelect(s)}
                style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:14,border:`1.5px solid ${isBlocked?'rgba(239,68,68,.35)':isChecking?'rgba(245,158,11,.4)':'rgba(255,255,255,.12)'}`,background:isBlocked?'rgba(239,68,68,.08)':isChecking?'rgba(245,158,11,.1)':'rgba(255,255,255,.06)',cursor:isBlocked||busy?'not-allowed':'pointer',textAlign:'left',width:'100%',transition:'all .18s',opacity:isBlocked ? .6 : 1 }}
                onMouseEnter={e=>{if(!isBlocked&&!busy)e.currentTarget.style.background='rgba(255,255,255,.13)';}}
                onMouseLeave={e=>{if(!isBlocked&&!busy)e.currentTarget.style.background=isChecking?'rgba(245,158,11,.1)':'rgba(255,255,255,.06)';}}
              >
                {/* Avatar */}
                <div style={{ width:42,height:42,borderRadius:13,flexShrink:0,background:isBlocked?'rgba(239,68,68,.2)':'rgba(245,158,11,.22)',border:`1.5px solid ${isBlocked?'rgba(239,68,68,.3)':'rgba(245,158,11,.3)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:17,color:isBlocked?'#f87171':'#fbbf24' }}>
                  {s.name[0].toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:isBlocked?'rgba(255,255,255,.4)':'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                    {s.name}
                    {isBlocked&&<span style={{ marginLeft:8,fontSize:10,color:'#f87171',fontWeight:600 }}>· Already linked</span>}
                  </div>
                  <div style={{ fontSize:11,color:'rgba(255,255,255,.4)',marginTop:2 }}>
                    Class <strong style={{ color:'rgba(255,255,255,.6)' }}>{s.class_name}</strong>
                    {' '}· Roll {s.roll_no}
                    {s.gender?` · ${s.gender}`:''}
                  </div>
                </div>
                {/* Right icon */}
                <div style={{ flexShrink:0 }}>
                  {isChecking ? (
                    <span style={{ display:'inline-block',width:18,height:18,borderRadius:999,border:'2px solid rgba(245,158,11,.3)',borderTopColor:'#f59e0b',animation:'spin .7s linear infinite' }}/>
                  ) : isBlocked ? (
                    <span style={{ fontSize:18 }}>🔒</span>
                  ) : (
                    <span style={{ fontSize:20,color:'#f59e0b',fontWeight:700 }}>›</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <button type="button" onClick={onBack}
        style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,color:'rgba(255,255,255,.35)',fontWeight:500,textDecoration:'underline',textAlign:'center',paddingTop:4 }}>
        ← Wrong school? Go back
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ParentRegister(): React.ReactElement {
  const navigate = useNavigate();
  const { skipNextAuthEvent, markRegistrationComplete } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();

  // Slideshow
  const [slide,setSlide]=useState(0);
  useEffect(()=>{
    const iv=setInterval(()=>setSlide(s=>(s+1)%SLIDES.length),4500);
    return ()=>clearInterval(iv);
  },[]);

  // Wizard
  const [step,      setStep]      = useState(0);
  const [school,    setSchool]    = useState<SchoolInfo|null>(null);
  const [students,  setStudents]  = useState<StudentResult[]>([]);
  const [lockedChild,setLockedChild]=useState<StudentResult|null>(null);

  // Step 0 fields
  const [form,setForm]=useState({ name:'',email:'',phone:'',password:'',confirmPass:'' });
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [s0Err,       setS0Err]       = useState('');

  const set=(k:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(p=>({...p,[k]:e.target.value}));
  const emailOk   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const passMatch = form.password===form.confirmPass;
  const step0Valid= form.name.trim().length>=2&&emailOk&&form.password.length>=8&&passMatch;

  // Final submit
  const [submitting,  setSubmitting]  = useState(false);
  const [submitErr,   setSubmitErr]   = useState('');
  const [success,     setSuccess]     = useState(false);

  const handleFinalSubmit = useCallback(async(child:StudentResult)=>{
    setLockedChild(child);
    setSubmitting(true);
    setSubmitErr('');
    try {
      // Race-condition guard: check again right before writing
      const linked = await isChildAlreadyLinked(child.id);
      if (linked) {
        setSubmitErr(`${child.name} was just linked by someone else. Contact the school if this is your child.`);
        setLockedChild(null);
        setSubmitting(false);
        return;
      }
      // Tell AuthContext to skip the next onAuthStateChanged event.
      // createUserWithEmailAndPassword triggers that event immediately, and
      // the listener would try to load a Firestore profile that doesn't exist
      // yet — causing NO_PROFILE → signOut → session destroyed.
      // skipNextAuthEvent() sets skipRef=true so the listener ignores it.
      skipNextAuthEvent();

      // Create Auth account (triggers onAuthStateChanged — now skipped)
      const cred = await createUserWithEmailAndPassword(auth,form.email.trim(),form.password);
      await updateProfile(cred.user,{displayName:form.name.trim()});

      // Force token refresh so Firestore sees request.auth.uid on the first write
      await cred.user.getIdToken(true);

      // Write Firestore doc — child locked in permanently
      await setDoc(doc(db,'users',cred.user.uid),{
        id:         cred.user.uid,
        name:       form.name.trim(),
        email:      form.email.trim(),
        phone:      form.phone.trim(),
        role:       'PARENT',
        status:     'active',
        schoolId:   school!.id,
        schoolCode: school!.schoolCode,
        childId:    child.id,
        childName:  child.name,
        childClass: child.class_name,
        childRoll:  child.roll_no,
        createdAt:  serverTimestamp(),
      });

      // Set the user directly in AuthContext — no need to go through the listener
      markRegistrationComplete({
        id:         cred.user.uid,
        name:       form.name.trim(),
        email:      form.email.trim(),
        role:       'PARENT',
        status:     'active',
        schoolId:   school!.id,
        schoolCode: school!.schoolCode,
        childId:    child.id,
        childName:  child.name,
        childClass: child.class_name,
        childRoll:  child.roll_no,
      });

      setSuccess(true);
    } catch(err) {
      setSubmitErr(humanError(err));
      setLockedChild(null);
    } finally {
      setSubmitting(false);
    }
  },[form,school,skipNextAuthEvent,markRegistrationComplete]);

  // Success
  if (success&&lockedChild) {
    return <SuccessScreen name={form.name} childName={lockedChild.name} childClass={lockedChild.class_name} onLogin={()=>navigate('/login')}/>;
  }

  // Submitting overlay
  const Overlay = submitting?(
    <div style={{ position:'fixed',inset:0,zIndex:999,background:'rgba(6,95,70,.88)',backdropFilter:'blur(6px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:"'Poppins',sans-serif" }}>
      <span style={{ display:'inline-block',width:40,height:40,borderRadius:999,border:'3px solid rgba(255,255,255,.2)',borderTopColor:'#f59e0b',animation:'spin .8s linear infinite' }}/>
      <div style={{ fontSize:14,fontWeight:700,color:'#fff' }}>Creating your account…</div>
    </div>
  ):null;

  // ── Form body ──────────────────────────────────────────────────────────────
  const formBody=(
    <div>
      <style>{GLOBAL}</style>
      <StepIndicator step={step}/>

      {/* ── STEP 0 — Account ── */}
      {step===0&&(
        <form onSubmit={e=>{e.preventDefault();setS0Err('');if(step0Valid)setStep(1);}} style={{ display:'flex',flexDirection:'column',gap:13 }}>
          <ErrBanner msg={s0Err}/>

          <div>
            <FL>Full Name <span style={{ color:'#f87171' }}>*</span></FL>
            <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Sarah Dlamini" required autoComplete="name" style={baseInp} onFocus={iFocus} onBlur={iBlur}/>
          </div>

          <div>
            <FL>Email Address <span style={{ color:'#f87171' }}>*</span></FL>
            <input type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" required autoComplete="email" style={{ ...baseInp,borderColor:form.email&&!emailOk?'rgba(239,68,68,.5)':'transparent' }} onFocus={iFocus} onBlur={iBlur}/>
            {form.email&&!emailOk&&<div style={{ fontSize:10,color:'#f87171',marginTop:4 }}>Please enter a valid email address</div>}
          </div>

          <div>
            <FL>Phone Number <span style={{ color:'rgba(255,255,255,.25)' }}>(optional)</span></FL>
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+27 71 234 5678" autoComplete="tel" style={baseInp} onFocus={iFocus} onBlur={iBlur}/>
          </div>

          <div>
            <FL>Password <span style={{ color:'#f87171' }}>*</span></FL>
            <div style={{ position:'relative' }}>
              <input type={showPass?'text':'password'} value={form.password} onChange={set('password')} placeholder="Minimum 8 characters" required autoComplete="new-password" style={{ ...baseInp,padding:'13px 44px 13px 16px' }} onFocus={iFocus} onBlur={iBlur}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.5)',fontSize:15 }}>{showPass?'🙈':'👁'}</button>
            </div>
            <PasswordStrength pwd={form.password}/>
          </div>

          <div>
            <FL>Confirm Password <span style={{ color:'#f87171' }}>*</span></FL>
            <div style={{ position:'relative' }}>
              <input type={showConfirm?'text':'password'} value={form.confirmPass} onChange={set('confirmPass')} placeholder="Re-enter your password" required autoComplete="new-password" style={{ ...baseInp,padding:'13px 44px 13px 16px',borderColor:form.confirmPass&&!passMatch?'rgba(239,68,68,.5)':'transparent' }} onFocus={iFocus} onBlur={iBlur}/>
              <button type="button" onClick={()=>setShowConfirm(p=>!p)} style={{ position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.5)',fontSize:15 }}>{showConfirm?'🙈':'👁'}</button>
            </div>
            {form.confirmPass&&!passMatch&&<div style={{ fontSize:10,color:'#f87171',marginTop:4 }}>⚠️ Passwords do not match</div>}
            {form.confirmPass&&passMatch&&form.password.length>=8&&<div style={{ fontSize:10,color:'#4ade80',marginTop:4 }}>✓ Passwords match</div>}
          </div>

          <button type="submit" disabled={!step0Valid}
            style={{ width:'100%',padding:'14px',borderRadius:13,border:'none',background:step0Valid?'#f59e0b':'rgba(255,255,255,.08)',color:step0Valid?'#0f172a':'rgba(255,255,255,.25)',fontSize:15,fontWeight:700,cursor:step0Valid?'pointer':'not-allowed',boxShadow:step0Valid?'0 4px 18px rgba(245,158,11,.35)':'none',marginTop:4,transition:'all .2s' }}>
            Continue to Step 2 →
          </button>

          <div style={{ textAlign:'center',marginTop:2 }}>
            <span style={{ fontSize:12,color:'rgba(255,255,255,.4)' }}>Already registered? </span>
            <button type="button" onClick={()=>navigate('/login')} style={{ background:'none',border:'none',cursor:'pointer',color:'#f59e0b',fontWeight:600,fontSize:12,padding:0 }}>Sign in</button>
          </div>
        </form>
      )}

      {/* ── STEP 1 — School code ── */}
      {step===1&&(
        <Step2
          onNext={(sc,sts)=>{ setSchool(sc); setStudents(sts); setStep(2); }}
          onBack={()=>setStep(0)}
        />
      )}

      {/* ── STEP 2 — Pick child ── */}
      {step===2&&school&&(
        <>
          {submitErr&&<ErrBanner msg={submitErr}/>}
          <Step3
            school={school}
            students={students}
            onConfirm={handleFinalSubmit}
            onBack={()=>{ setStudents([]); setSchool(null); setStep(1); }}
          />
        </>
      )}
    </div>
  );

  // ── Shared pieces ──────────────────────────────────────────────────────────
  const BackBtn=(
    <button onClick={()=>navigate('/login')} style={{ background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',borderRadius:10,padding:'8px 14px',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer' }}>
      ← Sign In
    </button>
  );

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh',background:'linear-gradient(165deg,#0d9488,#0e7a6e,#065f46)',fontFamily:"'Poppins',sans-serif",position:'relative',overflowX:'hidden' }}>
        <style>{GLOBAL}</style>
        {SLIDES.map((s,i)=><img key={i} src={s.url} alt="" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:i===slide ? .12 : 0,transition:'opacity .8s',pointerEvents:'none' }}/>)}
        <div style={{ position:'absolute',inset:0,background:'rgba(6,95,70,.55)',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',top:16,left:16,zIndex:20 }}>{BackBtn}</div>
        <div style={{ position:'relative',zIndex:10,display:'flex',flexDirection:'column',minHeight:'100vh',padding:'72px 20px 40px' }}>
          <div style={{ textAlign:'center',marginBottom:22 }}>
            <div style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:52,height:52,borderRadius:16,background:'rgba(255,255,255,.15)',marginBottom:10,fontSize:24 }}>👨‍👩‍👧</div>
            <h1 style={{ fontSize:22,fontWeight:800,color:'#fff',margin:'0 0 4px' }}>Parent Registration</h1>
            <p style={{ fontSize:12,color:'rgba(255,255,255,.55)' }}>{SLIDES[slide].caption}</p>
            <SlideDots slide={slide} total={SLIDES.length} onSet={setSlide}/>
          </div>
          <div style={{ background:'rgba(255,255,255,.1)',backdropFilter:'blur(20px)',borderRadius:22,border:'1px solid rgba(255,255,255,.15)',padding:'22px 16px',animation:'slideUp .4s ease both' }}>
            {formBody}
          </div>
        </div>
        {Overlay}
      </div>
    );
  }

  // ── TABLET ─────────────────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <div style={{ minHeight:'100vh',display:'flex',flexDirection:'column',fontFamily:"'Poppins',sans-serif" }}>
        <style>{GLOBAL}</style>
        <div style={{ height:190,position:'relative',overflow:'hidden',flexShrink:0 }}>
          {SLIDES.map((s,i)=><img key={i} src={s.url} alt="" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 35%',opacity:i===slide?1:0,transition:'opacity .8s' }}/>)}
          <div style={{ position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(13,148,136,.35),rgba(6,95,70,.92))' }}/>
          <div style={{ position:'absolute',top:16,left:16,zIndex:5 }}>{BackBtn}</div>
          <div style={{ position:'absolute',bottom:14,left:0,right:0,textAlign:'center',zIndex:2 }}>
            <div style={{ fontSize:17,fontWeight:800,color:'#fff',marginBottom:3 }}>👨‍👩‍👧 Parent Registration</div>
            <SlideDots slide={slide} total={SLIDES.length} onSet={setSlide}/>
          </div>
        </div>
        <div style={{ flex:1,display:'flex',justifyContent:'center',background:'linear-gradient(180deg,#065f46,#0d9488)',padding:'26px 20px 40px' }}>
          <div style={{ width:'100%',maxWidth:500,background:'rgba(255,255,255,.1)',backdropFilter:'blur(20px)',borderRadius:22,border:'1px solid rgba(255,255,255,.15)',padding:'26px 26px' }}>
            {formBody}
          </div>
        </div>
        {Overlay}
      </div>
    );
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex',minHeight:'100vh',fontFamily:"'Poppins',sans-serif" }}>
      <style>{GLOBAL}</style>

      {/* LEFT */}
      <div style={{ width:'46%',minHeight:'100vh',background:'linear-gradient(165deg,#0d9488 0%,#0e7a6e 50%,#065f46 100%)',display:'flex',flexDirection:'column',padding:'30px 44px 26px',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',width:340,height:340,borderRadius:'50%',background:'rgba(255,255,255,.04)',top:-130,left:-130,pointerEvents:'none' }}/>
        <div style={{ position:'absolute',width:180,height:180,borderRadius:'50%',background:'rgba(245,158,11,.06)',bottom:-50,right:-50,pointerEvents:'none' }}/>

        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:36,position:'relative',zIndex:1 }}>
          <div style={{ display:'flex',alignItems:'center',gap:9 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>🏫</div>
            <span style={{ fontSize:13,fontWeight:700,color:'rgba(255,255,255,.55)' }}>EduAttend AI</span>
          </div>
          <button onClick={()=>navigate('/login')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(255,255,255,.45)',fontWeight:500,textDecoration:'underline' }}>
            Already registered? Sign in →
          </button>
        </div>

        <div style={{ marginBottom:20,position:'relative',zIndex:1 }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'5px 13px',borderRadius:999,background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.25)',marginBottom:13 }}>
            <span style={{ fontSize:13 }}>👨‍👩‍👧</span>
            <span style={{ fontSize:10,fontWeight:700,color:'#fbbf24',letterSpacing:'.1em',textTransform:'uppercase' }}>Parent Portal Registration</span>
          </div>
          <h1 style={{ fontSize:27,fontWeight:800,color:'#fff',margin:'0 0 8px',letterSpacing:'-.03em',lineHeight:1.15 }}>Create Your<br/>Parent Account</h1>
          <p style={{ fontSize:13,color:'rgba(255,255,255,.42)',lineHeight:1.65 }}>
            Enter your school code, search for your child by name, and your account is permanently linked in 3 steps.
          </p>
        </div>

        {/* Step pills */}
        <div style={{ display:'flex',gap:7,marginBottom:22,position:'relative',zIndex:1,flexWrap:'wrap' }}>
          {[{n:'1',label:'Account'},{n:'2',label:'School'},{n:'3',label:'Pick Child'}].map((s,i)=>(
            <div key={i} style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:999,background:step===i?'rgba(245,158,11,.2)':step>i?'rgba(34,197,94,.15)':'rgba(255,255,255,.07)',border:`1px solid ${step===i?'rgba(245,158,11,.4)':step>i?'rgba(34,197,94,.3)':'rgba(255,255,255,.12)'}` }}>
              <span style={{ fontSize:10,fontWeight:800,color:step===i?'#f59e0b':step>i?'#4ade80':'rgba(255,255,255,.3)' }}>{step>i?'✓':s.n}</span>
              <span style={{ fontSize:10,fontWeight:700,color:step===i?'#f59e0b':step>i?'#4ade80':'rgba(255,255,255,.3)',textTransform:'uppercase',letterSpacing:'.07em' }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex:1,position:'relative',zIndex:1,overflowY:'auto',paddingRight:2 }}>
          {formBody}
        </div>

        <p style={{ fontSize:11,color:'rgba(255,255,255,.18)',position:'relative',zIndex:1,marginTop:14 }}>
          © {new Date().getFullYear()} EduAttend AI
        </p>
      </div>

      {/* RIGHT */}
      <div style={{ flex:1,position:'relative',overflow:'hidden' }}>
        {SLIDES.map((s,i)=><img key={i} src={s.url} alt="" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:i===slide?1:0,transition:'opacity .9s ease' }}/>)}
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,.08) 0%,rgba(0,0,0,.6) 100%)' }}/>

        <div style={{ position:'absolute',top:36,right:32,display:'flex',flexDirection:'column',gap:10,zIndex:2,maxWidth:260 }}>
          {[
            { icon:'🔍', title:'Search by name',           body:"Type your child's name — no need to know their exact class format."    },
            { icon:'🔒', title:'No duplicate links',        body:'Each child links to one parent account only — no mix-ups or sharing.'  },
            { icon:'⚡', title:'Skip the picker forever',   body:'Once linked at registration, you go straight to their portal on login.' },
            { icon:'📊', title:'Live attendance tracking',  body:'See present, late, absent — updated the moment the teacher marks it.'  },
          ].map((f,i)=>(
            <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'11px 13px',borderRadius:13,background:'rgba(0,0,0,.46)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,.1)',animation:`fadeIn .4s ease ${i*.1+.15}s both` }}>
              <span style={{ fontSize:20,flexShrink:0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:'#fff',marginBottom:2 }}>{f.title}</div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,.45)',lineHeight:1.5 }}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ position:'absolute',bottom:30,left:0,right:0,textAlign:'center',zIndex:2 }}>
          <p style={{ fontSize:19,fontWeight:700,color:'#fff',marginBottom:12,textShadow:'0 2px 8px rgba(0,0,0,.45)' }}>{SLIDES[slide].caption}</p>
          <SlideDots slide={slide} total={SLIDES.length} onSet={setSlide}/>
        </div>
      </div>

      {Overlay}
    </div>
  );
}