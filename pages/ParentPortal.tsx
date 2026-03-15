import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../src/context/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Student {
  id: string; name: string; roll_no: string; class_name: string;
  gender?: string; parent_name?: string; parent_contact?: string; parent_email?: string;
}
interface AttendanceRecord {
  id: string; student_id: string; status: 'PRESENT' | 'LATE' | 'ABSENT'; date: string;
}
interface LeaveAttachment {
  name: string;    // original filename
  type: string;    // MIME type
  size: number;    // bytes
  dataUrl: string; // base64 data URL
}
interface LeaveRequest {
  id: string; student_id: string; student_name: string; class_name: string;
  from_date: string; to_date: string; reason: string;
  leave_type: 'MEDICAL' | 'FAMILY' | 'PERSONAL' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string; notes?: string;
  parent_name?: string; parent_contact?: string; parent_email?: string;
  attachments?: LeaveAttachment[];
}
interface StaffLeaveNotification {
  id: string; student_id: string; student_name: string; class_name: string;
  from_date: string; to_date: string; reason: string;
  leave_type: 'MEDICAL' | 'FAMILY' | 'PERSONAL' | 'OTHER';
  submitted_at: string; read: boolean;
  parent_name?: string; parent_contact?: string;
  attachments?: LeaveAttachment[];
}
interface AlertNotif {
  id: string; kind: 'absent' | 'late' | 'streak' | 'low_rate'; date: string;
  title: string; body: string; read: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA LAYER
// ═══════════════════════════════════════════════════════════════════════════════

const DB = {
  attendance(): AttendanceRecord[] {
    try {
      const a: AttendanceRecord[] = JSON.parse(localStorage.getItem('attendance_records') ?? '[]');
      const b: AttendanceRecord[] = JSON.parse(localStorage.getItem('attendance') ?? '[]');
      const map = new Map<string, AttendanceRecord>();
      [...b, ...a].forEach(r => { if (r?.id && r?.student_id) map.set(r.id, r); });
      return Array.from(map.values());
    } catch { return []; }
  },
  students(): Student[] {
    try {
      const raw: Student[] = JSON.parse(localStorage.getItem('students') ?? '[]');
      const seen = new Set<string>();
      return raw.filter(s => {
        const k = `${s.class_name}::${s.roll_no}`;
        if (seen.has(k)) return false; seen.add(k); return true;
      });
    } catch { return []; }
  },
  leaves(): LeaveRequest[] {
    try { return JSON.parse(localStorage.getItem('leave_requests') ?? '[]'); } catch { return []; }
  },
  saveLeaves(r: LeaveRequest[]) { localStorage.setItem('leave_requests', JSON.stringify(r)); },
  staffNotifications(): StaffLeaveNotification[] {
    try { return JSON.parse(localStorage.getItem('staff_leave_notifications') ?? '[]'); } catch { return []; }
  },
  saveStaffNotifications(n: StaffLeaveNotification[]) {
    localStorage.setItem('staff_leave_notifications', JSON.stringify(n));
  },
  alerts(): AlertNotif[] {
    try { return JSON.parse(localStorage.getItem('pp_alerts') ?? '[]'); } catch { return []; }
  },
  saveAlerts(a: AlertNotif[]) { localStorage.setItem('pp_alerts', JSON.stringify(a)); },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TODAY = new Date().toISOString().split('T')[0];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME  = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const ST_CFG = {
  PRESENT: { label: 'Present', dot: '#22c55e', glow: '#22c55e44', bg: 'rgba(34,197,94,.12)',  border: 'rgba(34,197,94,.3)',  text: '#4ade80', pill: '#16a34a', pillBg: '#dcfce7' },
  LATE:    { label: 'Late',    dot: '#f59e0b', glow: '#f59e0b44', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)', text: '#fbbf24', pill: '#b45309', pillBg: '#fef3c7' },
  ABSENT:  { label: 'Absent',  dot: '#ef4444', glow: '#ef444444', bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.3)',  text: '#f87171', pill: '#b91c1c', pillBg: '#fee2e2' },
} as const;

const LV_CFG = {
  MEDICAL:  { icon: '🏥', label: 'Medical Leave',   accent: '#38bdf8', bg: 'rgba(56,189,248,.15)',  border: 'rgba(56,189,248,.3)'  },
  FAMILY:   { icon: '🏠', label: 'Family Matter',   accent: '#a78bfa', bg: 'rgba(167,139,250,.15)', border: 'rgba(167,139,250,.3)' },
  PERSONAL: { icon: '👤', label: 'Personal Reason', accent: '#34d399', bg: 'rgba(52,211,153,.15)',  border: 'rgba(52,211,153,.3)'  },
  OTHER:    { icon: '📋', label: 'Other',            accent: '#94a3b8', bg: 'rgba(148,163,184,.12)', border: 'rgba(148,163,184,.25)' },
};

const LS_CFG = {
  PENDING:  { icon: '⏳', label: 'Under Review', color: '#fbbf24', bg: 'rgba(251,191,36,.12)',  border: 'rgba(251,191,36,.3)'  },
  APPROVED: { icon: '✅', label: 'Approved',     color: '#4ade80', bg: 'rgba(74,222,128,.12)',  border: 'rgba(74,222,128,.3)'  },
  REJECTED: { icon: '✕',  label: 'Not Approved', color: '#f87171', bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.3)' },
};

const ALERT_CFG = {
  absent:   { icon: '🚨', accent: '#f87171', bg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.25)' },
  late:     { icon: '⏰', accent: '#fbbf24', bg: 'rgba(251,191,36,.08)',  border: 'rgba(251,191,36,.25)'  },
  streak:   { icon: '🔥', accent: '#fb923c', bg: 'rgba(251,146,60,.08)',  border: 'rgba(251,146,60,.25)'  },
  low_rate: { icon: '📉', accent: '#c084fc', bg: 'rgba(192,132,252,.08)', border: 'rgba(192,132,252,.25)' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function nDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split('T')[0];
  });
}
function monthDays(y: number, m: number): string[] {
  const days: string[] = []; const d = new Date(y, m, 1);
  while (d.getMonth() === m) { days.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  return days;
}
function fmtFull(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtMed(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtShort(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function buildAlerts(records: AttendanceRecord[], sid: string): AlertNotif[] {
  const mine = records.filter(r => r.student_id === sid);
  const out: AlertNotif[] = [];
  const todayRec = mine.find(r => r.date === TODAY);
  if (todayRec?.status === 'ABSENT')
    out.push({ id: `absent-${TODAY}`, kind: 'absent', date: TODAY, read: false, title: 'Absent Today', body: `Your child was marked absent on ${fmtFull(TODAY)}.` });
  if (todayRec?.status === 'LATE')
    out.push({ id: `late-${TODAY}`, kind: 'late', date: TODAY, read: false, title: 'Arrived Late Today', body: `Your child arrived late on ${fmtFull(TODAY)}.` });
  const sorted = [...mine].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const r of sorted) { if (r.status === 'ABSENT') streak++; else break; }
  if (streak >= 3)
    out.push({ id: `streak-${streak}`, kind: 'streak', date: TODAY, read: false, title: `${streak} Consecutive Absences`, body: `Your child has missed ${streak} school days in a row. Please contact the school urgently.` });
  const r30 = mine.filter(r => nDays(30).includes(r.date));
  const rate = r30.length > 0 ? Math.round(r30.filter(r => r.status === 'PRESENT').length / r30.length * 100) : 100;
  if (rate < 75 && r30.length >= 5)
    out.push({ id: `rate-${rate}`, kind: 'low_rate', date: TODAY, read: false, title: 'Low Attendance Rate', body: `Attendance is at ${rate}% over 30 days — below the 75% threshold.` });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    const t0 = performance.now();
    const f = (now: number) => {
      const p = Math.min((now - t0) / ms, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }, [target, ms]);
  return v;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RING
// ═══════════════════════════════════════════════════════════════════════════════

function Ring({ pct, size = 140, thick = 10 }: { pct: number; size?: number; thick?: number }) {
  const r = (size - thick) / 2, circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);
  const displayed = useCountUp(pct);
  const clr = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#ef4444';
  useEffect(() => { const t = setTimeout(() => setDash((pct / 100) * circ), 150); return () => clearTimeout(t); }, [pct, circ]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs><filter id="ringGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={thick}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={clr} strokeWidth={thick} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" filter="url(#ringGlow)" style={{ transition: 'stroke-dasharray 1.8s cubic-bezier(.34,1.1,.64,1)' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: size < 100 ? 20 : 28, fontWeight: 700, color: clr, lineHeight: 1 }}>{displayed}%</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 3 }}>rate</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════

function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 440, padding: '14px 20px', borderRadius: 18, background: type === 'ok' ? 'linear-gradient(135deg,#052e16,#14532d)' : 'linear-gradient(135deg,#450a0a,#7f1d1d)', border: `1px solid ${type === 'ok' ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.3)'}`, color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 20px 60px rgba(0,0,0,.5)', animation: 'toastIn .4s cubic-bezier(.34,1.56,.64,1) both', fontFamily: "'DM Sans',sans-serif" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{type === 'ok' ? '✅' : '⚠️'}</span>
      <span style={{ lineHeight: 1.5 }}>{msg}</span>
      <button onClick={onClose} style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: 20, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK BARS
// ═══════════════════════════════════════════════════════════════════════════════

function WeekBars({ records, sid }: { records: AttendanceRecord[]; sid: string }) {
  const week = nDays(7);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 72 }}>
      {week.map(day => {
        const rec = records.find(r => r.student_id === sid && r.date === day);
        const cfg = rec ? ST_CFG[rec.status] : null;
        const isToday = day === TODAY;
        const h = rec?.status === 'PRESENT' ? 64 : rec?.status === 'LATE' ? 44 : rec?.status === 'ABSENT' ? 24 : 12;
        return (
          <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: '100%', height: h, borderRadius: 8, background: cfg ? cfg.bg : 'rgba(255,255,255,.06)', border: `1.5px solid ${isToday ? 'rgba(251,191,36,.6)' : cfg ? cfg.border : 'rgba(255,255,255,.08)'}`, boxShadow: cfg ? `0 4px 16px ${cfg.glow}` : 'none', transition: 'height .7s cubic-bezier(.4,0,.2,1)', position: 'relative' }}>
              {cfg && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 6, height: 6, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }}/>}
            </div>
            <span style={{ fontSize: 9, color: isToday ? '#fbbf24' : 'rgba(255,255,255,.3)', fontWeight: 700, letterSpacing: '.04em' }}>{new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'narrow' })}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════

function CalHeatmap({ records, sid }: { records: AttendanceRecord[]; sid: string }) {
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const days = monthDays(yr, mo);
  const firstDow = new Date(yr, mo, 1).getDay();
  const label = new Date(yr, mo, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  const statusMap = useMemo(() => {
    const m: Record<string, keyof typeof ST_CFG> = {};
    records.filter(r => r.student_id === sid).forEach(r => { m[r.date] = r.status; });
    return m;
  }, [records, sid]);
  const prev = () => mo === 0 ? (setYr(y => y - 1), setMo(11)) : setMo(m => m - 1);
  const next = () => mo === 11 ? (setYr(y => y + 1), setMo(0)) : setMo(m => m + 1);
  const monthStats = days.reduce((acc, d) => {
    if (d <= TODAY) { const s = statusMap[d]; if (s) acc[s] = (acc[s] || 0) + 1; }
    return acc;
  }, {} as Record<string, number>);
  const nb: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', cursor: 'pointer', color: 'rgba(255,255,255,.7)', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={prev} style={nb} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.12)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)'}}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 15, color: '#fff' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 3 }}>✅ {monthStats.PRESENT||0} · 🕐 {monthStats.LATE||0} · ❌ {monthStats.ABSENT||0}</div>
        </div>
        <button onClick={next} style={nb} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.12)'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)'}}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d,i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.25)', padding: '3px 0', letterSpacing: '.06em' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
        {Array.from({ length: firstDow }, (_,i) => <div key={`e${i}`}/>)}
        {days.map(day => {
          const st = statusMap[day], cfg = st ? ST_CFG[st] : null;
          const isToday = day === TODAY, isFuture = day > TODAY;
          const num = new Date(day + 'T00:00:00').getDate();
          return (
            <div key={day} title={st ? `${fmtMed(day)}: ${ST_CFG[st].label}` : fmtMed(day)} style={{ aspectRatio: '1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: isToday ? 900 : 600, fontFamily: "'DM Sans',sans-serif", background: cfg ? cfg.bg : isToday ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.04)', color: cfg ? cfg.text : isToday ? '#fbbf24' : isFuture ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.3)', border: isToday ? '1.5px solid rgba(251,191,36,.5)' : cfg ? `1.5px solid ${cfg.border}` : '1.5px solid transparent', position: 'relative' }}>
              {num}
              {cfg && <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }}/>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
        {Object.entries(ST_CFG).map(([k,v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}` }}/>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE LIST
// ═══════════════════════════════════════════════════════════════════════════════

function AttList({ records, sid }: { records: AttendanceRecord[]; sid: string }) {
  const sorted = records.filter(r => r.student_id === sid).sort((a,b) => b.date.localeCompare(a.date));
  if (!sorted.length) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,.25)' }}>
      <div style={{ fontSize: 52, marginBottom: 14, opacity: .5 }}>📭</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>No records yet</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
      {sorted.map((r,i) => {
        const c = ST_CFG[r.status], isToday = r.date === TODAY;
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, background: isToday ? c.bg : 'rgba(255,255,255,.04)', border: `1px solid ${isToday ? c.border : 'rgba(255,255,255,.06)'}`, animation: 'rowIn .3s ease both', animationDelay: `${Math.min(i*.025,.4)}s` }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, boxShadow: `0 0 10px ${c.dot}`, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13, color: c.text }}>{c.label}</span>
                {isToday && <span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,.15)', padding: '2px 7px', borderRadius: 999, border: '1px solid rgba(251,191,36,.3)', letterSpacing: '.08em' }}>TODAY</span>}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{fmtFull(r.date)}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', padding: '4px 12px', borderRadius: 999, background: c.pillBg, color: c.pill, flexShrink: 0 }}>{r.status}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function AlertsPanel({ alerts, onDismiss, onDismissAll }: { alerts: AlertNotif[]; onDismiss: (id: string) => void; onDismissAll: () => void }) {
  if (!alerts.length) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 18, color: '#4ade80', marginBottom: 8 }}>All Clear!</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>No alerts — attendance is great!</div>
    </div>
  );
  const unread = alerts.filter(a => !a.read);
  return (
    <div>
      {unread.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={onDismissAll} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', padding: '5px 14px', borderRadius: 8, cursor: 'pointer' }}
            onMouseEnter={e=>{e.currentTarget.style.color='#fff'}} onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,.4)'}}>Dismiss all</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map((a,i) => {
          const cfg = ALERT_CFG[a.kind];
          return (
            <div key={a.id} style={{ padding: '18px 20px', borderRadius: 18, background: a.read ? 'rgba(255,255,255,.03)' : cfg.bg, border: `1px solid ${a.read ? 'rgba(255,255,255,.06)' : cfg.border}`, display: 'flex', gap: 14, alignItems: 'flex-start', animation: 'rowIn .35s ease both', animationDelay: `${i*.06}s`, opacity: a.read ? .45 : 1 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{cfg.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 13, color: a.read ? 'rgba(255,255,255,.4)' : cfg.accent, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.6 }}>{a.body}</div>
              </div>
              {!a.read && (
                <button onClick={() => onDismiss(a.id)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${cfg.border}`, background: 'transparent', color: cfg.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={e=>{e.currentTarget.style.background=cfg.bg}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>Dismiss</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✨ FILE UPLOAD ZONE  — doctor letter / sick note / proof of absence
// ═══════════════════════════════════════════════════════════════════════════════

function FileUploadZone({ files, onChange }: { files: LeaveAttachment[]; onChange: (f: LeaveAttachment[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const processFiles = (raw: FileList | null) => {
    if (!raw) return;
    setUploadErr('');
    const list = Array.from(raw);
    for (const f of list) {
      if (!ACCEPTED_MIME.includes(f.type)) { setUploadErr(`"${f.name}" is not supported. Use JPG, PNG, WEBP, or PDF.`); return; }
      if (f.size > MAX_FILE_BYTES) { setUploadErr(`"${f.name}" exceeds 5 MB (${fmtBytes(f.size)}).`); return; }
    }
    let done = 0;
    const incoming: LeaveAttachment[] = [];
    list.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        incoming.push({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result as string });
        done++;
        if (done === list.length) onChange([...files, ...incoming]);
      };
      reader.readAsDataURL(file);
    });
  };

  const remove = (idx: number) => onChange(files.filter((_,i) => i !== idx));

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragging ? 'rgba(56,189,248,.8)' : 'rgba(255,255,255,.14)'}`,
          borderRadius: 18, padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(56,189,248,.09)' : 'rgba(255,255,255,.02)',
          transition: 'all .2s',
        }}
        onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
        onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}
      >
        <input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />

        <div style={{ fontSize: 40, marginBottom: 10 }}>{dragging ? '📂' : '📎'}</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 14, color: dragging ? '#38bdf8' : 'rgba(255,255,255,.65)', marginBottom: 6 }}>
          {dragging ? 'Drop documents here…' : 'Upload Supporting Documents'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', lineHeight: 1.7, marginBottom: 14 }}>
          Doctor's letter · sick note · hospital letter · any proof of absence<br/>
          <span style={{ color: 'rgba(255,255,255,.18)' }}>JPG · PNG · WEBP · PDF &nbsp;·&nbsp; max 5 MB per file</span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 10, background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.28)', fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: "'DM Sans',sans-serif" }}>
          📂 Browse Files
        </div>
      </div>

      {/* Upload error */}
      {uploadErr && (
        <div style={{ marginTop: 8, display: 'flex', gap: 7, padding: '9px 13px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', fontSize: 12, color: '#f87171', alignItems: 'center' }}>
          <span>⚠️</span>{uploadErr}
        </div>
      )}

      {/* Attached files */}
      {files.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
            Attached ({files.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map((f, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 13, background: 'rgba(56,189,248,.07)', border: '1px solid rgba(56,189,248,.22)', animation: 'rowIn .25s ease both' }}>
                {/* Thumb / icon */}
                {f.type.startsWith('image/') ? (
                  <img src={f.dataUrl} alt={f.name} style={{ width: 42, height: 42, borderRadius: 9, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(56,189,248,.3)' }}/>
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: 9, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📄</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: '#38bdf8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{fmtBytes(f.size)} · {f.type === 'application/pdf' ? 'PDF' : f.type.replace('image/','').toUpperCase()}</div>
                </div>
                {/* Remove */}
                <button type="button" onClick={() => remove(idx)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(248,113,113,.3)', background: 'rgba(248,113,113,.1)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, transition: 'all .15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(248,113,113,.22)'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(248,113,113,.1)'}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAVE FORM
// ═══════════════════════════════════════════════════════════════════════════════

function LeaveForm({ student, parentUser, onDone }: {
  student: Student;
  parentUser: { name: string; email?: string; phone?: string } | null;
  onDone: (r: LeaveRequest) => void;
}) {
  const [form, setForm] = useState({ from: TODAY, to: TODAY, type: 'MEDICAL' as LeaveRequest['leave_type'], reason: '' });
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const set = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const days = Math.max(1, Math.floor((new Date(form.to).getTime() - new Date(form.from).getTime()) / 86400000) + 1);
  const ok = form.reason.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!form.reason.trim()) { setErr('Please describe the reason for leave.'); return; }
    if (form.to < form.from) { setErr('End date must be on or after start date.'); return; }
    setBusy(true);
    setTimeout(() => {
      const req: LeaveRequest = {
        id: crypto.randomUUID(), student_id: student.id, student_name: student.name,
        class_name: student.class_name, from_date: form.from, to_date: form.to,
        reason: form.reason.trim(), leave_type: form.type, status: 'PENDING',
        submitted_at: new Date().toISOString(),
        parent_name: parentUser?.name, parent_contact: parentUser?.phone, parent_email: parentUser?.email,
        attachments,
      };
      DB.saveLeaves([...DB.leaves(), req]);

      // ── Notify principal + class teacher ────────────────────────────────────
      const notif: StaffLeaveNotification = {
        id: req.id, student_id: student.id, student_name: student.name,
        class_name: student.class_name, from_date: form.from, to_date: form.to,
        reason: form.reason.trim(), leave_type: form.type,
        submitted_at: req.submitted_at, read: false,
        parent_name: parentUser?.name, parent_contact: parentUser?.phone,
        attachments,
      };
      DB.saveStaffNotifications([...DB.staffNotifications(), notif]);

      setForm({ from: TODAY, to: TODAY, type: 'MEDICAL', reason: '' });
      setAttachments([]);
      setBusy(false);
      onDone(req);
    }, 900);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',sans-serif", transition: 'all .15s' };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Student badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,rgba(251,191,36,.3),rgba(245,158,11,.4))', border: '1px solid rgba(251,191,36,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fbbf24', flexShrink: 0 }}>{student.name[0].toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 14, color: '#fbbf24' }}>{student.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(251,191,36,.6)', marginTop: 2 }}>Class {student.class_name} · Roll {student.roll_no}</div>
        </div>
      </div>

      {/* Notification info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(56,189,248,.07)', border: '1px solid rgba(56,189,248,.2)' }}>
        <span style={{ fontSize: 16, marginTop: 1 }}>📢</span>
        <div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: '#38bdf8', marginBottom: 3 }}>Who gets notified</div>
          <div style={{ fontSize: 11, color: 'rgba(56,189,248,.7)', lineHeight: 1.6 }}>
            Sent to the <strong style={{ color: '#38bdf8' }}>Principal</strong> and <strong style={{ color: '#38bdf8' }}>Class Teacher ({student.class_name})</strong> for approval. Any attached documents will be visible to them.
          </div>
        </div>
      </div>

      {err && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', fontSize: 13, color: '#f87171', alignItems: 'center' }}>
          <span>⚠️</span>{err}
        </div>
      )}

      {/* Leave type */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10 }}>Leave Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(Object.entries(LV_CFG) as [LeaveRequest['leave_type'], typeof LV_CFG[keyof typeof LV_CFG]][]).map(([k,v]) => {
            const active = form.type === k;
            return (
              <button key={k} type="button" onClick={() => set('type')(k)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', transition: 'all .2s', background: active ? v.bg : 'rgba(255,255,255,.04)', border: `1.5px solid ${active ? v.border : 'rgba(255,255,255,.08)'}`, boxShadow: active ? `0 4px 16px ${v.accent}22` : 'none', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 12, color: active ? v.accent : 'rgba(255,255,255,.4)' }}>
                <span style={{ fontSize: 18 }}>{v.icon}</span>
                <span style={{ textAlign: 'left', lineHeight: 1.3 }}>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[{ key: 'from', lbl: 'Start Date', min: TODAY }, { key: 'to', lbl: 'End Date', min: form.from }].map(({ key, lbl, min }) => (
          <div key={key}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 7 }}>{lbl}</div>
            <input type="date" value={(form as any)[key]} min={min} required
              onChange={e => { set(key)(e.target.value); if (key === 'from' && e.target.value > form.to) set('to')(e.target.value); }}
              style={{ ...inp, colorScheme: 'dark' }}
              onFocus={e=>{e.currentTarget.style.borderColor='rgba(251,191,36,.4)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(251,191,36,.08)'}}
              onBlur={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.1)';e.currentTarget.style.boxShadow='none'}}/>
          </div>
        ))}
      </div>

      {/* Duration chip */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)', alignItems: 'center' }}>
        <span>📅</span>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: '#34d399' }}>
          {days} school day{days !== 1 ? 's' : ''} — {fmtShort(form.from)}{days > 1 ? ` → ${fmtShort(form.to)}` : ''}
        </span>
      </div>

      {/* Reason */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 7 }}>
          Reason <span style={{ color: '#f87171' }}>*</span>
        </div>
        <textarea value={form.reason} onChange={e => set('reason')(e.target.value)} rows={4} required
          placeholder="Describe the reason in detail — include any medical notes or special circumstances…"
          style={{ ...inp, resize: 'vertical', minHeight: 100, lineHeight: 1.6 }}
          onFocus={e=>{e.currentTarget.style.borderColor='rgba(251,191,36,.4)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(251,191,36,.08)'}}
          onBlur={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.1)';e.currentTarget.style.boxShadow='none'}}/>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', marginTop: 4, textAlign: 'right' }}>{form.reason.length} chars</div>
      </div>

      {/* ✨ DOCUMENT UPLOAD SECTION */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>
          Supporting Documents
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginBottom: 10, lineHeight: 1.6 }}>
          Upload a doctor's letter, sick note, or any proof to support this request. <span style={{ color: 'rgba(255,255,255,.18)' }}>(Optional but recommended for Medical leave)</span>
        </div>
        <FileUploadZone files={attachments} onChange={setAttachments} />
      </div>

      {/* Submit */}
      <button type="submit" disabled={busy || !ok} style={{ padding: '14px 20px', borderRadius: 14, border: 'none', background: (busy || !ok) ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: (busy || !ok) ? 'rgba(255,255,255,.25)' : '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 800, cursor: (busy || !ok) ? 'not-allowed' : 'pointer', transition: 'all .2s', boxShadow: (busy || !ok) ? 'none' : '0 8px 24px rgba(245,158,11,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {busy
          ? <><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }}/>Submitting…</>
          : <>📤 Submit Leave Request{attachments.length > 0 ? ` + ${attachments.length} doc${attachments.length !== 1 ? 's' : ''}` : ''}</>}
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAVE HISTORY  — with inline attachment viewer
// ═══════════════════════════════════════════════════════════════════════════════

function LeaveHistory({ sid }: { sid: string }) {
  const [preview, setPreview] = useState<LeaveAttachment | null>(null);
  const [liveLeaves, setLiveLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => { setLiveLeaves(DB.leaves()); }, [sid]);

  const reqs = liveLeaves.filter(r => r.student_id === sid).sort((a,b) => b.submitted_at.localeCompare(a.submitted_at));

  if (!reqs.length) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,.25)' }}>
      <div style={{ fontSize: 52, marginBottom: 14, opacity: .5 }}>📪</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>No requests yet</div>
      <div style={{ fontSize: 12 }}>Submitted requests will appear here.</div>
    </div>
  );

  return (
    <>
      {/* ── Lightbox ── */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(6px)' }}
          onClick={() => setPreview(null)}>
          <button style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', fontSize: 22, width: 44, height: 44, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          {preview.type.startsWith('image/') ? (
            <img src={preview.dataUrl} alt={preview.name} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, boxShadow: '0 32px 80px rgba(0,0,0,.7)', objectFit: 'contain' }} onClick={e => e.stopPropagation()}/>
          ) : (
            <div style={{ background: '#1a1a1a', borderRadius: 22, padding: '40px 48px', textAlign: 'center', maxWidth: 380, border: '1px solid rgba(255,255,255,.08)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 64, marginBottom: 18 }}>📄</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 6 }}>{preview.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 24 }}>{fmtBytes(preview.size)}</div>
              <a href={preview.dataUrl} download={preview.name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 26px', borderRadius: 12, background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: '0 8px 24px rgba(56,189,248,.4)' }}>
                ⬇️ Download PDF
              </a>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reqs.map((req, i) => {
          const tc = LV_CFG[req.leave_type], sc = LS_CFG[req.status];
          const days = Math.max(1, Math.floor((new Date(req.to_date).getTime() - new Date(req.from_date).getTime()) / 86400000) + 1);
          return (
            <div key={req.id} style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${sc.border}`, animation: 'rowIn .3s ease both', animationDelay: `${i*.05}s` }}>
              {/* Header bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: sc.bg }}>
                <span style={{ fontSize: 22 }}>{tc.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 13, color: tc.accent }}>{tc.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                    {req.from_date === req.to_date ? fmtMed(req.from_date) : `${fmtShort(req.from_date)} – ${fmtShort(req.to_date)}`}
                    {days > 1 && ` · ${days} days`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, background: sc.bg, border: `1px solid ${sc.border}` }}>
                  <span style={{ fontSize: 12 }}>{sc.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: sc.color, letterSpacing: '.07em' }}>{sc.label}</span>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,.03)' }}>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, margin: '0 0 12px' }}>{req.reason}</p>

                {/* ── Attachments ── */}
                {req.attachments && req.attachments.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
                      📎 Documents ({req.attachments.length})
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {req.attachments.map((att, j) => (
                        <button key={j} type="button" onClick={() => setPreview(att)}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 10, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.25)', cursor: 'pointer', transition: 'all .15s', fontFamily: "'DM Sans',sans-serif" }}
                          onMouseEnter={e=>{e.currentTarget.style.background='rgba(56,189,248,.2)'}}
                          onMouseLeave={e=>{e.currentTarget.style.background='rgba(56,189,248,.1)'}}>
                          {att.type.startsWith('image/') ? (
                            <img src={att.dataUrl} alt={att.name} style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', border: '1px solid rgba(56,189,248,.3)' }}/>
                          ) : (
                            <span style={{ fontSize: 18 }}>📄</span>
                          )}
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                            <div style={{ fontSize: 9, color: 'rgba(56,189,248,.45)' }}>{fmtBytes(att.size)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', fontWeight: 600 }}>
                  Submitted {new Date(req.submitted_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {req.notes && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', fontSize: 11, color: 'rgba(255,255,255,.45)', fontStyle: 'italic' }}>
                    <strong style={{ color: 'rgba(255,255,255,.6)', fontStyle: 'normal' }}>School note: </strong>{req.notes}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PARENT PORTAL
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = 'attendance' | 'alerts' | 'leave';
type AttView = 'list' | 'calendar';

export default function ParentPortal(): React.ReactElement {
  const { user } = useAuth();

  const [allAtt,   setAllAtt]   = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [leaves,   setLeaves]   = useState<LeaveRequest[]>([]);
  const [alerts,   setAlerts]   = useState<AlertNotif[]>([]);
  const [tab,      setTab]      = useState<Tab>('attendance');
  const [attView,  setAttView]  = useState<AttView>('list');
  const [toast,    setToast]    = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [syncing,  setSyncing]  = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  const childId    = user?.childId    ?? '';
  const childClass = user?.childClass ?? '';
  const childRoll  = user?.childRoll  ?? '';

  const load = useCallback(() => {
    setSyncing(true);
    setAllAtt(DB.attendance()); setStudents(DB.students()); setLeaves(DB.leaves());
    setLastSync(new Date());
    setTimeout(() => setSyncing(false), 600);
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, [load]);

  const child = useMemo(() => {
    if (childId) { const byId = students.find(s => s.id === childId); if (byId) return byId; }
    return students.find(s =>
      s.class_name.trim().toLowerCase() === childClass.trim().toLowerCase() &&
      (!childRoll || s.roll_no === childRoll)
    ) ?? null;
  }, [students, childId, childClass, childRoll]);

  const childAtt    = useMemo(() => child ? allAtt.filter(r => r.student_id === child.id) : [], [allAtt, child]);
  const childLeaves = useMemo(() => child ? leaves.filter(r => r.student_id === child.id) : [], [leaves, child]);

  useEffect(() => {
    if (!child) return;
    const fresh = buildAlerts(allAtt, child.id);
    const stored = DB.alerts();
    const readMap = new Map(stored.map(a => [a.id, a.read]));
    const merged = fresh.map(a => ({ ...a, read: readMap.get(a.id) ?? false }));
    DB.saveAlerts(merged); setAlerts(merged);
  }, [allAtt, child]);

  const dismissAlert = (id: string) => { const u = alerts.map(a => a.id === id ? { ...a, read: true } : a); DB.saveAlerts(u); setAlerts(u); };
  const dismissAll   = () => { const u = alerts.map(a => ({ ...a, read: true })); DB.saveAlerts(u); setAlerts(u); };

  const days30 = useMemo(() => nDays(30), []);
  const days7  = useMemo(() => nDays(7),  []);
  const r30 = childAtt.filter(r => days30.includes(r.date));
  const r7  = childAtt.filter(r => days7.includes(r.date));
  const p30 = r30.filter(r => r.status === 'PRESENT').length;
  const a30 = r30.filter(r => r.status === 'ABSENT').length;
  const l30 = r30.filter(r => r.status === 'LATE').length;
  const rate30 = r30.length ? Math.round(p30 / r30.length * 100) : 100;
  const rate7  = r7.length  ? Math.round(r7.filter(r => r.status === 'PRESENT').length / r7.length * 100) : 100;

  const todayRec     = childAtt.find(r => r.date === TODAY);
  const unreadAlerts = alerts.filter(a => !a.read).length;
  const pendingLvs   = childLeaves.filter(r => r.status === 'PENDING').length;

  const P30 = useCountUp(p30), A30 = useCountUp(a30), L30 = useCountUp(l30);
  const rateClr = rate30 >= 90 ? '#22c55e' : rate30 >= 75 ? '#f59e0b' : '#ef4444';
  const rateTag = rate30 >= 90 ? '🌟 Excellent' : rate30 >= 75 ? '⚠️ Needs Attention' : '🚨 At Risk';
  const parentInfo = user ? { name: user.name, email: user.email, phone: (user as any).phone } : null;

  if (students.length > 0 && !child) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ fontSize: 72, marginBottom: 20 }}>🔍</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>Student Not Found</h2>
      <p style={{ fontSize: 14, color: '#64748b', maxWidth: 400, lineHeight: 1.7, margin: '0 0 24px' }}>We couldn't find a student linked to your account.{childClass && <> (Class: <strong>{childClass}</strong>)</>}</p>
      <button onClick={load} style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif", boxShadow: '0 6px 20px rgba(245,158,11,.4)' }}>🔄 Retry</button>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 960, margin: '0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes rowIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
        @keyframes toastIn{from{opacity:0;transform:translateY(24px) scale(.94);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
        @keyframes glow-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4);}50%{box-shadow:0 0 0 8px rgba(34,197,94,0);}}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7);cursor:pointer;}
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── HERO ── */}
      <div style={{ borderRadius: 28, marginBottom: 20, overflow: 'hidden', background: 'linear-gradient(145deg,#0f0f0f 0%,#1a1a1a 50%,#111 100%)', boxShadow: '0 32px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06)', animation: 'fadeUp .5s ease both', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,.12) 0%,transparent 65%)', pointerEvents: 'none' }}/>
        <div style={{ padding: '32px 36px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.16em', textTransform: 'uppercase' }}>{user?.name?.split(' ')[0]}'s Parent Portal</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.8s ease-in-out infinite' }}/>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: '.1em' }}>LIVE</span>
                </div>
              </div>
              {child ? (
                <>
                  <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-.03em', lineHeight: 1.05 }}>{child.name}</h1>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontWeight: 600, marginBottom: 20 }}>Class {child.class_name} · Roll No. {child.roll_no}{child.gender ? ` · ${child.gender}` : ''}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {todayRec ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: ST_CFG[todayRec.status].bg, border: `1.5px solid ${ST_CFG[todayRec.status].border}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ST_CFG[todayRec.status].dot }}/>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ST_CFG[todayRec.status].text }}>Today: {ST_CFG[todayRec.status].label}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                        <span style={{ fontSize: 12 }}>⏳</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)' }}>Not marked yet today</span>
                      </div>
                    )}
                    {unreadAlerts > 0 && (
                      <button onClick={() => setTab('alerts')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, background: 'rgba(248,113,113,.12)', border: '1.5px solid rgba(248,113,113,.3)', cursor: 'pointer', animation: 'glow-pulse 2s ease-in-out infinite' }}>
                        <span style={{ fontSize: 13 }}>🚨</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: "'DM Sans',sans-serif" }}>{unreadAlerts} alert{unreadAlerts !== 1 ? 's' : ''}</span>
                      </button>
                    )}
                    <div style={{ padding: '8px 14px', borderRadius: 999, background: rate30 >= 90 ? 'rgba(34,197,94,.1)' : rate30 >= 75 ? 'rgba(245,158,11,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${rate30 >= 90 ? 'rgba(34,197,94,.25)' : rate30 >= 75 ? 'rgba(245,158,11,.25)' : 'rgba(239,68,68,.25)'}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: rateClr }}>{rateTag}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                    {[{ n: P30, lbl: 'Present', c: ST_CFG.PRESENT }, { n: A30, lbl: 'Absent', c: ST_CFG.ABSENT }, { n: L30, lbl: 'Late', c: ST_CFG.LATE }].map(({ n, lbl, c }) => (
                      <div key={lbl} style={{ padding: '10px 18px', borderRadius: 14, background: c.bg, border: `1px solid ${c.border}`, textAlign: 'center', minWidth: 72 }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 800, color: c.text, lineHeight: 1 }}>{n}</div>
                        <div style={{ fontSize: 9, color: c.text, opacity: .7, textTransform: 'uppercase', letterSpacing: '.09em', marginTop: 3 }}>{lbl}</div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 18px', borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', textAlign: 'center', minWidth: 72 }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{childLeaves.length}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.09em', marginTop: 3 }}>Requests</div>
                    </div>
                  </div>
                </>
              ) : <div style={{ color: 'rgba(255,255,255,.4)', fontStyle: 'italic', paddingTop: 20 }}>Loading student data…</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <Ring pct={rate30} size={150} thick={12}/>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: rate7, l: '7 days' }, { v: rate30, l: '30 days' }].map(({ v, l }) => (
                  <div key={l} style={{ padding: '7px 16px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 800, color: '#fff' }}>{v}%</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.35)', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '.07em', transition: 'all .2s' }}
                onMouseEnter={e=>{e.currentTarget.style.color='#fff';e.currentTarget.style.background='rgba(255,255,255,.1)'}}
                onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,.35)';e.currentTarget.style.background='rgba(255,255,255,.05)'}}>
                <span style={{ display: 'inline-block', animation: syncing ? 'spin .8s linear infinite' : 'none' }}>🔄</span>
                {syncing ? 'SYNCING…' : `SYNCED ${lastSync.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', gap: 4, padding: 5, borderRadius: 20, background: 'rgba(15,15,15,.8)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)', marginBottom: 20, animation: 'fadeUp .5s ease both', animationDelay: '.08s', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        {([
          { key: 'attendance', label: 'Attendance', icon: '📊' },
          { key: 'alerts',     label: 'Alerts',     icon: '🔔', badge: unreadAlerts },
          { key: 'leave',      label: 'Leave',      icon: '✉️', badge: pendingLvs },
        ] as { key: Tab; label: string; icon: string; badge?: number }[]).map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 10px', borderRadius: 16, border: 'none', background: active ? 'rgba(255,255,255,.1)' : 'transparent', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,.35)', transition: 'all .2s', position: 'relative', letterSpacing: '-.01em' }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
              {(t.badge ?? 0) > 0 && <span style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s ease-in-out infinite' }}>{t.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && child && (
        <div style={{ animation: 'fadeUp .35s ease both' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 3, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}>
              {([{ v: 'list' as const, i: '📋', l: 'Timeline' },{ v: 'calendar' as const, i: '🗓', l: 'Calendar' }]).map(({ v, i, l }) => (
                <button key={v} onClick={() => setAttView(v)} style={{ padding: '6px 14px', borderRadius: 9, border: 'none', background: attView === v ? 'rgba(255,255,255,.12)' : 'transparent', color: attView === v ? '#fff' : 'rgba(255,255,255,.3)', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5 }}><span>{i}</span>{l}</button>
              ))}
            </div>
          </div>
          {attView === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'linear-gradient(145deg,#111,#181818)', borderRadius: 24, padding: '24px 28px', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 3 }}>This Week</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 20 }}>{r7.filter(r => r.status==='PRESENT').length}/{r7.length} days present · <span style={{ color: rateClr }}>{rate7}%</span></div>
                <WeekBars records={childAtt} sid={child.id}/>
              </div>
              <div style={{ background: 'linear-gradient(145deg,#111,#181818)', borderRadius: 24, padding: '24px 28px', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>Full History</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 20 }}>{childAtt.length} total records</div>
                <AttList records={childAtt} sid={child.id}/>
              </div>
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(145deg,#111,#181818)', borderRadius: 24, padding: '24px 28px', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 22 }}>Monthly Calendar</div>
              <CalHeatmap records={childAtt} sid={child.id}/>
            </div>
          )}
        </div>
      )}

      {/* ── ALERTS TAB ── */}
      {tab === 'alerts' && (
        <div style={{ animation: 'fadeUp .35s ease both' }}>
          <div style={{ background: 'linear-gradient(145deg,#111,#181818)', borderRadius: 24, padding: '24px 28px', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 22 }}>Smart Alerts</div>
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} onDismissAll={dismissAll}/>
          </div>
        </div>
      )}

      {/* ── LEAVE TAB ── */}
      {tab === 'leave' && child && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, animation: 'fadeUp .35s ease both' }}>
          <div style={{ background: 'linear-gradient(145deg,#111,#181818)', borderRadius: 24, padding: '24px 28px', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>Request Leave</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 22 }}>Notify the school of a planned absence for {child.name}</div>
            <LeaveForm student={child} parentUser={parentInfo} onDone={req => {
              setLeaves(prev => [...prev, req]);
              const docMsg = req.attachments?.length ? ` ${req.attachments.length} document${req.attachments.length !== 1 ? 's' : ''} attached.` : '';
              setToast({ msg: `✅ Leave request submitted!${docMsg} Principal and Class Teacher notified.`, type: 'ok' });
            }}/>
          </div>
          <div style={{ background: 'linear-gradient(145deg,#111,#181818)', borderRadius: 24, padding: '24px 28px', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff' }}>Request History</div>
              {pendingLvs > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.25)', padding: '3px 10px', borderRadius: 999 }}>{pendingLvs} PENDING</span>}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 22 }}>{childLeaves.length} total request{childLeaves.length !== 1 ? 's' : ''}</div>
            <LeaveHistory sid={child.id}/>
          </div>
        </div>
      )}
    </div>
  );
}