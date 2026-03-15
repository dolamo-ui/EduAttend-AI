import React, { useState, useEffect } from 'react';
import { Student, ClassRoom } from '../types';
import { MOCK_STUDENTS, MOCK_CLASSES } from '../service/mockData';
import { analyzeAttendanceRisk } from '../../service/geminiService';
import { AIStatus } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Derived Types
// ═══════════════════════════════════════════════════════════════════════════════

interface EnrichedStudent {
  student: Student;
  classroom: ClassRoom | undefined;
  fullName: string;
  attPct: number;
  consecutiveAbsences: number;
  totalDays: number;
  presentDays: number;
  aiStatus: AIStatus | null;
  rating: Rating;
}

interface Rating {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

type FilterKey = 'all' | 'high' | 'medium' | 'low' | 'at-risk';
type SortKey   = 'name' | 'attendance' | 'risk';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function computeAttendance(student: Student): {
  pct: number; present: number; total: number; consecutive: number;
} {
  const records = student.attendanceRecords ?? [];
  const total   = records.length;
  const present = records.filter((r) => r.status === 'PRESENT').length;
  const pct     = total === 0 ? 100 : Math.round((present / total) * 100);
  let consecutive = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].status === 'ABSENT') consecutive++;
    else break;
  }
  return { pct, present, total, consecutive };
}

function getRatingFromAI(status: AIStatus | null, pct: number): Rating {
  const risk = status?.riskScore ?? (pct < 75 ? 'HIGH' : pct < 85 ? 'MEDIUM' : 'LOW');
  switch (risk) {
    case 'HIGH':   return { label: 'High Risk', color: '#ef4444', bg: '#fee2e2', icon: '🚨' };
    case 'MEDIUM': return { label: 'Moderate',  color: '#f59e0b', bg: '#fef3c7', icon: '⚠️' };
    default:       return { label: 'On Track',  color: '#10b981', bg: '#d1fae5', icon: '✅' };
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

function getAvatarGradient(id: string): string {
  const palette: [string, string][] = [
    ['#7c3aed','#a855f7'],['#2563eb','#60a5fa'],['#db2777','#f472b6'],
    ['#d97706','#fbbf24'],['#059669','#34d399'],['#dc2626','#f87171'],
    ['#0891b2','#22d3ee'],['#7c3aed','#f472b6'],
  ];
  const idx = id.charCodeAt(id.length - 1) % palette.length;
  return `linear-gradient(135deg, ${palette[idx][0]}, ${palette[idx][1]})`;
}

function getStudents(): Student[] {
  try {
    const stored = JSON.parse(localStorage.getItem('students') ?? '[]') as Student[];
    return stored.length > 0 ? stored : MOCK_STUDENTS;
  } catch {
    return MOCK_STUDENTS;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressBarProps { value: number; color: string; delay?: number; }
function ProgressBar({ value, color, delay = 0 }: ProgressBarProps): React.ReactElement {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 120 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 999, background: color,
        width: `${width}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface CircleScoreProps { value: number; color: string; size?: number; }
function CircleScore({ value, color, size = 68 }: CircleScoreProps): React.ReactElement {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (value / 100) * circ), 200);
    return () => clearTimeout(t);
  }, [value, circ]);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="#1e293b" fontSize={13} fontWeight={700} fontFamily="'DM Sans', sans-serif"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {value}%
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string; label: string; value: number | string;
  sub?: string; color: string; bg: string;
}
function StatCard({ icon, label, value, sub, color, bg }: StatCardProps): React.ReactElement {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
      padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface StudentCardProps {
  data: EnrichedStudent;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  aiLoading: boolean;
}

function StudentCard({ data, index, expanded, onToggle, aiLoading }: StudentCardProps): React.ReactElement {
  const { student, classroom, fullName, attPct, consecutiveAbsences, presentDays, totalDays, aiStatus, rating } = data;
  const recentDays = (student.attendanceRecords ?? []).slice(-7);

  return (
    <div style={{
      background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
      boxShadow: expanded ? '0 20px 60px rgba(0,0,0,0.09)' : '0 2px 12px rgba(0,0,0,0.04)',
      marginBottom: 14, overflow: 'hidden',
      transition: 'box-shadow 0.3s ease, transform 0.2s ease',
      transform: expanded ? 'translateY(-2px)' : 'translateY(0)',
      animation: 'fadeSlideUp 0.45s ease both',
      animationDelay: `${index * 70}ms`,
    }}>

      {/* ── Card Header ── */}
      <div
        onClick={onToggle}
        role="button" tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onToggle()}
        style={{ padding: '18px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={fullName}
              style={{ width: 50, height: 50, borderRadius: 14, objectFit: 'cover', boxShadow: '0 4px 10px rgba(0,0,0,0.12)' }}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: 50, height: 50, borderRadius: 14, background: getAvatarGradient(student.id),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>
                {getInitials(student.firstName, student.lastName)}
              </span>
            </div>
          )}
          {/* Risk indicator dot */}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 12, height: 12, borderRadius: 999,
            background: rating.color, border: '2px solid #fff',
          }} />
        </div>

        {/* Info block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontWeight: 700, fontSize: 15, color: '#0f172a',
              fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
            }}>
              {fullName}
            </span>

            {aiLoading ? (
              <span style={{
                padding: '2px 10px', borderRadius: 999, background: '#f1f5f9',
                fontSize: 10, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              }}>
                Analyzing…
              </span>
            ) : (
              <span style={{
                padding: '2px 10px', borderRadius: 999, background: rating.bg, color: rating.color,
                fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
              }}>
                {rating.icon} {rating.label}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
            {classroom?.name ?? '—'} · Roll {student.rollNumber} · Section {student.section}
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>Attendance</span>
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                color: attPct >= 75 ? '#10b981' : '#ef4444',
              }}>
                {attPct}%
              </span>
            </div>

            {consecutiveAbsences > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12 }}>📅</span>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                  {consecutiveAbsences} consecutive absent{consecutiveAbsences > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Recent 7-day dots */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {recentDays.map((r, i) => (
                <div key={i} title={`${r.date}: ${r.status}`} style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: r.status === 'PRESENT' ? '#10b981' : '#ef4444',
                }} />
              ))}
              {recentDays.length > 0 && (
                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2, fontFamily: "'DM Sans', sans-serif" }}>
                  last {recentDays.length}d
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <ProgressBar value={attPct} color={attPct >= 75 ? '#10b981' : '#ef4444'} delay={index * 70} />
          </div>
        </div>

        {/* Circle score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <CircleScore value={attPct} color={attPct >= 75 ? '#10b981' : '#ef4444'} />
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>Attendance</span>
        </div>

        {/* Chevron */}
        <div style={{
          width: 26, height: 26, borderRadius: 999, background: '#f8fafc',
          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
          transition: 'transform 0.3s ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Expanded Detail ── */}
      <div style={{
        maxHeight: expanded ? 480 : 0, overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ paddingTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>

            {/* Left: attendance breakdown */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 12,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                Attendance Breakdown
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  { label: 'Present',      value: presentDays,             color: '#10b981', bg: '#d1fae5' },
                  { label: 'Absent',       value: totalDays - presentDays, color: '#ef4444', bg: '#fee2e2' },
                  { label: 'Total Days',   value: totalDays,               color: '#3b82f6', bg: '#dbeafe' },
                  { label: 'Consec. Abs',  value: consecutiveAbsences,     color: '#f97316', bg: '#ffedd5' },
                ] as { label: string; value: number; color: string; bg: string }[]).map((stat) => (
                  <div key={stat.label} style={{ background: stat.bg, borderRadius: 11, padding: '11px 13px' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, fontFamily: "'DM Sans', sans-serif" }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* History dots */}
              <div style={{ marginTop: 14 }}>
                <p style={{
                  fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 8,
                  fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Full History
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(student.attendanceRecords ?? []).map((r, i) => (
                    <div key={i} title={`${r.date}: ${r.status}`} style={{
                      width: 10, height: 10, borderRadius: 3,
                      background: r.status === 'PRESENT' ? '#10b981' : '#ef4444',
                    }} />
                  ))}
                  {(student.attendanceRecords ?? []).length === 0 && (
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>No records</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: AI + parent */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 12,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                AI Risk Analysis
              </p>

              {aiLoading ? (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, width: '70%', animation: 'pulse 1.5s infinite' }} />
                </div>
              ) : aiStatus ? (
                <div style={{
                  background: rating.bg, borderRadius: 12, padding: '14px 16px',
                  border: `1px solid ${rating.color}33`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{rating.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: rating.color, fontFamily: "'DM Sans', sans-serif" }}>
                      {rating.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif", marginLeft: 'auto' }}>
                      Groq / llama-3.3-70b
                    </span>
                  </div>
                  <p style={{
                    fontSize: 12, color: '#475569', lineHeight: 1.6,
                    fontFamily: "'DM Sans', sans-serif", margin: 0,
                  }}>
                    {aiStatus.reasoning}
                  </p>
                </div>
              ) : (
                <div style={{
                  background: '#f8fafc', borderRadius: 12, padding: '14px 16px',
                  border: '1px solid #e2e8f0',
                }}>
                  <p style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
                    AI analysis unavailable. Using rule-based rating.
                  </p>
                </div>
              )}

              {/* Parent contact */}
              <div style={{
                marginTop: 14, background: '#f8fafc', borderRadius: 12,
                padding: '12px 14px', border: '1px solid #e2e8f0',
              }}>
                <p style={{
                  fontSize: 10, color: '#94a3b8', marginBottom: 6,
                  fontFamily: "'DM Sans', sans-serif",
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                }}>
                  Parent / Guardian
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {student.parentPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12 }}>📞</span>
                      <span style={{ fontSize: 12, color: '#334155', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                        {student.parentPhone}
                      </span>
                    </div>
                  )}
                  {student.parentEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12 }}>✉️</span>
                      <span style={{ fontSize: 12, color: '#334155', fontFamily: "'DM Sans', sans-serif" }}>
                        {student.parentEmail}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function StudentProgress(): React.ReactElement {
  const [students,   setStudents]   = useState<Student[]>([]);
  const [aiStatuses, setAiStatuses] = useState<AIStatus[]>([]);
  const [aiLoading,  setAiLoading]  = useState<boolean>(false);
  const [aiError,    setAiError]    = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search,     setSearch]     = useState<string>('');
  const [filter,     setFilter]     = useState<FilterKey>('all');
  const [sortBy,     setSortBy]     = useState<SortKey>('attendance');

  // Load students from localStorage or mock data
  useEffect(() => {
    setStudents(getStudents());
  }, []);

  // Run Groq AI analysis once students are loaded
  useEffect(() => {
    if (students.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    analyzeAttendanceRisk(students)
      .then((results: AIStatus[]) => setAiStatuses(results))
      .catch((err: unknown) => {
        console.error('Groq analysis failed:', err);
        setAiError('AI analysis unavailable — showing rule-based risk ratings instead.');
      })
      .finally(() => setAiLoading(false));
  }, [students]);

  // Enrich each student with computed attendance + AI result
  const enriched: EnrichedStudent[] = students.map((s) => {
    const { pct, present, total, consecutive } = computeAttendance(s);
    const classroom = MOCK_CLASSES.find((c) => c.id === s.classId);
    const aiStatus  = aiStatuses.find((a) => a.studentId === s.id) ?? null;
    const rating    = getRatingFromAI(aiStatus, pct);
    return {
      student: s,
      classroom,
      fullName: `${s.firstName} ${s.lastName}`,
      attPct: pct,
      consecutiveAbsences: consecutive,
      totalDays: total,
      presentDays: present,
      aiStatus,
      rating,
    };
  });

  // Summary counts
  const total    = enriched.length;
  const highRisk = enriched.filter((e) => e.rating.label === 'High Risk').length;
  const onTrack  = enriched.filter((e) => e.rating.label === 'On Track').length;
  const avgAtt   = Math.round(enriched.reduce((a, e) => a + e.attPct, 0) / (total || 1));

  // Filter + sort
  const filtered: EnrichedStudent[] = enriched
    .filter((e) => {
      const q = search.toLowerCase();
      if (
        q &&
        !e.fullName.toLowerCase().includes(q) &&
        !e.student.rollNumber.toLowerCase().includes(q) &&
        !(e.classroom?.name ?? '').toLowerCase().includes(q)
      ) return false;
      if (filter === 'high')    return e.rating.label === 'High Risk';
      if (filter === 'medium')  return e.rating.label === 'Moderate';
      if (filter === 'low')     return e.rating.label === 'On Track';
      if (filter === 'at-risk') return e.attPct < 75 || e.consecutiveAbsences >= 3;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name')       return a.fullName.localeCompare(b.fullName);
      if (sortBy === 'attendance') return a.attPct - b.attPct;
      if (sortBy === 'risk') {
        const order: Record<string, number> = { 'High Risk': 0, 'Moderate': 1, 'On Track': 2 };
        return (order[a.rating.label] ?? 3) - (order[b.rating.label] ?? 3);
      }
      return 0;
    });

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all',     label: 'All'          },
    { key: 'high',    label: '🚨 High Risk'  },
    { key: 'medium',  label: '⚠️ Moderate'   },
    { key: 'low',     label: '✅ On Track'   },
    { key: 'at-risk', label: '📅 Absent 3+'  },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        *, *::before, *::after { box-sizing: border-box; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Student Progress
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>
              AI-powered attendance risk analysis &amp; tracking
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* AI status pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 10, fontSize: 11, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              background:   aiLoading ? '#fef3c7' : aiError ? '#fee2e2' : '#d1fae5',
              border:      `1px solid ${aiLoading ? '#fbbf24' : aiError ? '#ef4444' : '#10b981'}44`,
              color:        aiLoading ? '#b45309' : aiError ? '#dc2626' : '#065f46',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: 999,
                background: aiLoading ? '#f59e0b' : aiError ? '#ef4444' : '#10b981',
                animation: aiLoading ? 'pulse 1.2s infinite' : 'none',
              }} />
              {aiLoading ? 'AI Analyzing…' : aiError ? 'AI Unavailable' : 'AI Active · Groq'}
            </div>

            <button
              type="button"
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 14px rgba(99,102,241,0.28)',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* AI error banner */}
        {aiError && (
          <div style={{
            marginTop: 12, padding: '10px 16px', borderRadius: 10,
            background: '#fef3c7', border: '1px solid #fbbf24',
            fontSize: 12, color: '#92400e', fontFamily: "'DM Sans', sans-serif",
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠️</span> {aiError}
          </div>
        )}
      </div>

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12, marginBottom: 26 }}>
        <StatCard icon="👥" label="Total Students" value={total}         color="#3b82f6" bg="#dbeafe" />
        <StatCard icon="🚨" label="High Risk"       value={highRisk}     sub="Need attention"  color="#ef4444" bg="#fee2e2" />
        <StatCard icon="✅" label="On Track"        value={onTrack}      sub={`${Math.round((onTrack / (total || 1)) * 100)}% of students`} color="#10b981" bg="#d1fae5" />
        <StatCard icon="📊" label="Avg Attendance"  value={`${avgAtt}%`} sub="Across all classes" color="#8b5cf6" bg="#ede9fe" />
      </div>

      {/* ── Controls ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        padding: '14px 18px', marginBottom: 18,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2.5}
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search name, roll no, class…"
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: 9,
              border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a',
              outline: 'none', fontFamily: "'DM Sans', sans-serif", background: '#f8fafc',
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {filterOptions.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 12px', borderRadius: 999, border: '1.5px solid',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                background:  filter === f.key ? '#6366f1' : '#f8fafc',
                color:       filter === f.key ? '#fff'    : '#64748b',
                borderColor: filter === f.key ? '#6366f1' : '#e2e8f0',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <select
          value={sortBy}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortKey)}
          style={{
            padding: '7px 12px', borderRadius: 9, border: '1px solid #e2e8f0',
            fontSize: 11, color: '#64748b', background: '#f8fafc',
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", outline: 'none',
          }}
        >
          <option value="attendance">Sort: Worst Attendance</option>
          <option value="risk">Sort: Highest Risk</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14, fontWeight: 500 }}>
        Showing <strong style={{ color: '#1e293b' }}>{filtered.length}</strong> of {total} students
      </p>

      {/* ── Student Cards ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>No students match your filters</p>
          <p style={{ fontSize: 12 }}>Try adjusting the search or filter criteria</p>
        </div>
      ) : (
        filtered.map((data, i) => (
          <StudentCard
            key={data.student.id}
            data={data}
            index={i}
            expanded={expandedId === data.student.id}
            onToggle={() => setExpandedId(expandedId === data.student.id ? null : data.student.id)}
            aiLoading={aiLoading}
          />
        ))
      )}
    </div>
  );
}