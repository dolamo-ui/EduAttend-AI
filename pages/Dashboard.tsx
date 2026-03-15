import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { useAuth } from '../src/context/AuthContext';
import { groqChat } from '../src/Groqai';
import {
  Users, School, CheckCircle2, XCircle, Clock, ClipboardList,
  Bot, RefreshCw, Sparkles, TrendingDown, AlertTriangle, AlertOctagon,
  ChevronDown, Flame, PartyPopper, BookOpen, LayoutDashboard,
  ArrowRight, Activity, ShieldAlert, Zap, BarChart2, MapPin, Phone,
} from 'lucide-react';

// ─── CSS ─────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Lora:ital,wght@0,500;0,600;1,500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy:   #1a2744;
    --blue:   #2563eb;
    --sky:    #3b82f6;
    --teal:   #0d9488;
    --green:  #16a34a;
    --amber:  #d97706;
    --red:    #dc2626;
    --orange: #ea580c;
    --slate:  #64748b;
    --muted:  #94a3b8;
    --border: #e2e8f0;
    --bg:     #f5f7fa;
    --card:   #ffffff;
    --text:   #0f172a;
    --text2:  #374151;
  }

  body { background: var(--bg); font-family: 'Nunito', sans-serif; color: var(--text); }

  @keyframes fadeUp   { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
  @keyframes pulse    { 0%,100%{opacity:1;}50%{opacity:.4;} }
  @keyframes spin     { to{transform:rotate(360deg);} }
  @keyframes shimmer  { from{background-position:-400px 0;}to{background-position:400px 0;} }

  /* Responsive grid helpers */
  .stat-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
  .chart-grid  { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .two-col     { display:grid; grid-template-columns:2fr 1fr; gap:16px; }
  .list-grid   { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

  @media(max-width:900px) {
    .chart-grid { grid-template-columns:1fr; }
    .two-col    { grid-template-columns:1fr; }
    .list-grid  { grid-template-columns:1fr; }
  }
  @media(max-width:600px) {
    .stat-grid  { grid-template-columns:1fr 1fr; }
  }
  @media(max-width:360px) {
    .stat-grid  { grid-template-columns:1fr; }
  }

  /* Scrollbars */
  ::-webkit-scrollbar       { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:999px; }
`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SchoolInfo { name: string; address: string; contact: string; }
interface Student { id:string; name:string; roll_no:string; class_name:string; gender?:string; parent_contact?:string; parent_email?:string; }
interface AttendanceRecord { id:string; student_id:string; status:'PRESENT'|'LATE'|'ABSENT'; date:string; }
interface ClassEntity { id:string; class_name:string; teacher_name?:string; current_enrollment?:number; max_enrollment?:number; }
interface StudentRisk { student:Student; attendanceRate:number; recentAbsenceStreak:number; lowAttendanceRisk:number; failureRisk:number; dropoutRisk:number; riskLevel:'critical'|'high'|'medium'|'low'; }

// ─── Storage ──────────────────────────────────────────────────────────────────
function loadSchoolInfo(): SchoolInfo {
  try { return JSON.parse(localStorage.getItem('school_info') ?? 'null') ?? { name:'', address:'', contact:'' }; }
  catch { return { name:'', address:'', contact:'' }; }
}
function useSchoolInfo(): SchoolInfo {
  const [info, setInfo] = useState<SchoolInfo>(loadSchoolInfo);
  useEffect(() => {
    const onUpdate = (e: Event) => setInfo((e as CustomEvent<SchoolInfo>).detail);
    window.addEventListener('schoolInfoUpdated', onUpdate);
    return () => window.removeEventListener('schoolInfoUpdated', onUpdate);
  }, []);
  return info;
}
const storage = {
  getStudents(): Student[] { try { return JSON.parse(localStorage.getItem('students') ?? '[]'); } catch { return []; } },
  getAttendance(): AttendanceRecord[] {
    try {
      const a: AttendanceRecord[] = JSON.parse(localStorage.getItem('attendance_records') ?? '[]');
      const b: AttendanceRecord[] = JSON.parse(localStorage.getItem('attendance') ?? '[]');
      const map = new Map<string, AttendanceRecord>();
      [...a, ...b].forEach((r) => map.set(r.id, r));
      return Array.from(map.values());
    } catch { return []; }
  },
  getClasses(): ClassEntity[] { try { return JSON.parse(localStorage.getItem('classes') ?? '[]'); } catch { return []; } },
};
const today = new Date().toISOString().split('T')[0];
function formatDate(d: string): string { return new Date(d).toLocaleDateString('en-ZA', { weekday:'short', day:'numeric', month:'short' }); }
function deduplicateStudents(students: Student[]): Student[] {
  const seen = new Set<string>();
  return students.filter((s) => { const k=`${s.class_name}::${s.roll_no}`; if(seen.has(k))return false; seen.add(k); return true; });
}
function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => { const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return d.toISOString().split('T')[0]; });
}

// ─── Risk Engine ──────────────────────────────────────────────────────────────
function calculateRisks(students: Student[], allAttendance: AttendanceRecord[]): StudentRisk[] {
  const last30 = lastNDays(30); const last14 = lastNDays(14);
  return students.map((s) => {
    const r30 = allAttendance.filter((a)=>a.student_id===s.id&&last30.includes(a.date));
    const r14 = allAttendance.filter((a)=>a.student_id===s.id&&last14.includes(a.date));
    const presentDays    = r30.filter((a)=>a.status==='PRESENT').length;
    const attendanceRate = r30.length>0 ? (presentDays/r30.length)*100 : 100;
    const sorted = [...r14].sort((a,b)=>b.date.localeCompare(a.date));
    let streak=0; for(const r of sorted){if(r.status==='ABSENT')streak++; else break;}
    const absent14      = r14.filter((a)=>a.status==='ABSENT').length;
    const recentAbsRate = r14.length>0 ? (absent14/r14.length)*100 : 0;
    const lowAttendanceRisk = Math.min(100,Math.round((attendanceRate<75?(75-attendanceRate)*2.5:0)+(recentAbsRate>30?(recentAbsRate-30)*0.5:0)));
    const failureRisk       = Math.min(100,Math.round((attendanceRate<80?(80-attendanceRate)*1.8:0)+(streak>=3?streak*8:0)+(recentAbsRate>40?(recentAbsRate-40)*0.6:0)));
    const dropoutRisk       = Math.min(100,Math.round((attendanceRate<60?(60-attendanceRate)*3:0)+(streak>=5?(streak-4)*12:0)+(recentAbsRate>50?(recentAbsRate-50)*0.8:0)));
    const maxRisk = Math.max(lowAttendanceRisk,failureRisk,dropoutRisk);
    const riskLevel = maxRisk>=70?'critical':maxRisk>=40?'high':maxRisk>=20?'medium':'low';
    return { student:s, attendanceRate:Math.round(attendanceRate), recentAbsenceStreak:streak, lowAttendanceRisk, failureRisk, dropoutRisk, riskLevel };
  });
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if(target===0){setVal(0);return;}
    const start=performance.now();
    const tick=(now: number)=>{ const p=Math.min((now-start)/duration,1); setVal(Math.round(target*(1-Math.pow(1-p,3)))); if(p<1)requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

// ─── School Banner ────────────────────────────────────────────────────────────
function SchoolBanner({ school }: { school: SchoolInfo }) {
  if (!school.name.trim()) return null;
  const initials = school.name.trim().split(/\s+/).slice(0,2).map(w=>w[0].toUpperCase()).join('');
  const h = new Date().getHours();
  const greet = h<12 ? 'Good morning' : h<17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  return (
    <div style={{ marginBottom:20, animation:'fadeUp .35s ease both' }}>
      <div style={{
        display:'flex', alignItems:'center', gap:16, padding:'16px 20px',
        borderRadius:16, background:'#1a2744', position:'relative', overflow:'hidden',
      }}>
        {/* subtle texture */}
        <div style={{ position:'absolute', inset:0, opacity:.06,
          backgroundImage:'radial-gradient(circle at 20% 50%,#fff 1px,transparent 1px),radial-gradient(circle at 80% 30%,#fff 1px,transparent 1px)',
          backgroundSize:'40px 40px', pointerEvents:'none' }}
        />
        <div style={{ position:'absolute', right:-30, top:-30, width:180, height:180,
          borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />

        {/* Monogram */}
        <div style={{ width:48, height:48, borderRadius:12, flexShrink:0,
          background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:17, fontWeight:900, color:'#fff', fontFamily:"'Nunito',sans-serif",
          letterSpacing:'-.01em', zIndex:1 }}>
          {initials}
        </div>

        {/* Text */}
        <div style={{ flex:1, minWidth:0, zIndex:1 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.45)',
            letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:2 }}>
            {greet} — {dateLabel}
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:'#fff', letterSpacing:'-.02em',
            lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {school.name}
          </div>
          {(school.address||school.contact) && (
            <div style={{ display:'flex', gap:12, marginTop:4, flexWrap:'wrap' }}>
              {school.address && <span style={{ fontSize:11, color:'rgba(255,255,255,.45)', display:'flex', alignItems:'center', gap:4 }}><MapPin size={10}/>{school.address}</span>}
              {school.contact && <span style={{ fontSize:11, color:'rgba(255,255,255,.45)', display:'flex', alignItems:'center', gap:4 }}><Phone size={10}/>{school.contact}</span>}
            </div>
          )}
        </div>

        {/* Date pill */}
        <div style={{ flexShrink:0, textAlign:'center', padding:'8px 14px',
          borderRadius:12, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.16)', zIndex:1 }}>
          <div style={{ fontSize:24, fontWeight:900, color:'#fff', lineHeight:1, fontFamily:"'Nunito',sans-serif" }}>
            {new Date().getDate()}
          </div>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.45)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginTop:1 }}>
            {new Date().toLocaleDateString('en-ZA',{month:'short'})} {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, bg, onClick }: {
  icon:React.ReactNode; label:string; value:string|number; sub?:string;
  color:string; bg:string; onClick?:()=>void;
}) {
  const num = typeof value==='number' ? value : 0;
  const animated = useCountUp(num);
  const display  = typeof value==='number' ? animated : value;

  return (
    <div
      onClick={onClick}
      style={{
        background:'#fff', borderRadius:14, border:'1px solid #e8edf3',
        padding:'16px 18px', cursor:onClick?'pointer':'default',
        transition:'transform .18s, box-shadow .18s',
        boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e=>{ if(onClick){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.09)';} }}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'; }}
    >
      <div style={{ width:40, height:40, borderRadius:10, background:bg,
        display:'flex', alignItems:'center', justifyContent:'center', color, marginBottom:10 }}>
        {icon}
      </div>
      <div style={{ fontSize:28, fontWeight:900, color:'#0f172a', lineHeight:1, fontFamily:"'Nunito',sans-serif" }}>{display}</div>
      <div style={{ fontSize:12, color:'#64748b', marginTop:3, fontWeight:600 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color, fontWeight:700, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Card({ children, style={} }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8edf3',
    boxShadow:'0 1px 4px rgba(0,0,0,0.05)', padding:'20px', ...style }}>{children}</div>;
}
function SectionTitle({ icon, children }: { icon?:React.ReactNode; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      {icon && <span style={{ color:'#2563eb' }}>{icon}</span>}
      <h2 style={{ fontSize:14, fontWeight:800, color:'#0f172a', letterSpacing:'-.01em', fontFamily:"'Nunito',sans-serif" }}>{children}</h2>
    </div>
  );
}

// ─── Risk Ring ────────────────────────────────────────────────────────────────
function RiskRing({ value, color, size=52 }: { value:number; color:string; size?:number }) {
  const r    = (size-8)/2;
  const circ = 2*Math.PI*r;
  const [dash, setDash] = useState(0);
  const animated = useCountUp(value);
  useEffect(()=>{ const t=setTimeout(()=>setDash((value/100)*circ),80); return ()=>clearTimeout(t); },[value,circ]);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
        justifyContent:'center', fontSize:size<=48?10:11, fontWeight:800, color }}>
        {animated}%
      </div>
    </div>
  );
}

// ─── AI Briefing Panel ────────────────────────────────────────────────────────
function AIBriefingPanel({ allStudents, allAttendance }: { allStudents:Student[]; allAttendance:AttendanceRecord[]; }) {
  const [briefing,  setBriefing]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true); setError(''); setBriefing('');
    const todayRecs  = allAttendance.filter((a)=>a.date===today);
    const last7      = lastNDays(7);
    const last30     = lastNDays(30);
    const present    = todayRecs.filter((a)=>a.status==='PRESENT').length;
    const absent     = todayRecs.filter((a)=>a.status==='ABSENT').length;
    const late       = todayRecs.filter((a)=>a.status==='LATE').length;
    const total      = allStudents.length;
    const todayRate  = total>0 ? Math.round((present/total)*100) : 0;
    const week7Recs  = allAttendance.filter((a)=>last7.includes(a.date));
    const week7P     = week7Recs.filter((a)=>a.status==='PRESENT').length;
    const week7Rate  = week7Recs.length>0 ? Math.round((week7P/week7Recs.length)*100) : 0;
    const month30Recs = allAttendance.filter((a)=>last30.includes(a.date));
    const month30P    = month30Recs.filter((a)=>a.status==='PRESENT').length;
    const month30Rate = month30Recs.length>0 ? Math.round((month30P/month30Recs.length)*100) : 0;
    const classNames  = Array.from(new Set(allStudents.map((s)=>s.class_name).filter(Boolean))).sort();
    const classStats  = classNames.map((cn)=>{
      const sts=allStudents.filter((s)=>s.class_name===cn);
      const recs=todayRecs.filter((r)=>sts.some((s)=>s.id===r.student_id));
      const p=recs.filter((r)=>r.status==='PRESENT').length;
      const pct=sts.length>0?Math.round((p/sts.length)*100):0;
      return `${cn}: ${pct}% (${p}/${sts.length})`;
    }).join(', ');
    const risks    = calculateRisks(allStudents, allAttendance);
    const atRisk   = risks.filter((r)=>r.lowAttendanceRisk>=20).length;
    const critical = risks.filter((r)=>r.riskLevel==='critical').length;
    const userMsg  = `Today's date: ${today}\nTotal students: ${total}\nToday: ${present} present, ${absent} absent, ${late} late (${todayRate}%)\n7-day avg: ${week7Rate}%\n30-day avg: ${month30Rate}%\nClass breakdown: ${classStats||'no data'}\nAt-risk: ${atRisk}, Critical: ${critical}`;
    try {
      const raw = await groqChat(
        `You are a school attendance analyst. Write exactly 3 plain-text sentences for a principal. Sentence 1: today's attendance summary. Sentence 2: trend vs 7/30-day averages. Sentence 3: most urgent action needed. No markdown.`,
        userMsg, { maxTokens:220, temperature:.55 },
      );
      setBriefing(raw.trim()); setGenerated(true);
    } catch(e: any) {
      const msg=String(e?.message??e);
      setError(msg.includes('MISSING_KEY') ? 'Add VITE_GROQ_API_KEY=gsk_... to your .env to enable AI briefings.' : `AI error: ${msg}`);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ borderRadius:14, border:'1px solid #dbeafe', background:'#f0f7ff',
      overflow:'hidden', marginBottom:20, animation:'fadeUp .45s ease both .08s' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'16px 20px', flexWrap:'wrap', gap:10, borderBottom:'1px solid #dbeafe' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#2563eb',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Bot size={20} color="#fff"/>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a8a', fontFamily:"'Nunito',sans-serif" }}>AI Daily Briefing</div>
            <div style={{ fontSize:11, color:'#3b82f6', fontWeight:600, marginTop:1 }}>
              Powered by Groq · {new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long'})}
            </div>
          </div>
        </div>
        <button onClick={generate} disabled={loading} style={{
          display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10,
          border:'none', background:loading?'#e2e8f0':'#2563eb', color:loading?'#94a3b8':'#fff',
          fontWeight:700, fontSize:13, cursor:loading?'not-allowed':'pointer',
          fontFamily:"'Nunito',sans-serif", transition:'background .2s',
        }}>
          {loading
            ? <><span style={{ display:'inline-block', width:13, height:13, borderRadius:'50%',
                border:'2.5px solid rgba(37,99,235,.3)', borderTopColor:'#2563eb',
                animation:'spin .7s linear infinite' }}/> Generating…</>
            : generated ? <><RefreshCw size={13}/> Regenerate</> : <><Sparkles size={13}/> Generate Briefing</>
          }
        </button>
      </div>
      {error && (
        <div style={{ margin:'16px 20px', padding:'12px 14px', borderRadius:10,
          background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626',
          fontSize:13, display:'flex', gap:8, alignItems:'flex-start' }}>
          <AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }}/>{error}
        </div>
      )}
      {briefing && (
        <div style={{ padding:'16px 20px' }}>
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #bfdbfe',
            padding:'16px 18px', animation:'fadeUp .3s ease both' }}>
            <p style={{ margin:0, fontSize:14, color:'#1e293b', lineHeight:1.75, fontWeight:500 }}>{briefing}</p>
          </div>
          <div style={{ marginTop:6, fontSize:10, color:'#93c5fd', textAlign:'right' }}>
            Generated by Groq · llama-3.3-70b-versatile
          </div>
        </div>
      )}
      {!briefing&&!loading&&!error&&(
        <div style={{ padding:'14px 20px', fontSize:12, color:'#60a5fa', display:'flex', alignItems:'center', gap:6 }}>
          <Zap size={12}/> Click "Generate Briefing" for a 3-sentence AI summary of today's attendance.
        </div>
      )}
    </div>
  );
}

// ─── Risk Alerts ──────────────────────────────────────────────────────────────
const RISK_TABS = [
  { key:'lowAttendanceRisk' as const, Icon:TrendingDown, label:'Low Attendance', shortLabel:'Attendance', desc:'Students below the 75% threshold in the past 30 days.', color:'#d97706', ringColor:'#f59e0b', bg:'#fffbeb', border:'#fde68a', textColor:'#92400e', badgeBg:'#fefce8' },
  { key:'failureRisk'       as const, Icon:AlertTriangle, label:'Failure Risk',  shortLabel:'Failure',    desc:'Students at risk of academic failure due to absences.', color:'#ea580c', ringColor:'#f97316', bg:'#fff7ed', border:'#fed7aa', textColor:'#9a3412', badgeBg:'#fff7ed' },
  { key:'dropoutRisk'       as const, Icon:AlertOctagon, label:'Dropout Risk',   shortLabel:'Dropout',    desc:'Severe absence patterns indicating disengagement.', color:'#dc2626', ringColor:'#ef4444', bg:'#fef2f2', border:'#fecaca', textColor:'#991b1b', badgeBg:'#fef2f2' },
] as const;
const RISK_BADGE: Record<StudentRisk['riskLevel'],{bg:string;color:string;label:string}> = {
  critical: {bg:'#fee2e2',color:'#dc2626',label:'CRITICAL'},
  high:     {bg:'#fff7ed',color:'#ea580c',label:'HIGH'    },
  medium:   {bg:'#fefce8',color:'#ca8a04',label:'MEDIUM'  },
  low:      {bg:'#f0fdf4',color:'#16a34a',label:'LOW'     },
};

function AIRiskAlerts({ allStudents, allAttendance }: { allStudents:Student[]; allAttendance:AttendanceRecord[]; }) {
  const [activeTab, setActiveTab] = useState<typeof RISK_TABS[number]['key']>('lowAttendanceRisk');
  const [expanded,  setExpanded]  = useState<string|null>(null);
  const risks   = calculateRisks(allStudents, allAttendance);
  const tab     = RISK_TABS.find((t)=>t.key===activeTab)!;
  const atRisk  = risks.filter((r)=>r[activeTab]>0).sort((a,b)=>b[activeTab]-a[activeTab]);
  const tabCounts = { lowAttendanceRisk:risks.filter((r)=>r.lowAttendanceRisk>=20).length, failureRisk:risks.filter((r)=>r.failureRisk>=20).length, dropoutRisk:risks.filter((r)=>r.dropoutRisk>=20).length };
  const avgRisk     = atRisk.length>0 ? Math.round(atRisk.reduce((s,r)=>s+r[activeTab],0)/atRisk.length) : 0;
  const criticalCnt = atRisk.filter((r)=>r[activeTab]>=70).length;

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8edf3',
      boxShadow:'0 1px 4px rgba(0,0,0,0.05)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid #f1f5f9',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ width:38, height:38, borderRadius:10, background:'#1a2744',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <ShieldAlert size={17} color="#fff"/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#0f172a', fontFamily:"'Nunito',sans-serif" }}>AI Risk Alerts</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>Attendance pattern analysis · Last 30 days</div>
        </div>
        {criticalCnt>0 && (
          <div style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2',
            border:'1px solid #fecaca', padding:'4px 10px', borderRadius:999 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', animation:'pulse 1.4s infinite' }}/>
            <span style={{ fontSize:11, fontWeight:800, color:'#dc2626' }}>{criticalCnt} Critical</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9', background:'#fafafa', overflowX:'auto' }}>
        {RISK_TABS.map((rt)=>{
          const count=tabCounts[rt.key]; const isActive=activeTab===rt.key; const TabIcon=rt.Icon;
          return (
            <button key={rt.key} onClick={()=>{setActiveTab(rt.key);setExpanded(null);}} style={{
              flex:1, minWidth:100, padding:'10px 8px 8px', border:'none', cursor:'pointer',
              background:isActive?'#fff':'transparent',
              borderBottom:isActive?`2.5px solid ${rt.color}`:'2.5px solid transparent',
              transition:'all .2s', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <TabIcon size={13} color={isActive?rt.color:'#94a3b8'}/>
                <span style={{ fontSize:11, fontWeight:700, color:isActive?rt.color:'#94a3b8', whiteSpace:'nowrap' }}>{rt.shortLabel}</span>
              </div>
              <div style={{ minWidth:20, height:20, borderRadius:999, padding:'0 5px',
                background:count>0?rt.color:'#e2e8f0', color:count>0?'#fff':'#94a3b8',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>{count}</div>
            </button>
          );
        })}
      </div>

      <div style={{ padding:'16px 20px' }}>
        {/* Summary */}
        <div style={{ display:'flex', gap:16, padding:'12px 16px', borderRadius:10,
          background:tab.bg, border:`1px solid ${tab.border}`, marginBottom:14,
          flexWrap:'wrap', alignItems:'center' }}>
          {[{ val:atRisk.length, label:'At Risk'  },
            { val:avgRisk+'%',   label:'Avg Score' },
            { val:criticalCnt,   label:'Critical'  }].map((m,i)=>(
            <React.Fragment key={i}>
              {i>0&&<div style={{ width:1, height:32, background:tab.border, flexShrink:0 }}/>}
              <div style={{ minWidth:64 }}>
                <div style={{ fontSize:22, fontWeight:900, color:tab.color, lineHeight:1, fontFamily:"'Nunito',sans-serif" }}>{m.val}</div>
                <div style={{ fontSize:10, color:tab.textColor, fontWeight:700, marginTop:1, textTransform:'uppercase', letterSpacing:'.05em' }}>{m.label}</div>
              </div>
            </React.Fragment>
          ))}
          <div style={{ flex:1, fontSize:11, color:tab.textColor, paddingLeft:4, lineHeight:1.5, minWidth:140 }}>{tab.desc}</div>
        </div>

        {/* List */}
        {atRisk.length===0 ? (
          <div style={{ textAlign:'center', padding:'28px 0' }}>
            <PartyPopper size={32} color="#10b981" style={{ margin:'0 auto 8px' }}/>
            <div style={{ fontSize:14, fontWeight:700, color:'#374151' }}>No students flagged</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:3 }}>All students are within safe attendance thresholds.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:360, overflowY:'auto', paddingRight:2 }}>
            {atRisk.map((r)=>{
              const badge=RISK_BADGE[r.riskLevel]; const riskVal=r[activeTab];
              const isOpen=expanded===r.student.id; const isCrit=riskVal>=70;
              return (
                <div key={r.student.id} style={{ borderRadius:10,
                  border:`1px solid ${isCrit?tab.border:'#e8edf3'}`,
                  background:isCrit?tab.badgeBg:'#f8fafc', overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor:'pointer' }}
                    onClick={()=>setExpanded(isOpen?null:r.student.id)}>
                    <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:tab.badgeBg,
                      border:`2px solid ${tab.border}`, display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:900, fontSize:13, color:tab.color }}>
                      {r.student.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.student.name}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>
                        Class {r.student.class_name} · Roll {r.student.roll_no} ·{' '}
                        <span style={{ color:r.attendanceRate<75?'#ef4444':'#10b981', fontWeight:700 }}>{r.attendanceRate}%</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                      <RiskRing value={riskVal} color={tab.ringColor} size={46}/>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:999, background:badge.bg, color:badge.color, letterSpacing:'.06em' }}>{badge.label}</span>
                      <ChevronDown size={13} color="#cbd5e1" style={{ transition:'transform .2s', transform:isOpen?'rotate(180deg)':'none' }}/>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop:'1px dashed #e2e8f0', padding:'12px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
                        {RISK_TABS.map((rt)=>{
                          const SubIcon=rt.Icon;
                          return (
                            <div key={rt.key} style={{ padding:'10px 8px', borderRadius:9, textAlign:'center',
                              background:r[rt.key]>0?rt.badgeBg:'#f8fafc', border:`1px solid ${r[rt.key]>0?rt.border:'#e2e8f0'}` }}>
                              <SubIcon size={16} color={r[rt.key]>0?rt.color:'#cbd5e1'} style={{ margin:'0 auto 3px' }}/>
                              <div style={{ fontSize:17, fontWeight:900, color:r[rt.key]>0?rt.color:'#94a3b8', lineHeight:1 }}>{r[rt.key]}%</div>
                              <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginTop:2, textTransform:'uppercase', letterSpacing:'.04em' }}>{rt.shortLabel}</div>
                            </div>
                          );
                        })}
                      </div>
                      {r.recentAbsenceStreak>0 && (
                        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 10px',
                          borderRadius:9, background:'#fef2f2', border:'1px solid #fecaca' }}>
                          <Flame size={14} color="#dc2626"/>
                          <span style={{ fontSize:12, fontWeight:700, color:'#991b1b' }}>
                            {r.recentAbsenceStreak} consecutive absent day{r.recentAbsenceStreak!==1?'s':''} — follow-up recommended
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Header button ────────────────────────────────────────────────────────────
function NavBtn({ onClick, primary=false, icon, children }: { onClick:()=>void; primary?:boolean; icon:React.ReactNode; children:React.ReactNode; }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:10,
      border:primary?'none':'1.5px solid #e2e8f0',
      background:primary?'#1a2744':'#fff', color:primary?'#fff':'#374151',
      fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif",
      boxShadow:primary?'0 4px 14px rgba(26,39,68,.22)':'none',
      transition:'opacity .15s',
      whiteSpace:'nowrap',
    }}
    onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
    onMouseLeave={e=>e.currentTarget.style.opacity='1'}
    >
      {icon}{children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function TeacherDashboard({ assignedClass }: { assignedClass:string }): React.ReactElement {
  const navigate      = useNavigate();
  const school        = useSchoolInfo();
  const allStudents   = deduplicateStudents(storage.getStudents());
  const allAttendance = storage.getAttendance();

  const classStudents = allStudents.filter((s)=>s.class_name.trim().toLowerCase()===assignedClass.trim().toLowerCase());
  const todayRecords  = allAttendance.filter((a)=>a.date===today&&classStudents.some((s)=>s.id===a.student_id));
  const present  = todayRecords.filter((a)=>a.status==='PRESENT').length;
  const absent   = todayRecords.filter((a)=>a.status==='ABSENT').length;
  const late     = todayRecords.filter((a)=>a.status==='LATE').length;
  const unmarked = classStudents.length-todayRecords.length;
  const attPct   = classStudents.length>0 ? Math.round((present/classStudents.length)*100) : 0;

  const days7     = lastNDays(7);
  const trendData = days7.map((date)=>{
    const dayRecs=allAttendance.filter((a)=>a.date===date&&classStudents.some((s)=>s.id===a.student_id));
    const p=dayRecs.filter((a)=>a.status==='PRESENT').length;
    return { day:formatDate(date), pct:classStudents.length>0?Math.round((p/classStudents.length)*100):0, present:p, absent:classStudents.length-p };
  });

  const absentStudents   = classStudents.filter((s)=>todayRecords.some((a)=>a.student_id===s.id&&a.status==='ABSENT'));
  const unmarkedStudents = classStudents.filter((s)=>!todayRecords.some((a)=>a.student_id===s.id));

  return (
    <div style={{ fontFamily:"'Nunito',sans-serif", maxWidth:1200 }}>
      <style>{GLOBAL_CSS}</style>
      <SchoolBanner school={school}/>

      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-start',
        justifyContent:'space-between', flexWrap:'wrap', gap:12, animation:'fadeUp .4s ease both' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <LayoutDashboard size={20} color="#2563eb"/>
            <h1 style={{ fontSize:22, fontWeight:900, color:'#0f172a', letterSpacing:'-.02em', margin:0 }}>
              Class {assignedClass}
            </h1>
          </div>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'3px 0 0', fontWeight:600 }}>
            {new Date().toLocaleDateString('en-ZA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>
        <NavBtn primary onClick={()=>navigate('/attendance')} icon={<ClipboardList size={14}/>}>
          Mark Attendance
        </NavBtn>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom:20, animation:'fadeUp .45s ease both .05s' }}>
        <StatCard icon={<Users size={20}/>}        label="My Students"   value={classStudents.length} color="#2563eb" bg="#dbeafe"/>
        <StatCard icon={<CheckCircle2 size={20}/>} label="Present Today" value={present}  sub={`${attPct}% attendance`} color="#16a34a" bg="#dcfce7" onClick={()=>navigate('/attendance')}/>
        <StatCard icon={<XCircle size={20}/>}      label="Absent Today"  value={absent}   sub={absent>0?'Needs attention':'All good!'} color="#dc2626" bg="#fee2e2"/>
        <StatCard icon={<Clock size={20}/>}        label="Late Today"    value={late}     color="#d97706" bg="#fef3c7"/>
        <StatCard icon={<ClipboardList size={20}/>}label="Unmarked"      value={unmarked} sub={unmarked>0?'Mark now':'All done!'} color="#7c3aed" bg="#ede9fe" onClick={()=>navigate('/attendance')}/>
      </div>

      {/* Progress */}
      <div style={{ marginBottom:20, animation:'fadeUp .5s ease both .1s' }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>Today's Attendance Progress</span>
            <span style={{ fontSize:14, fontWeight:800, color:attPct>=75?'#16a34a':'#dc2626' }}>{attPct}%</span>
          </div>
          <div style={{ height:9, borderRadius:999, background:'#f1f5f9', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999, transition:'width 1s cubic-bezier(.4,0,.2,1)',
              background:attPct>=75?'linear-gradient(90deg,#16a34a,#4ade80)':'linear-gradient(90deg,#dc2626,#f87171)',
              width:`${attPct}%` }}/>
          </div>
          <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
            {[{label:'Present',val:present,color:'#16a34a',Icon:CheckCircle2},
              {label:'Absent',val:absent,color:'#dc2626',Icon:XCircle},
              {label:'Late',val:late,color:'#d97706',Icon:Clock},
              {label:'Unmarked',val:unmarked,color:'#94a3b8',Icon:ClipboardList}].map((item)=>(
              <div key={item.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <item.Icon size={11} color={item.color}/>
                <span style={{ fontSize:11, color:'#64748b' }}>{item.label}</span>
                <span style={{ fontSize:12, fontWeight:800, color:item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="chart-grid" style={{ marginBottom:20, animation:'fadeUp .55s ease both .15s' }}>
        <Card>
          <SectionTitle icon={<Activity size={14}/>}>7-Day Attendance Trend</SectionTitle>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="day" stroke="#cbd5e1" tick={{fontSize:10}}/>
              <YAxis domain={[0,100]} stroke="#cbd5e1" tick={{fontSize:10}} unit="%"/>
              <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e2e8f0',fontSize:11}} formatter={(v:number)=>[`${v}%`,'Attendance']}/>
              <Line type="monotone" dataKey="pct" stroke="#2563eb" strokeWidth={2.5} dot={{fill:'#2563eb',r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle icon={<BarChart2 size={14}/>}>Present vs Absent (7 days)</SectionTitle>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={trendData} barSize={13}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="day" stroke="#cbd5e1" tick={{fontSize:10}}/>
              <YAxis stroke="#cbd5e1" tick={{fontSize:10}}/>
              <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e2e8f0',fontSize:11}}/>
              <Bar dataKey="present" fill="#4ade80" radius={[4,4,0,0]} name="Present"/>
              <Bar dataKey="absent"  fill="#fca5a5" radius={[4,4,0,0]} name="Absent"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Absent + Unmarked */}
      <div className="list-grid" style={{ animation:'fadeUp .6s ease both .2s' }}>
        <Card>
          <SectionTitle icon={<XCircle size={14}/>}>Absent Today ({absentStudents.length})</SectionTitle>
          {absentStudents.length===0 ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <PartyPopper size={26} color="#16a34a" style={{ margin:'0 auto 6px' }}/>
              <span style={{ color:'#94a3b8', fontSize:13 }}>No absences today!</span>
            </div>
          ) : (
            <div style={{ maxHeight:260, overflowY:'auto' }}>
              {absentStudents.map((s)=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
                  borderRadius:9, background:'#fef2f2', border:'1px solid #fecaca', marginBottom:7 }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:'#fee2e2',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:800, color:'#dc2626', flexShrink:0 }}>{s.name[0].toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>Roll {s.roll_no}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, color:'#dc2626', background:'#fee2e2', padding:'2px 7px', borderRadius:999 }}>ABSENT</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<ClipboardList size={14}/>}>Not Yet Marked ({unmarkedStudents.length})</SectionTitle>
          {unmarkedStudents.length===0 ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <CheckCircle2 size={26} color="#16a34a" style={{ margin:'0 auto 6px' }}/>
              <span style={{ color:'#94a3b8', fontSize:13 }}>All students marked!</span>
            </div>
          ) : (
            <div style={{ maxHeight:260, overflowY:'auto' }}>
              {unmarkedStudents.map((s)=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
                  borderRadius:9, background:'#f8fafc', border:'1px solid #e2e8f0', marginBottom:7 }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:'#e2e8f0',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:800, color:'#64748b', flexShrink:0 }}>{s.name[0].toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>Roll {s.roll_no}</div>
                  </div>
                  <button onClick={()=>navigate('/attendance')} style={{ display:'flex', alignItems:'center', gap:4,
                    fontSize:11, fontWeight:700, color:'#2563eb', background:'#dbeafe',
                    padding:'3px 10px', borderRadius:999, border:'none', cursor:'pointer' }}>
                    Mark <ArrowRight size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function PrincipalDashboard(): React.ReactElement {
  const navigate      = useNavigate();
  const school        = useSchoolInfo();
  const allStudents   = deduplicateStudents(storage.getStudents());
  const allAttendance = storage.getAttendance();
  const allClasses    = storage.getClasses();

  const todayRecords = allAttendance.filter((a)=>a.date===today);
  const present      = todayRecords.filter((a)=>a.status==='PRESENT').length;
  const absent       = todayRecords.filter((a)=>a.status==='ABSENT').length;
  const late         = todayRecords.filter((a)=>a.status==='LATE').length;

  const days7     = lastNDays(7);
  const trendData = days7.map((date)=>{
    const recs=allAttendance.filter((a)=>a.date===date);
    const p=recs.filter((a)=>a.status==='PRESENT').length;
    return { day:formatDate(date), pct:allStudents.length>0?Math.round((p/allStudents.length)*100):0 };
  });

  const classNames     = Array.from(new Set(allStudents.map((s)=>s.class_name).filter(Boolean))).sort();
  const classBreakdown = classNames.map((cn)=>{
    const sts=allStudents.filter((s)=>s.class_name===cn);
    const recs=todayRecords.filter((r)=>sts.some((s)=>s.id===r.student_id));
    const p=recs.filter((r)=>r.status==='PRESENT').length;
    const pct=sts.length>0?Math.round((p/sts.length)*100):0;
    return { class:cn, total:sts.length, present:p, pct };
  });

  const risks        = calculateRisks(allStudents, allAttendance);
  const overallPct   = allStudents.length>0 ? Math.round((present/allStudents.length)*100) : 0;
  const QUICK_ALERTS = [
    { label:'Below 75% Attendance', value:risks.filter((r)=>r.attendanceRate<75).length, color:'#d97706', bg:'#fef3c7', Icon:TrendingDown },
    { label:'Absent Today',         value:absent,  color:'#dc2626', bg:'#fee2e2', Icon:XCircle },
    { label:'Late Today',           value:late,    color:'#ea580c', bg:'#ffedd5', Icon:Clock   },
  ];

  return (
    <div style={{ fontFamily:"'Nunito',sans-serif", maxWidth:1200 }}>
      <style>{GLOBAL_CSS}</style>
      <SchoolBanner school={school}/>

      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-start',
        justifyContent:'space-between', flexWrap:'wrap', gap:12, animation:'fadeUp .4s ease both' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <LayoutDashboard size={20} color="#2563eb"/>
            <h1 style={{ fontSize:22, fontWeight:900, color:'#0f172a', letterSpacing:'-.02em', margin:0 }}>School Dashboard</h1>
          </div>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'3px 0 0', fontWeight:600 }}>
            {new Date().toLocaleDateString('en-ZA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <NavBtn onClick={()=>navigate('/students')} icon={<Users size={13}/>}>Students</NavBtn>
          <NavBtn primary onClick={()=>navigate('/attendance')} icon={<ClipboardList size={13}/>}>Attendance</NavBtn>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom:20, animation:'fadeUp .45s ease both .05s' }}>
        <StatCard icon={<Users size={20}/>}        label="Total Students" value={allStudents.length} color="#2563eb" bg="#dbeafe" onClick={()=>navigate('/students')}/>
        <StatCard icon={<School size={20}/>}       label="Total Classes"  value={allClasses.length||classNames.length} color="#7c3aed" bg="#ede9fe" onClick={()=>navigate('/classes')}/>
        <StatCard icon={<CheckCircle2 size={20}/>} label="Present Today"  value={present} sub={allStudents.length>0?`${overallPct}%`:'—'} color="#16a34a" bg="#dcfce7"/>
        <StatCard icon={<XCircle size={20}/>}      label="Absent Today"   value={absent}  color="#dc2626" bg="#fee2e2"/>
        <StatCard icon={<Clock size={20}/>}        label="Late Today"     value={late}    color="#d97706" bg="#fef3c7"/>
      </div>

      {/* Overall rate banner */}
      <div style={{ marginBottom:20, animation:'fadeUp .48s ease both .08s' }}>
        <Card style={{ padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>School-Wide Attendance Today</span>
            <span style={{ fontSize:14, fontWeight:800, color:overallPct>=75?'#16a34a':'#dc2626' }}>{overallPct}%</span>
          </div>
          <div style={{ height:9, borderRadius:999, background:'#f1f5f9', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999, transition:'width 1s cubic-bezier(.4,0,.2,1)',
              background:overallPct>=75?'linear-gradient(90deg,#16a34a,#4ade80)':'linear-gradient(90deg,#dc2626,#f87171)',
              width:`${overallPct}%` }}/>
          </div>
        </Card>
      </div>

      {/* Trend + Alerts */}
      <div className="two-col" style={{ marginBottom:20, animation:'fadeUp .5s ease both .1s' }}>
        <Card>
          <SectionTitle icon={<Activity size={14}/>}>School-Wide Attendance Trend (7 days)</SectionTitle>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="day" stroke="#cbd5e1" tick={{fontSize:10}}/>
              <YAxis domain={[0,100]} stroke="#cbd5e1" tick={{fontSize:10}} unit="%"/>
              <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e2e8f0',fontSize:11}} formatter={(v:number)=>[`${v}%`,'Attendance']}/>
              <Line type="monotone" dataKey="pct" stroke="#2563eb" strokeWidth={2.5} dot={{fill:'#2563eb',r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle icon={<AlertOctagon size={14}/>}>Quick Alerts</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {QUICK_ALERTS.map((m)=>(
              <div key={m.label}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <m.Icon size={12} color={m.color}/>
                    <span style={{ fontSize:12, color:'#374151', fontWeight:700 }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color:m.color }}>{m.value}</span>
                </div>
                <div style={{ height:7, borderRadius:999, background:'#f1f5f9', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:999, background:m.color, transition:'width 1s',
                    width:`${Math.min(100,(m.value/Math.max(allStudents.length,1))*100)}%` }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AI Briefing */}
      <AIBriefingPanel allStudents={allStudents} allAttendance={allAttendance}/>

      {/* AI Risk Alerts */}
      <div style={{ marginBottom:20, animation:'fadeUp .55s ease both .15s' }}>
        <AIRiskAlerts allStudents={allStudents} allAttendance={allAttendance}/>
      </div>

      {/* Class Breakdown */}
      <div style={{ animation:'fadeUp .6s ease both .2s' }}>
        <Card>
          <SectionTitle icon={<BarChart2 size={14}/>}>Class-by-Class Today</SectionTitle>
          {classBreakdown.length===0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 0', gap:8 }}>
              <BookOpen size={30} color="#cbd5e1"/>
              <p style={{ fontSize:13, color:'#94a3b8', margin:0, textAlign:'center' }}>No classes yet. Add classes and students first.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {classBreakdown.map((cls)=>(
                <div key={cls.class} style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ width:56, fontSize:13, fontWeight:700, color:'#2563eb', flexShrink:0 }}>{cls.class}</div>
                  <div style={{ flex:1, minWidth:80 }}>
                    <div style={{ height:8, borderRadius:999, background:'#f1f5f9', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:999, transition:'width 1s',
                        background:cls.pct>=75?'#16a34a':'#dc2626', width:`${cls.pct}%` }}/>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', flexShrink:0, minWidth:90, textAlign:'right' }}>
                    <span style={{ fontWeight:800, color:cls.pct>=75?'#16a34a':'#dc2626' }}>{cls.pct}%</span>
                    <span style={{ marginLeft:6, color:'#94a3b8' }}>{cls.present}/{cls.total}</span>
                  </div>
                  <button onClick={()=>navigate('/attendance')} style={{ display:'flex', alignItems:'center',
                    gap:4, fontSize:11, fontWeight:700, color:'#2563eb', background:'#dbeafe',
                    padding:'4px 11px', borderRadius:999, border:'none', cursor:'pointer', flexShrink:0 }}>
                    View <ArrowRight size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function Dashboard(): React.ReactElement {
  const { user } = useAuth();
  if(!user) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>;
  if(user.role==='TEACHER') return <TeacherDashboard assignedClass={user.assignedClass??''}/>;
  return <PrincipalDashboard/>;
}