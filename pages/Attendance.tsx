/**
 * Attendance.tsx  — UPDATED: uses local Python backend instead of Hugging Face
 *
 * WHAT CHANGED (AI section only — all manual attendance logic is identical):
 *   • Removed HF_TOKEN, base64ToBytes, runHFAnalysis
 *   • New runLocalAnalysis() POSTs multipart/form-data to /api/analyse
 *   • AIPhotoModal now stores the raw File instead of base64
 *   • Loading step text updated to reflect local BLIP model
 *
 * REQUIRES:
 *   • server.py running: uvicorn server:app --reload --port 8000
 *   • vite.config.ts proxy:  '/api' → 'http://localhost:8000'
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ClipboardList, Camera, List, Grid, CheckCircle2, Save,
  Download, Eye, Lock, ShieldCheck, ShieldX, AlertTriangle,
  X, Upload, EyeOff, RotateCcw, ChevronRight, Users,
  Loader2, FileText, Check, Sparkles,
} from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  roll_no: string;
  class_name: string;
  parent_name?: string;
  parent_email?: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  date: string;
}

interface ConsentRecord {
  student_id: string;
  granted: boolean;
  timestamp: string;
  parent_name: string;
}

interface AIResult {
  present_ids: string[];
  absent_ids:  string[];
  imageHash:   string;
  summary:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const STUDENTS_KEY   = 'students';
const ATTENDANCE_KEY = 'attendance_records';
const CONSENT_KEY    = 'photo_consents';

const storage = {
  getStudents(): Student[] {
    try { return JSON.parse(localStorage.getItem(STUDENTS_KEY) ?? '[]'); } catch { return []; }
  },
  getAttendance(): AttendanceRecord[] {
    try { return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) ?? '[]'); } catch { return []; }
  },
  saveAttendance(r: AttendanceRecord[]) {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(r));
  },
  getConsents(): ConsentRecord[] {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) ?? '[]'); } catch { return []; }
  },
  saveConsents(c: ConsentRecord[]) {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c));
  },
  hasConsent(studentId: string): boolean {
    return storage.getConsents().find(c => c.student_id === studentId)?.granted ?? false;
  },
  grantConsent(studentId: string, parentName: string) {
    const all = storage.getConsents().filter(c => c.student_id !== studentId);
    all.push({ student_id: studentId, granted: true, timestamp: new Date().toISOString(), parent_name: parentName });
    storage.saveConsents(all);
  },
  revokeConsent(studentId: string) {
    const all = storage.getConsents().map(c =>
      c.student_id === studentId ? { ...c, granted: false, timestamp: new Date().toISOString() } : c,
    );
    storage.saveConsents(all);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateStudents(students: Student[]): Student[] {
  const seen = new Set<string>();
  return students.filter(s => {
    const key = `${(s.class_name ?? '').trim().toLowerCase()}::${(s.roll_no ?? '').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

const TODAY = new Date().toISOString().split('T')[0];

function exportCSV(students: Student[], attendance: AttendanceRecord[], date: string) {
  const esc  = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = students.map(s => {
    const rec = attendance.find(a => a.student_id === s.id && a.date === date);
    return [esc(s.roll_no), esc(s.name), esc(s.class_name), rec?.status ?? 'UNMARKED', date].join(',');
  });
  const csv  = [['Roll No', 'Student Name', 'Class', 'Status', 'Date'].join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `attendance_${date}.csv` }).click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Local backend analysis  (replaces all HF calls)
// ─────────────────────────────────────────────────────────────────────────────

async function runLocalAnalysis(
  file: File,
  consentedStudents: Student[],
  usedHashes: Set<string>,
): Promise<AIResult> {
  const form = new FormData();
  form.append('photo', file);
  form.append('students_json', JSON.stringify(
    consentedStudents.map(s => ({ id: s.id, name: s.name, roll_no: s.roll_no, class_name: s.class_name })),
  ));

  let res: Response;
  try {
    res = await fetch('/api/analyse', { method: 'POST', body: form });
  } catch {
    throw new Error(
      'Cannot reach the local backend.\n' +
      'Run: uvicorn server:app --reload --port 8000\n' +
      'And add proxy config to vite.config.ts.',
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}: ${text}`);
  }

  const data = await res.json() as AIResult;

  if (usedHashes.has(data.imageHash)) {
    throw new Error('This exact photo was already analysed this session. Upload a different photo.');
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive UI  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'success' | 'danger';
  size?: 'default' | 'icon' | 'sm';
}
function Btn({ variant = 'solid', size = 'default', className = '', children, ...props }: BtnProps) {
  const v: Record<string, string> = {
    solid:   'bg-indigo-600 text-white hover:bg-indigo-700',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    ghost:   'bg-transparent text-gray-600 hover:bg-gray-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger:  'bg-red-600 text-white hover:bg-red-700',
  };
  const s: Record<string, string> = {
    default: 'px-4 py-2 text-sm rounded-lg',
    sm:      'px-3 py-1.5 text-xs rounded-lg',
    icon:    'w-9 h-9 rounded-lg',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${v[variant]} ${s[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PRESENT: 'bg-emerald-500',
  LATE:    'bg-amber-400',
  ABSENT:  'bg-red-500',
};

function StatusBtn({ status, current, onClick }: { status: string; current: string | null; onClick: () => void }) {
  const active = current === status;
  return (
    <button onClick={onClick} title={status}
      className={`w-10 h-10 rounded-full font-bold text-sm transition-all duration-150
        ${active ? `${STATUS_STYLES[status]} text-white shadow-md scale-110` : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
      {status[0]}
    </button>
  );
}

function SummaryBar({ students, attendance }: { students: Student[]; attendance: AttendanceRecord[] }) {
  const present  = attendance.filter(a => a.status === 'PRESENT').length;
  const late     = attendance.filter(a => a.status === 'LATE').length;
  const absent   = attendance.filter(a => a.status === 'ABSENT').length;
  const unmarked = students.length - attendance.filter(a => students.some(s => s.id === a.student_id)).length;
  if (!students.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex flex-wrap gap-4 items-center">
      {[
        { label: 'Present',  val: present,  color: 'bg-emerald-500' },
        { label: 'Late',     val: late,     color: 'bg-amber-400'   },
        { label: 'Absent',   val: absent,   color: 'bg-red-500'     },
        { label: 'Unmarked', val: unmarked, color: 'bg-gray-300'    },
      ].map(i => (
        <div key={i.label} className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${i.color}`} />
          <span className="text-sm text-gray-700"><strong>{i.val}</strong> {i.label}</span>
        </div>
      ))}
      <span className="ml-auto text-xs text-gray-400">{students.length} students total</span>
    </div>
  );
}

function StudentCard({ student, status, onMark, readOnly }: {
  student: Student; status: string | null;
  onMark: (id: string, s: 'PRESENT' | 'LATE' | 'ABSENT') => void; readOnly?: boolean;
}) {
  return (
    <Card className="p-4 relative hover:shadow-md transition-shadow">
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${status ? STATUS_STYLES[status] : 'bg-gray-200'}`} />
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center mb-2">
          <span className="text-indigo-700 font-bold text-lg">{student.name.charAt(0).toUpperCase()}</span>
        </div>
        <p className="font-semibold text-center text-sm text-gray-800 mb-0.5 line-clamp-2 leading-tight">{student.name}</p>
        <p className="text-xs text-gray-400 mb-3">Roll {student.roll_no}</p>
        {readOnly ? (
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status ? `${STATUS_STYLES[status]} text-white` : 'bg-gray-100 text-gray-500'}`}>
            {status ?? 'UNMARKED'}
          </span>
        ) : (
          <div className="flex gap-1.5">
            <StatusBtn status="PRESENT" current={status} onClick={() => onMark(student.id, 'PRESENT')} />
            <StatusBtn status="LATE"    current={status} onClick={() => onMark(student.id, 'LATE')}    />
            <StatusBtn status="ABSENT"  current={status} onClick={() => onMark(student.id, 'ABSENT')}  />
          </div>
        )}
      </div>
    </Card>
  );
}

function StudentRow({ student, status, onMark, readOnly }: {
  student: Student; status: string | null;
  onMark: (id: string, s: 'PRESENT' | 'LATE' | 'ABSENT') => void; readOnly?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-1 h-10 rounded-full shrink-0 ${status ? STATUS_STYLES[status] : 'bg-gray-200'}`} />
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center shrink-0">
          <span className="text-indigo-700 font-bold text-sm">{student.name.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">{student.name}</p>
          <p className="text-xs text-gray-400">{student.class_name} · Roll {student.roll_no}</p>
        </div>
      </div>
      {readOnly ? (
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status ? `${STATUS_STYLES[status]} text-white` : 'bg-gray-100 text-gray-500'}`}>
          {status ?? 'UNMARKED'}
        </span>
      ) : (
        <div className="flex gap-1.5">
          <StatusBtn status="PRESENT" current={status} onClick={() => onMark(student.id, 'PRESENT')} />
          <StatusBtn status="LATE"    current={status} onClick={() => onMark(student.id, 'LATE')}    />
          <StatusBtn status="ABSENT"  current={status} onClick={() => onMark(student.id, 'ABSENT')}  />
        </div>
      )}
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Photo Modal  (updated to use local backend + File instead of base64)
// ─────────────────────────────────────────────────────────────────────────────

type ModalStep = 'consent' | 'upload' | 'analyzing' | 'review';

function AIPhotoModal({
  classStudents, assignedClass, usedHashes, onComplete, onClose,
}: {
  classStudents: Student[];
  assignedClass: string;
  usedHashes: Set<string>;
  onComplete: (result: AIResult) => void;
  onClose: () => void;
}) {
  const [step,        setStep]        = useState<ModalStep>('consent');
  const [consents,    setConsents]    = useState<ConsentRecord[]>(storage.getConsents());
  const [file,        setFile]        = useState<File | null>(null);   // raw File, not base64
  const [previewUrl,  setPreviewUrl]  = useState('');
  const [blurred,     setBlurred]     = useState(true);
  const [result,      setResult]      = useState<AIResult | null>(null);
  const [error,       setError]       = useState('');
  const [saved,       setSaved]       = useState(false);
  const [grantModal,  setGrantModal]  = useState<Student | null>(null);
  const [parentInput, setParentInput] = useState('');
  const hasRun = useRef(false);

  const refresh       = () => setConsents(storage.getConsents());
  const consentedList = classStudents.filter(s => storage.hasConsent(s.id));
  const stepNum       = { consent: 1, upload: 2, analyzing: 3, review: 4 }[step];

  const handleGrant = (student: Student) => {
    if (!parentInput.trim()) return;
    storage.grantConsent(student.id, parentInput.trim());
    refresh(); setGrantModal(null); setParentInput('');
  };
  const handleRevoke = (student: Student) => {
    if (!confirm(`Revoke photo consent for ${student.name}?`)) return;
    storage.revokeConsent(student.id); refresh();
  };

  const handleFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError('');
  };

  const runAnalysis = useCallback(async () => {
    if (hasRun.current || !file) return;
    hasRun.current = true;
    try {
      const res = await runLocalAnalysis(file, consentedList, usedHashes);
      setResult(res); setStep('review');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('upload'); hasRun.current = false;
    }
  }, [file, consentedList, usedHashes]);

  useEffect(() => { if (step === 'analyzing') runAnalysis(); }, [step, runAnalysis]);

  const handleSave = () => {
    if (!result) return;
    const all    = storage.getAttendance();
    const others = all.filter(r => r.date !== TODAY || !consentedList.some(s => s.id === r.student_id));
    const newRec = [
      ...result.present_ids.map(id => ({ id: crypto.randomUUID(), student_id: id, status: 'PRESENT' as const, date: TODAY })),
      ...result.absent_ids.map(id =>  ({ id: crypto.randomUUID(), student_id: id, status: 'ABSENT'  as const, date: TODAY })),
    ];
    storage.saveAttendance([...others, ...newRec]);
    usedHashes.add(result.imageHash);
    setSaved(true);
    onComplete(result);
  };

  const Dot = ({ n, label }: { n: number; label: string }) => (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
        n < stepNum ? 'bg-emerald-500 text-white' : n === stepNum ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-100 text-gray-400'
      }`}>
        {n < stepNum ? <Check className="w-3.5 h-3.5" /> : n}
      </div>
      <span className={`text-xs whitespace-nowrap ${n === stepNum ? 'text-indigo-600 font-semibold' : n < stepNum ? 'text-emerald-600' : 'text-gray-400'}`}>{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">AI Photo Attendance</p>
              <p className="text-xs text-gray-400">Class {assignedClass} · Local BLIP model</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step bar */}
        <div className="flex items-center px-6 py-3 border-b border-gray-100 gap-2 shrink-0">
          <Dot n={1} label="Consent" />
          <div className={`flex-1 h-0.5 rounded-full ${stepNum > 1 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          <Dot n={2} label="Upload" />
          <div className={`flex-1 h-0.5 rounded-full ${stepNum > 2 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          <Dot n={3} label="Analysing" />
          <div className={`flex-1 h-0.5 rounded-full ${stepNum > 3 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          <Dot n={4} label="Review" />
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* STEP 1: CONSENT */}
          {step === 'consent' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Privacy Notice</p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                    AI photo analysis is only run for students whose parents have explicitly consented.
                    Photos are processed locally on your server and are never sent to external APIs.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong className="text-emerald-600">{consentedList.length}</strong>
                  <span className="text-gray-400"> / {classStudents.length}</span> students with photo consent
                </p>
                {consentedList.length > 0 && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg font-medium">Ready to proceed</span>
                )}
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {classStudents.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No students in Class {assignedClass}.</p>
                  </div>
                ) : classStudents.map(student => {
                  const hasC   = storage.hasConsent(student.id);
                  const record = consents.find(c => c.student_id === student.id && c.granted);
                  return (
                    <div key={student.id} className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${hasC ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${hasC ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {hasC ? <ShieldCheck className="w-4 h-4" /> : student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                          <p className="text-xs text-gray-400">
                            Roll {student.roll_no}
                            {record && <span className="text-emerald-600"> · Consented by {record.parent_name}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 ml-2">
                        {hasC ? (
                          <Btn variant="danger" size="sm" onClick={() => handleRevoke(student)}><ShieldX className="w-3 h-3" /> Revoke</Btn>
                        ) : (
                          <Btn variant="success" size="sm" onClick={() => { setGrantModal(student); setParentInput(student.parent_name ?? ''); }}><ShieldCheck className="w-3 h-3" /> Grant</Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end pt-1">
                <Btn disabled={consentedList.length === 0} onClick={() => { setError(''); setStep('upload'); }}>
                  Continue to Upload <ChevronRight className="w-4 h-4" />
                </Btn>
              </div>
            </>
          )}

          {/* STEP 2: UPLOAD */}
          {step === 'upload' && (
            <>
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800">
                  <strong>{consentedList.length}</strong> student{consentedList.length !== 1 ? 's' : ''} with consent will be included.
                </p>
              </div>
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 whitespace-pre-wrap">{error}</p>
                </div>
              )}
              <div
                onClick={() => document.getElementById('hf-photo-input')?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f); }}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer"
              >
                {previewUrl ? (
                  <div className="relative">
                    <img src={previewUrl} alt="Preview"
                      className={`max-h-52 mx-auto rounded-xl object-contain shadow-md transition-all duration-300 ${blurred ? 'blur-md scale-95' : ''}`} />
                    {blurred && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <EyeOff className="w-6 h-6 text-gray-700" />
                        <button onClick={e => { e.stopPropagation(); setBlurred(false); }} className="text-xs text-indigo-600 underline font-medium">Click to preview</button>
                      </div>
                    )}
                    {!blurred && (
                      <button onClick={e => { e.stopPropagation(); setBlurred(true); }}
                        className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Hide
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Upload className="w-7 h-7 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Drag & drop or click to upload</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP · max 10 MB</p>
                    </div>
                  </div>
                )}
                <input id="hf-photo-input" type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex gap-3">
                <Lock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p className="font-semibold text-gray-700">How your privacy is protected:</p>
                  <p>• Photo processed locally — never sent to external cloud APIs</p>
                  <p>• Only consented students are passed to the AI model</p>
                  <p>• SHA-256 hash — duplicate photos are auto-rejected</p>
                  <p>• No biometric or facial data is saved after the session ends</p>
                </div>
              </div>
              <div className="flex justify-between pt-1">
                <Btn variant="outline" onClick={() => setStep('consent')}>← Back</Btn>
                <Btn disabled={!file} onClick={() => { hasRun.current = false; setStep('analyzing'); }}>
                  <Sparkles className="w-4 h-4" /> Analyse with AI
                </Btn>
              </div>
            </>
          )}

          {/* STEP 3: ANALYSING */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">Local AI is analysing…</p>
                <p className="text-sm text-gray-500 mt-1">Only consented students are being processed</p>
              </div>
              <div className="space-y-2 text-center">
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2">
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                  BLIP image captioning (Salesforce/blip-image-captioning-base)…
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Headcount extraction &amp; name matching…
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Lock className="w-3 h-3" /> Running locally — no data leaves your server
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW */}
          {step === 'review' && result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.present_ids.length}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Present</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl py-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.absent_ids.length}</p>
                  <p className="text-xs text-red-600 font-medium mt-0.5">Absent</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl py-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{consentedList.length}</p>
                  <p className="text-xs text-indigo-600 font-medium mt-0.5">Analysed</p>
                </div>
              </div>
              {result.summary && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-600 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> AI Caption / Summary
                  </p>
                  <p className="text-sm text-indigo-900 leading-relaxed">{result.summary}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">✓ Present</p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {result.present_ids.length === 0
                      ? <p className="text-xs text-gray-400 italic">No students detected as present</p>
                      : result.present_ids.map(id => {
                          const s = consentedList.find(x => x.id === id);
                          return s ? (
                            <div key={id} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold text-emerald-900">{s.name}</p>
                                <p className="text-xs text-emerald-600">Roll {s.roll_no}</p>
                              </div>
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            </div>
                          ) : null;
                        })
                    }
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">✗ Absent</p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {result.absent_ids.length === 0
                      ? <p className="text-xs text-gray-400 italic">All students accounted for</p>
                      : result.absent_ids.map(id => {
                          const s = consentedList.find(x => x.id === id);
                          return s ? (
                            <div key={id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold text-red-900">{s.name}</p>
                                <p className="text-xs text-red-500">Roll {s.roll_no}</p>
                              </div>
                              <X className="w-4 h-4 text-red-400 shrink-0" />
                            </div>
                          ) : null;
                        })
                    }
                  </div>
                </div>
              </div>
              {previewUrl && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">Analysed Photo</p>
                    <button onClick={() => setBlurred(!blurred)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                      {blurred ? <><Eye className="w-3 h-3" /> Show</> : <><EyeOff className="w-3 h-3" /> Hide</>}
                    </button>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    <img src={previewUrl} alt="Class photo"
                      className={`w-full object-contain max-h-36 transition-all duration-300 ${blurred ? 'blur-xl' : ''}`} />
                    {blurred && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-gray-700 font-semibold bg-white/80 px-3 py-1.5 rounded-lg backdrop-blur-sm">Blurred for privacy</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Review carefully before saving.</strong> BLIP estimates headcount — students assigned by roll number order.
                  Always verify against your register. Photo will not be retained after closing.
                </p>
              </div>
              <div className="flex justify-between pt-1">
                <Btn variant="outline" onClick={() => { setStep('upload'); hasRun.current = false; setResult(null); setSaved(false); }}>
                  <RotateCcw className="w-4 h-4" /> Try Again
                </Btn>
                <Btn variant={saved ? 'success' : 'solid'} disabled={saved} onClick={handleSave}>
                  {saved ? <><Check className="w-4 h-4" /> Saved to Attendance</> : <><FileText className="w-4 h-4" /> Save Attendance Records</>}
                </Btn>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Grant consent sub-modal */}
      {grantModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setGrantModal(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Grant Photo Consent</h3>
              <button onClick={() => setGrantModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Parent confirms local AI photo analysis of <strong>{grantModal.name}</strong> for attendance. No biometric data stored permanently.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Student</label>
                <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                  {grantModal.name} — {grantModal.class_name} · Roll {grantModal.roll_no}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Parent / Guardian Name *</label>
                <input value={parentInput} onChange={e => setParentInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGrant(grantModal)}
                  placeholder={grantModal.parent_name || "Enter parent's full name"}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <Btn variant="outline" size="sm" onClick={() => setGrantModal(null)}>Cancel</Btn>
                <Btn variant="success" size="sm" disabled={!parentInput.trim()} onClick={() => handleGrant(grantModal)}>
                  <ShieldCheck className="w-3 h-3" /> Confirm Consent
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER VIEW  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function TeacherAttendanceView({ assignedClass }: { assignedClass: string }) {
  const [viewMode,      setViewMode]      = useState<'grid' | 'list'>('grid');
  const [allStudents,   setAllStudents]   = useState<Student[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [toast,         setToast]         = useState<string | null>(null);
  const [saved,         setSaved]         = useState(false);
  const [showAIModal,   setShowAIModal]   = useState(false);
  const usedHashes = useRef<Set<string>>(new Set());

  const reload = () => {
    setAllStudents(deduplicateStudents(storage.getStudents()));
    setAllAttendance(storage.getAttendance());
  };
  useEffect(() => { reload(); }, []);

  const classStudents = allStudents.filter(
    s => s.class_name.trim().toLowerCase() === assignedClass.trim().toLowerCase(),
  );
  const todayAttendance = allAttendance.filter(
    a => a.date === TODAY && classStudents.some(s => s.id === a.student_id),
  );
  const markedCount  = todayAttendance.length;
  const consentCount = classStudents.filter(s => storage.hasConsent(s.id)).length;
  const getStatus    = (id: string): string | null => todayAttendance.find(a => a.student_id === id)?.status ?? null;

  const handleMark = (studentId: string, status: 'PRESENT' | 'LATE' | 'ABSENT') => {
    setSaved(false);
    setAllAttendance(prev => {
      const existing = prev.find(a => a.student_id === studentId && a.date === TODAY);
      let updated: AttendanceRecord[];
      if (existing) {
        updated = existing.status === status
          ? prev.filter(a => !(a.student_id === studentId && a.date === TODAY))
          : prev.map(a => a.student_id === studentId && a.date === TODAY ? { ...a, status } : a);
      } else {
        updated = [...prev, { id: crypto.randomUUID(), student_id: studentId, status, date: TODAY }];
      }
      storage.saveAttendance(updated);
      return updated;
    });
  };

  const handleMarkAllPresent = () => {
    setSaved(false);
    setAllAttendance(prev => {
      const others = prev.filter(a => a.date !== TODAY || !classStudents.some(s => s.id === a.student_id));
      const newRec = classStudents.map(s => ({ id: crypto.randomUUID(), student_id: s.id, status: 'PRESENT' as const, date: TODAY }));
      const updated = [...others, ...newRec];
      storage.saveAttendance(updated);
      return updated;
    });
    setToast(`Marked all ${classStudents.length} students as Present`);
  };

  const handleSave = () => { storage.saveAttendance(allAttendance); setSaved(true); setToast('Attendance saved successfully!'); };
  const handleComplete = () => {
    const unmarked = classStudents.filter(s => !getStatus(s.id));
    if (unmarked.length > 0) { setToast(`${unmarked.length} student(s) still unmarked.`); return; }
    handleSave();
  };
  const handleAIComplete = (result: AIResult) => {
    reload();
    setToast(`AI attendance saved — ${result.present_ids.length} present · ${result.absent_ids.length} absent`);
    setShowAIModal(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mark Attendance — Class {assignedClass}</h1>
          <p className="text-sm text-gray-500 mt-1">{formatToday()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="outline" onClick={() => exportCSV(classStudents, todayAttendance, TODAY)} disabled={!classStudents.length}>
            <Download className="w-4 h-4" /><span className="hidden sm:inline">CSV</span>
          </Btn>
          <Btn variant="outline" size="icon" title="Save" onClick={handleSave}>
            <ClipboardList className="w-4 h-4" />
          </Btn>
          <div className="relative">
            <Btn size="icon" title="AI Photo Attendance"
              onClick={() => setShowAIModal(true)} disabled={!classStudents.length}
              className="relative bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0">
              <Camera className="w-4 h-4" />
            </Btn>
            {consentCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center text-white text-[7px] font-bold">
                {consentCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex-wrap">
        <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
        <p className="text-sm text-indigo-700 font-medium">Showing <strong>Class {assignedClass}</strong> only.</p>
        {consentCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
            <ShieldCheck className="w-3 h-3" />{consentCount} student{consentCount !== 1 ? 's' : ''} with photo consent
          </span>
        )}
      </div>

      <SummaryBar students={classStudents} attendance={todayAttendance} />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Btn onClick={handleMarkAllPresent} disabled={!classStudents.length}>
            <CheckCircle2 className="w-4 h-4" /> Mark All Present
          </Btn>
          <Btn variant={saved ? 'success' : 'outline'} onClick={handleComplete} disabled={!classStudents.length}>
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : `Complete (${markedCount}/${classStudents.length})`}
          </Btn>
        </div>
        <div className="flex gap-2 justify-end">
          <Btn variant={viewMode === 'list' ? 'solid' : 'outline'} size="icon" onClick={() => setViewMode('list')}><List className="w-4 h-4" /></Btn>
          <Btn variant={viewMode === 'grid' ? 'solid' : 'outline'} size="icon" onClick={() => setViewMode('grid')}><Grid className="w-4 h-4" /></Btn>
        </div>
      </div>

      {!classStudents.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Users className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-base font-medium text-gray-500">No students in Class {assignedClass}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold text-gray-800">Class {assignedClass}</h2>
            <span className="text-sm text-gray-400">({classStudents.length})</span>
            <div className="flex-1 max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${(markedCount / classStudents.length) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-400">{markedCount}/{classStudents.length} marked</span>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {classStudents.map(s => <StudentCard key={s.id} student={s} status={getStatus(s.id)} onMark={handleMark} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {classStudents.map(s => <StudentRow key={s.id} student={s} status={getStatus(s.id)} onMark={handleMark} />)}
            </div>
          )}
        </div>
      )}

      {showAIModal && (
        <AIPhotoModal
          classStudents={classStudents} assignedClass={assignedClass}
          usedHashes={usedHashes.current} onComplete={handleAIComplete}
          onClose={() => setShowAIModal(false)}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL VIEW  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function PrincipalAttendanceView() {
  const [selectedClass, setSelectedClass] = useState('all');
  const [viewMode,      setViewMode]      = useState<'grid' | 'list'>('list');
  const [allStudents,   setAllStudents]   = useState<Student[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    setAllStudents(deduplicateStudents(storage.getStudents()));
    setAllAttendance(storage.getAttendance());
  }, []);

  const todayAttendance    = allAttendance.filter(a => a.date === TODAY);
  const classNames         = Array.from(new Set(allStudents.map(s => s.class_name).filter(Boolean))).sort();
  const filteredStudents   = allStudents.filter(s => selectedClass === 'all' || s.class_name.trim() === selectedClass.trim());
  const relevantAttendance = todayAttendance.filter(a => filteredStudents.some(s => s.id === a.student_id));
  const getStatus          = (id: string) => todayAttendance.find(a => a.student_id === id)?.status ?? null;

  const grouped = filteredStudents.reduce<Record<string, Student[]>>((acc, s) => {
    const key = s.class_name || 'Unassigned';
    (acc[key] = acc[key] ?? []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Attendance Reports</h1>
          <p className="text-sm text-gray-500 mt-1">{formatToday()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg">
            <Eye className="w-3.5 h-3.5" /> View Only
          </div>
          <Btn variant="outline" onClick={() => exportCSV(filteredStudents, todayAttendance, TODAY)} disabled={!filteredStudents.length}>
            <Download className="w-4 h-4" /><span className="hidden sm:inline ml-1">Download CSV</span>
          </Btn>
        </div>
      </div>

      <SummaryBar students={filteredStudents} attendance={relevantAttendance} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48">
          <option value="all">All Classes</option>
          {classNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-2 ml-auto">
          <Btn variant={viewMode === 'list' ? 'solid' : 'outline'} size="icon" onClick={() => setViewMode('list')}><List className="w-4 h-4" /></Btn>
          <Btn variant={viewMode === 'grid' ? 'solid' : 'outline'} size="icon" onClick={() => setViewMode('grid')}><Grid className="w-4 h-4" /></Btn>
        </div>
      </div>

      {!filteredStudents.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium text-gray-500">No students found</p>
        </div>
      ) : (
        Object.entries(grouped).map(([className, students]) => (
          <div key={className}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-gray-800">{className}</h2>
              <span className="text-sm text-gray-400">({students.length} students)</span>
              <div className="flex-1 max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                  style={{ width: `${(students.filter(s => getStatus(s.id) === 'PRESENT').length / students.length) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-400">
                {students.filter(s => getStatus(s.id) === 'PRESENT').length}/{students.length} present
              </span>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {students.map(s => <StudentCard key={s.id} student={s} status={getStatus(s.id)} onMark={() => {}} readOnly />)}
              </div>
            ) : (
              <div className="space-y-2">
                {students.map(s => <StudentRow key={s.id} student={s} status={getStatus(s.id)} onMark={() => {}} readOnly />)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user } = useAuth();
  if (!user) return <div className="p-10 text-center text-gray-400">Loading…</div>;
  if (user.role === 'PRINCIPAL') return <PrincipalAttendanceView />;
  return <TeacherAttendanceView assignedClass={user.assignedClass ?? ''} />;
}