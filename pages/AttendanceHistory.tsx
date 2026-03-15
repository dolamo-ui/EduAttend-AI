import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays, TrendingUp, TrendingDown, Filter,
  Download, ChevronLeft, ChevronRight, Search,
  CheckCircle2, XCircle, Clock, Minus, BarChart2,
  Sparkles, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '../src/context/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Student {
  id: string;
  name: string;
  roll_no: string;
  class_name: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  date: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════════

const storage = {
  getStudents(): Student[] {
    try { return JSON.parse(localStorage.getItem('students') ?? '[]'); } catch { return []; }
  },
  getAttendance(): AttendanceRecord[] {
    try {
      const a: AttendanceRecord[] = JSON.parse(localStorage.getItem('attendance_records') ?? '[]');
      const b: AttendanceRecord[] = JSON.parse(localStorage.getItem('attendance') ?? '[]');
      const map = new Map<string, AttendanceRecord>();
      [...a, ...b].forEach(r => map.set(r.id, r));
      return Array.from(map.values());
    } catch { return []; }
  },
};

function deduplicateStudents(students: Student[]): Student[] {
  const seen = new Set<string>();
  return students.filter(s => {
    const key = `${s.class_name}::${s.roll_no}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Groq AI helper (inline — no external file needed)
// ═══════════════════════════════════════════════════════════════════════════════

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('MISSING_KEY');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      temperature: 0.6,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function getMonthDates(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getWeekDates(year: number, month: number): string[][] {
  const days = getMonthDates(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const grid: string[][] = [];
  const padded: (string | null)[] = [...Array(offset).fill(null), ...days];
  while (padded.length % 7 !== 0) padded.push(null);
  for (let i = 0; i < padded.length; i += 7) grid.push(padded.slice(i, i + 7) as string[]);
  return grid;
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function exportCSV(students: Student[], attendance: AttendanceRecord[], month: number, year: number) {
  const dates = getMonthDates(year, month);
  const headers = ['Student Name','Roll No','Class',...dates,'Present','Absent','Late','Rate%'];
  const rows = students.map(s => {
    const statuses = dates.map(d => {
      const r = attendance.find(a => a.student_id === s.id && a.date === d);
      return r ? r.status[0] : '-';
    });
    const recs = attendance.filter(a => a.student_id === s.id && dates.includes(a.date));
    const p  = recs.filter(r => r.status === 'PRESENT').length;
    const ab = recs.filter(r => r.status === 'ABSENT').length;
    const l  = recs.filter(r => r.status === 'LATE').length;
    const rate = recs.length > 0 ? Math.round((p / recs.length) * 100) : 0;
    return [`"${s.name}"`, s.roll_no, s.class_name, ...statuses, p, ab, l, rate].join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `attendance_${year}_${String(month + 1).padStart(2, '0')}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Status cell config
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  PRESENT: { bg: '#dcfce7', color: '#16a34a', border: '#86efac', icon: '✓', label: 'Present' },
  LATE:    { bg: '#fef9c3', color: '#ca8a04', border: '#fde047', icon: '~', label: 'Late'    },
  ABSENT:  { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', icon: '✗', label: 'Absent'  },
  NONE:    { bg: '#f8fafc', color: '#cbd5e1', border: '#e2e8f0', icon: '·', label: 'No Data' },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Animated counter
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, ms = 700): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, ms]);
  return val;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary stat card
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryCard({ icon, label, value, sub, accentColor, bgColor, borderColor }: {
  icon: React.ReactNode; label: string; value: number; sub?: string;
  accentColor: string; bgColor: string; borderColor: string;
}) {
  const animated = useCountUp(value);
  return (
    <div style={{
      background: bgColor, border: `1.5px solid ${borderColor}`,
      borderRadius: 18, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: `0 4px 16px ${accentColor}18`,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 13, background: `${accentColor}18`,
        border: `1.5px solid ${accentColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color: accentColor,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1, fontFamily: "'Sora', sans-serif" }}>
          {animated}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 3, fontFamily: "'Sora', sans-serif" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: accentColor, fontWeight: 700, marginTop: 2, fontFamily: "'Sora', sans-serif" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✨ AI INSIGHTS PANEL (Groq powered)
// ═══════════════════════════════════════════════════════════════════════════════

function AIInsightsPanel({
  students, attendance, month, year,
}: {
  students: Student[];
  attendance: AttendanceRecord[];
  month: number;
  year: number;
}) {
  const [insight,  setInsight]  = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState(false);

  const generate = async () => {
    setLoading(true); setError(''); setInsight([]);

    const dates     = getMonthDates(year, month);
    const monthRecs = attendance.filter(
      a => dates.includes(a.date) && students.some(s => s.id === a.student_id)
    );

    // Build stats summary (never send raw PII to AI)
    const perStudent = students.map(s => {
      const recs = monthRecs.filter(r => r.student_id === s.id);
      const p    = recs.filter(r => r.status === 'PRESENT').length;
      const a    = recs.filter(r => r.status === 'ABSENT').length;
      const l    = recs.filter(r => r.status === 'LATE').length;
      const rate = recs.length > 0 ? Math.round((p / recs.length) * 100) : null;
      return { name: s.name, class: s.class_name, present: p, absent: a, late: l, rate };
    });

    const below75   = perStudent.filter(s => s.rate !== null && s.rate < 75);
    const perfect   = perStudent.filter(s => s.rate === 100);
    const overallRate = monthRecs.length > 0
      ? Math.round(monthRecs.filter(r => r.status === 'PRESENT').length / monthRecs.length * 100)
      : 0;
    const worst3 = [...perStudent]
      .filter(s => s.rate !== null)
      .sort((a, b) => (a.rate ?? 100) - (b.rate ?? 100))
      .slice(0, 3);

    const userMsg = `Attendance data for ${MONTH_NAMES[month]} ${year}:
- Total students: ${students.length}
- School days tracked: ${dates.length}
- Overall attendance rate: ${overallRate}%
- Students below 75% threshold: ${below75.length} (${below75.map(s => `${s.name} ${s.rate}%`).join(', ') || 'none'})
- Perfect attendance: ${perfect.length} (${perfect.map(s => s.name).join(', ') || 'none'})
- Lowest 3 rates: ${worst3.map(s => `${s.name} ${s.rate}%`).join(', ') || 'n/a'}
- Total absences this month: ${monthRecs.filter(r => r.status === 'ABSENT').length}
- Total late arrivals: ${monthRecs.filter(r => r.status === 'LATE').length}`;

    try {
      const raw = await callGroq(
        'You are a school attendance analyst. Respond with exactly 6 bullet points. Each bullet must start with a single emoji then a space then the insight. No headers, no markdown, no numbered lists. Plain text only.',
        userMsg,
      );

      const bullets = raw
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && l.match(/^\p{Emoji}/u));

      setInsight(bullets.length >= 3 ? bullets : raw.split('\n').filter(l => l.trim()));
      setExpanded(true);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(msg.includes('MISSING_KEY')
        ? 'Add VITE_GROQ_API_KEY to your .env file to enable AI insights.'
        : `Groq error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      borderRadius: 20,
      border: '1.5px solid #c7d2fe',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #eef2ff 100%)',
      boxShadow: '0 4px 24px rgba(99,102,241,0.10)',
      overflow: 'hidden',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 22px', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e1b4b', fontFamily: "'Sora',sans-serif" }}>
              AI Attendance Insights
            </div>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginTop: 2 }}>
              Powered by Groq · {MONTH_NAMES[month]} {year}
            </div>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || students.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: loading || students.length === 0
              ? '#e2e8f0'
              : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: loading || students.length === 0 ? '#94a3b8' : '#fff',
            fontWeight: 700, fontSize: 13,
            cursor: loading || students.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: "'Sora',sans-serif",
            boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <span style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                border: '2.5px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1',
                animation: 'ai-spin 0.7s linear infinite',
              }} />
              Analysing…
            </>
          ) : (
            <>✨ Generate Insights</>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          margin: '0 22px 18px',
          padding: '12px 16px', borderRadius: 12,
          background: '#fef2f2', border: '1px solid #fecaca',
          color: '#dc2626', fontSize: 13, fontFamily: "'Sora',sans-serif",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Insights list */}
      {expanded && insight.length > 0 && (
        <div style={{ padding: '4px 22px 22px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 10,
          }}>
            {insight.map((line, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13, color: '#1e293b', lineHeight: 1.65,
                  padding: '12px 16px', borderRadius: 12,
                  background: '#fff',
                  border: '1.5px solid #e0e7ff',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.06)',
                  fontFamily: "'Sora',sans-serif",
                  animation: 'ai-fadeup 0.35s ease both',
                  animationDelay: `${i * 0.07}s`,
                }}
              >
                {line}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 12, fontSize: 10, color: '#a5b4fc',
            textAlign: 'right', fontFamily: "'Sora',sans-serif",
          }}>
            Generated by Groq · llama-3.3-70b-versatile
          </div>
        </div>
      )}

      {/* Placeholder when not yet generated */}
      {!expanded && !loading && !error && (
        <div style={{
          padding: '0 22px 18px',
          fontSize: 12, color: '#818cf8', fontFamily: "'Sora',sans-serif",
        }}>
          Click "Generate Insights" for an AI-powered analysis of {MONTH_NAMES[month]}'s attendance patterns.
        </div>
      )}

      <style>{`
        @keyframes ai-spin    { to { transform: rotate(360deg); } }
        @keyframes ai-fadeup  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Calendar heatmap cell
// ═══════════════════════════════════════════════════════════════════════════════

function CalCell({ date, status, isToday, isWeekend }: {
  date: string | null; status: 'PRESENT' | 'LATE' | 'ABSENT' | 'NONE';
  isToday?: boolean; isWeekend?: boolean;
}) {
  if (!date) return <div style={{ borderRadius: 10 }} />;
  const cfg = STATUS_CONFIG[status];
  const day = new Date(date).getDate();

  return (
    <div title={`${date}: ${cfg.label}`} style={{
      borderRadius: 10,
      background: isWeekend && status === 'NONE' ? '#f1f5f9' : cfg.bg,
      border: isToday ? '2.5px solid #6366f1' : `1.5px solid ${cfg.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      aspectRatio: '1', minHeight: 36, cursor: 'default',
      transition: 'transform 0.15s', position: 'relative',
      opacity: isWeekend && status === 'NONE' ? 0.5 : 1,
    }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <span style={{ fontSize: 10, fontWeight: 800, color: isWeekend && status === 'NONE' ? '#94a3b8' : cfg.color, fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{day}</span>
      <span style={{ fontSize: 9, color: cfg.color, lineHeight: 1, marginTop: 1 }}>{status !== 'NONE' ? cfg.icon : ''}</span>
      {isToday && (
        <div style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', background: '#6366f1' }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Student Calendar view
// ═══════════════════════════════════════════════════════════════════════════════

function StudentCalendar({ student, attendance, year, month }: {
  student: Student; attendance: AttendanceRecord[]; year: number; month: number;
}) {
  const today = new Date().toISOString().split('T')[0];
  const weeks = getWeekDates(year, month);
  const dates = getMonthDates(year, month);

  const studentRecs = attendance.filter(a => a.student_id === student.id);
  const monthRecs   = studentRecs.filter(a => dates.includes(a.date));

  const present = monthRecs.filter(r => r.status === 'PRESENT').length;
  const absent  = monthRecs.filter(r => r.status === 'ABSENT').length;
  const late    = monthRecs.filter(r => r.status === 'LATE').length;
  const rate    = monthRecs.length > 0 ? Math.round((present / monthRecs.length) * 100) : 0;

  const getStatus = (date: string): 'PRESENT' | 'LATE' | 'ABSENT' | 'NONE' =>
    (studentRecs.find(a => a.date === date)?.status ?? 'NONE') as any;

  return (
    <div style={{
      background: '#fff', borderRadius: 18, border: '1.5px solid #e8edf3',
      padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)')}
    >
      {/* Student header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: "'Sora',sans-serif",
        }}>
          {student.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: "'Sora',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Sora',sans-serif" }}>Roll {student.roll_no} · Class {student.class_name}</div>
        </div>
        {/* Rate ring */}
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: rate >= 75 ? '#dcfce7' : rate >= 50 ? '#fef9c3' : '#fee2e2',
          border: `2px solid ${rate >= 75 ? '#86efac' : rate >= 50 ? '#fde047' : '#fca5a5'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900,
          color: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626',
          fontFamily: "'Sora',sans-serif",
        }}>
          {rate}%
        </div>
      </div>

      {/* Mini stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { label: 'Present', val: present, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Absent',  val: absent,  color: '#dc2626', bg: '#fee2e2' },
          { label: 'Late',    val: late,    color: '#ca8a04', bg: '#fef9c3' },
        ].map(item => (
          <div key={item.label} style={{
            textAlign: 'center', padding: '7px 4px', borderRadius: 10,
            background: item.bg, border: `1px solid ${item.color}40`,
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: item.color, lineHeight: 1, fontFamily: "'Sora',sans-serif" }}>{item.val}</div>
            <div style={{ fontSize: 9, color: item.color, fontWeight: 700, marginTop: 2, fontFamily: "'Sora',sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#94a3b8', fontFamily: "'Sora',sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {week.map((date, di) => (
              <CalCell
                key={di} date={date}
                status={date ? getStatus(date) : 'NONE'}
                isToday={date === today}
                isWeekend={di >= 5}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Class trend chart
// ═══════════════════════════════════════════════════════════════════════════════

function ClassTrendChart({ students, attendance, year, month }: {
  students: Student[]; attendance: AttendanceRecord[]; year: number; month: number;
}) {
  const dates = getMonthDates(year, month);
  const data = dates.map(date => {
    const dayRecs = attendance.filter(a =>
      a.date === date && students.some(s => s.id === a.student_id)
    );
    const p = dayRecs.filter(r => r.status === 'PRESENT').length;
    const total = students.length;
    return {
      date: new Date(date).getDate(),
      pct: total > 0 ? Math.round((p / total) * 100) : 0,
      present: p,
      absent: dayRecs.filter(r => r.status === 'ABSENT').length,
      late: dayRecs.filter(r => r.status === 'LATE').length,
    };
  });

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e8edf3', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChart2 size={16} color="#6366f1" />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: "'Sora',sans-serif" }}>Monthly Attendance Rate</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" stroke="#cbd5e1" tick={{ fontSize: 9, fontFamily: "'Sora',sans-serif" }} />
          <YAxis domain={[0, 100]} stroke="#cbd5e1" tick={{ fontSize: 9, fontFamily: "'Sora',sans-serif" }} unit="%" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11, fontFamily: "'Sora',sans-serif" }}
            formatter={(v: number) => [`${v}%`, 'Attendance']}
            labelFormatter={l => `Day ${l}`}
          />
          <Area type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Weekly summary bar chart
// ═══════════════════════════════════════════════════════════════════════════════

function WeeklySummaryChart({ students, attendance, year, month }: {
  students: Student[]; attendance: AttendanceRecord[]; year: number; month: number;
}) {
  const weeks = getWeekDates(year, month);
  const data = weeks.map((week, i) => {
    const validDates = week.filter(Boolean) as string[];
    const weekRecs = attendance.filter(a =>
      validDates.includes(a.date) && students.some(s => s.id === a.student_id)
    );
    return {
      week: `W${i + 1}`,
      present: weekRecs.filter(r => r.status === 'PRESENT').length,
      absent:  weekRecs.filter(r => r.status === 'ABSENT').length,
      late:    weekRecs.filter(r => r.status === 'LATE').length,
    };
  });

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e8edf3', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <TrendingUp size={16} color="#10b981" />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: "'Sora',sans-serif" }}>Weekly Breakdown</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={16} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" stroke="#cbd5e1" tick={{ fontSize: 10, fontFamily: "'Sora',sans-serif" }} />
          <YAxis stroke="#cbd5e1" tick={{ fontSize: 10, fontFamily: "'Sora',sans-serif" }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11, fontFamily: "'Sora',sans-serif" }} />
          <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} name="Present" />
          <Bar dataKey="absent"  fill="#f87171" radius={[4, 4, 0, 0]} name="Absent"  />
          <Bar dataKey="late"    fill="#fbbf24" radius={[4, 4, 0, 0]} name="Late"    />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tabular history view
// ═══════════════════════════════════════════════════════════════════════════════

function TabularView({ students, attendance, year, month }: {
  students: Student[]; attendance: AttendanceRecord[]; year: number; month: number;
}) {
  const dates = getMonthDates(year, month);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e8edf3', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontFamily: "'Sora',sans-serif" }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,#f8fafc,#eef2ff)', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'linear-gradient(135deg,#f8fafc,#eef2ff)', padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#6366f1', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase', minWidth: 180, borderRight: '1.5px solid #e2e8f0' }}>
                Student
              </th>
              {dates.map(date => {
                const d = new Date(date);
                const isT  = date === today;
                const isWE = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={date} style={{
                    padding: '8px 4px', textAlign: 'center', fontSize: 9, fontWeight: 800,
                    color: isT ? '#6366f1' : isWE ? '#94a3b8' : '#64748b',
                    minWidth: 32, letterSpacing: '0.03em', textTransform: 'uppercase',
                    background: isT ? '#eef2ff' : 'transparent',
                    borderBottom: isT ? '2px solid #6366f1' : undefined,
                  }}>
                    <div>{DAY_LABELS[(d.getDay() + 6) % 7]}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: isT ? '#6366f1' : isWE ? '#94a3b8' : '#0f172a', marginTop: 2 }}>{d.getDate()}</div>
                  </th>
                );
              })}
              <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#374151', whiteSpace: 'nowrap', minWidth: 50 }}>Rate</th>
              <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap', minWidth: 44 }}>P</th>
              <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#dc2626', whiteSpace: 'nowrap', minWidth: 44 }}>A</th>
              <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#ca8a04', whiteSpace: 'nowrap', minWidth: 44 }}>L</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => {
              const sRecs = attendance.filter(a => a.student_id === s.id);
              const mRecs = sRecs.filter(a => dates.includes(a.date));
              const p  = mRecs.filter(r => r.status === 'PRESENT').length;
              const ab = mRecs.filter(r => r.status === 'ABSENT').length;
              const l  = mRecs.filter(r => r.status === 'LATE').length;
              const rate = mRecs.length > 0 ? Math.round((p / mRecs.length) * 100) : 0;

              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: idx % 2 === 0 ? '#fff' : '#fafbff', padding: '10px 16px', borderRight: '1.5px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Roll {s.roll_no}</div>
                      </div>
                    </div>
                  </td>
                  {dates.map(date => {
                    const rec = sRecs.find(a => a.date === date);
                    const status = rec?.status ?? 'NONE';
                    const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                    const d = new Date(date);
                    const isWE = d.getDay() === 0 || d.getDay() === 6;
                    const isT  = date === today;
                    return (
                      <td key={date} style={{ padding: '4px 2px', textAlign: 'center', background: isT ? '#f0f0ff' : undefined }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 6, margin: '0 auto',
                          background: isWE && status === 'NONE' ? '#f1f5f9' : cfg.bg,
                          border: `1px solid ${isWE && status === 'NONE' ? '#e2e8f0' : cfg.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800,
                          color: isWE && status === 'NONE' ? '#cbd5e1' : cfg.color,
                          opacity: isWE && status === 'NONE' ? 0.5 : 1,
                        }}>
                          {status === 'NONE' ? '·' : cfg.icon}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 900, fontFamily: "'Sora',sans-serif",
                      color: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626',
                      background: rate >= 75 ? '#dcfce7' : rate >= 50 ? '#fef9c3' : '#fee2e2',
                      padding: '3px 8px', borderRadius: 999,
                    }}>
                      {rate}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 800, color: '#16a34a', fontFamily: "'Sora',sans-serif" }}>{p}</td>
                  <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 800, color: '#dc2626', fontFamily: "'Sora',sans-serif" }}>{ab}</td>
                  <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: 800, color: '#ca8a04', fontFamily: "'Sora',sans-serif" }}>{l}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════

type ViewMode = 'calendar' | 'table' | 'charts';

export default function AttendanceHistory(): React.ReactElement {
  const { user } = useAuth();

  const now = new Date();
  const [year,          setYear]          = useState(now.getFullYear());
  const [month,         setMonth]         = useState(now.getMonth());
  const [viewMode,      setViewMode]      = useState<ViewMode>('calendar');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [search,        setSearch]        = useState('');

  const allStudents   = useMemo(() => deduplicateStudents(storage.getStudents()), []);
  const allAttendance = useMemo(() => storage.getAttendance(), []);

  const isTeacher = user?.role === 'TEACHER';
  const isParent  = user?.role === 'PARENT';

  const classNames = useMemo(
    () => Array.from(new Set(allStudents.map(s => s.class_name).filter(Boolean))).sort(),
    [allStudents]
  );

  const filteredStudents = useMemo(() => {
    let list = allStudents;
    if (isTeacher) list = list.filter(s => s.class_name.trim().toLowerCase() === (user?.assignedClass ?? '').trim().toLowerCase());
    if (isParent)  list = list.filter(s => s.name === user?.childName && s.class_name === user?.childClass);
    if (!isTeacher && !isParent && selectedClass !== 'all') list = list.filter(s => s.class_name === selectedClass);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q));
    }
    return list;
  }, [allStudents, isTeacher, isParent, selectedClass, search, user]);

  const dates        = useMemo(() => getMonthDates(year, month), [year, month]);
  const monthRecs    = useMemo(() =>
    allAttendance.filter(a => dates.includes(a.date) && filteredStudents.some(s => s.id === a.student_id)),
    [allAttendance, dates, filteredStudents]
  );
  const totalPresent = monthRecs.filter(r => r.status === 'PRESENT').length;
  const totalAbsent  = monthRecs.filter(r => r.status === 'ABSENT').length;
  const totalLate    = monthRecs.filter(r => r.status === 'LATE').length;
  const overallRate  = monthRecs.length > 0 ? Math.round((totalPresent / monthRecs.length) * 100) : 0;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => {
    const n = new Date();
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth())) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  if (!user) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>;

  const title = isTeacher ? `Class ${user.assignedClass} · Attendance History` :
                isParent  ? `${user.childName}'s Attendance History` :
                            'School Attendance History';

  const VIEW_TABS: { key: ViewMode; icon: React.ReactNode; label: string }[] = [
    { key: 'calendar', icon: <CalendarDays size={14} />, label: 'Calendar' },
    { key: 'table',    icon: <Filter size={14} />,       label: 'Table'    },
    { key: 'charts',   icon: <BarChart2 size={14} />,    label: 'Charts'   },
  ];

  return (
    <div style={{ fontFamily: "'Sora', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 999px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28, animation: 'fadeUp .4s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays size={18} color="#fff" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>{title}</h1>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
              Detailed attendance records · {MONTH_NAMES[month]} {year}
            </p>
          </div>

          {/* Month navigator + export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '6px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', color: '#64748b' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', minWidth: 130, textAlign: 'center' }}>
                {MONTH_NAMES[month]} {year}
              </span>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', color: '#64748b' }}>
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              onClick={() => exportCSV(filteredStudents, allAttendance, month, year)}
              disabled={filteredStudents.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                opacity: filteredStudents.length === 0 ? 0.5 : 1,
              }}
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 26, animation: 'fadeUp .45s ease both .05s' }}>
        <SummaryCard icon={<CheckCircle2 size={20} />} label="Total Present" value={totalPresent} sub={`${overallRate}% rate`} accentColor="#10b981" bgColor="#f0fdf4" borderColor="#bbf7d0" />
        <SummaryCard icon={<XCircle size={20} />}      label="Total Absent"  value={totalAbsent}  accentColor="#ef4444" bgColor="#fef2f2" borderColor="#fecaca" />
        <SummaryCard icon={<Clock size={20} />}        label="Total Late"    value={totalLate}    accentColor="#f59e0b" bgColor="#fffbeb" borderColor="#fde68a" />
        <SummaryCard icon={<Minus size={20} />}        label="Students"      value={filteredStudents.length} accentColor="#6366f1" bgColor="#eef2ff" borderColor="#c7d2fe" />
      </div>

      {/* ── Filters & view toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap', animation: 'fadeUp .5s ease both .1s' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: "'Sora',sans-serif",
              color: '#0f172a', outline: 'none', background: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
            onFocus={e => (e.target.style.borderColor = '#6366f1')}
            onBlur={e  => (e.target.style.borderColor = '#e2e8f0')}
          />
        </div>

        {/* Class filter (principal only) */}
        {!isTeacher && !isParent && (
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 12, border: '1.5px solid #e2e8f0',
              fontSize: 13, fontFamily: "'Sora',sans-serif", color: '#374151',
              background: '#fff', cursor: 'pointer', outline: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <option value="all">All Classes</option>
            {classNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* View tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 3, marginLeft: 'auto', gap: 2 }}>
          {VIEW_TABS.map(tab => (
            <button key={tab.key} onClick={() => setViewMode(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: viewMode === tab.key ? '#fff' : 'transparent',
                color: viewMode === tab.key ? '#6366f1' : '#94a3b8',
                fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                boxShadow: viewMode === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
              }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap', animation: 'fadeUp .5s ease both .12s' }}>
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'NONE').map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: cfg.color }}>
              {cfg.icon}
            </div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: "'Sora',sans-serif" }}>{cfg.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: '#eef2ff', border: '2.5px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#6366f1' }}>•</div>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: "'Sora',sans-serif" }}>Today</span>
        </div>
      </div>

      {/* ── ✨ AI INSIGHTS PANEL ── */}
      {!isParent && (
        <div style={{ animation: 'fadeUp .5s ease both .14s' }}>
          <AIInsightsPanel
            students={filteredStudents}
            attendance={allAttendance}
            month={month}
            year={year}
          />
        </div>
      )}

      {/* ── Content ── */}
      {filteredStudents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', animation: 'fadeUp .4s ease both' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#374151', fontFamily: "'Sora',sans-serif" }}>No records found</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Try a different filter or check that students have been added.</div>
        </div>
      ) : (
        <div style={{ animation: 'fadeUp .55s ease both .15s' }}>

          {/* Calendar view */}
          {viewMode === 'calendar' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {filteredStudents.map(s => (
                <StudentCalendar key={s.id} student={s} attendance={allAttendance} year={year} month={month} />
              ))}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <TabularView students={filteredStudents} attendance={allAttendance} year={year} month={month} />
          )}

          {/* Charts view */}
          {viewMode === 'charts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <ClassTrendChart     students={filteredStudents} attendance={allAttendance} year={year} month={month} />
                <WeeklySummaryChart  students={filteredStudents} attendance={allAttendance} year={year} month={month} />
              </div>

              {/* Per-student rate bars */}
              <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e8edf3', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 16, fontFamily: "'Sora',sans-serif" }}>Student Attendance Rates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                  {filteredStudents.map(s => {
                    const sRecs = allAttendance.filter(a => a.student_id === s.id && dates.includes(a.date));
                    const p    = sRecs.filter(r => r.status === 'PRESENT').length;
                    const rate = sRecs.length > 0 ? Math.round((p / sRecs.length) * 100) : 0;
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                          {s.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4, fontFamily: "'Sora',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                          <div style={{ height: 8, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 999,
                              background: rate >= 75
                                ? 'linear-gradient(90deg,#10b981,#34d399)'
                                : rate >= 50
                                  ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                                  : 'linear-gradient(90deg,#ef4444,#f87171)',
                              width: `${rate}%`,
                              transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                            }} />
                          </div>
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 900, fontFamily: "'Sora',sans-serif",
                          color: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626',
                          minWidth: 40, textAlign: 'right',
                        }}>{rate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}