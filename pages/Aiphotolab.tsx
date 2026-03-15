/**
 * AIPhotoLab.tsx  — UPDATED: uses local Python backend instead of Hugging Face
 *
 * WHAT CHANGED:
 *   • Removed all HF API calls (no more 503s, no more 404s)
 *   • New runLocalAnalysis() sends multipart/form-data to POST /api/analyse
 *   • No VITE_HF_TOKEN needed — backend handles everything
 *   • Everything else (consent UI, review UI, CSV export) is unchanged
 *
 * REQUIRES:
 *   • server.py running: uvicorn server:app --reload --port 8000
 *   • vite.config.ts proxy:  '/api' → 'http://localhost:8000'
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Upload, ShieldCheck, ShieldX, AlertTriangle,
  CheckCircle2, XCircle, Eye, EyeOff, Users,
  FileText, Lock, ChevronRight, RotateCcw, X,
  Sparkles, Loader2, Search, Download,
  Check,
} from 'lucide-react';

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

interface ConsentRecord {
  student_id: string;
  granted: boolean;
  timestamp: string;
  parent_name: string;
}

interface AnalysisResult {
  present_ids:   string[];
  absent_ids:    string[];
  imageHash:     string;
  summary:       string;
  analyzedClass: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const STUDENTS_KEY   = 'students';
const ATTENDANCE_KEY = 'attendance_records';
const CONSENT_KEY    = 'photo_consents';
const TODAY          = new Date().toISOString().split('T')[0];

const storage = {
  getStudents(): Student[] {
    try { return JSON.parse(localStorage.getItem(STUDENTS_KEY) ?? '[]'); } catch { return []; }
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
  saveAttendanceFromAI(result: AnalysisResult, consentedStudents: Student[]) {
    const existing = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) ?? '[]');
    const others   = existing.filter((r: any) =>
      r.date !== TODAY || !consentedStudents.some((s: Student) => s.id === r.student_id),
    );
    const newRec = [
      ...result.present_ids.map(id => ({ id: crypto.randomUUID(), student_id: id, status: 'PRESENT', date: TODAY })),
      ...result.absent_ids.map(id =>  ({ id: crypto.randomUUID(), student_id: id, status: 'ABSENT',  date: TODAY })),
    ];
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify([...others, ...newRec]));
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

function exportConsentCSV(students: Student[], consents: ConsentRecord[]) {
  const esc  = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = students.map(s => {
    const c = consents.find(c => c.student_id === s.id);
    return [esc(s.name), esc(s.roll_no), esc(s.class_name), c?.granted ? 'YES' : 'NO', esc(c?.parent_name ?? ''), c?.timestamp ?? ''].join(',');
  });
  const csv  = [['Name', 'Roll No', 'Class', 'Consent', 'Parent Name', 'Timestamp'].join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `consent_${TODAY}.csv` }).click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Local backend analysis  (replaces all HF calls)
// ─────────────────────────────────────────────────────────────────────────────

async function runLocalAnalysis(
  file: File,
  consentedStudents: Student[],
  usedHashes: Set<string>,
  analyzedClass: string,
): Promise<AnalysisResult> {
  // Build multipart form — send the raw File + students list
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
      'Cannot reach the local backend. Make sure server.py is running:\n' +
      '  uvicorn server:app --reload --port 8000',
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    present_ids: string[];
    absent_ids:  string[];
    imageHash:   string;
    summary:     string;
  };

  if (usedHashes.has(data.imageHash)) {
    throw new Error('This exact photo was already analysed this session. Upload a different photo.');
  }

  return { ...data, analyzedClass };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'default' | 'sm' | 'icon';
}
function Btn({ variant = 'solid', size = 'default', className = '', children, ...props }: BtnProps) {
  const v: Record<string, string> = {
    solid:   'bg-indigo-600 text-white hover:bg-indigo-700',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    ghost:   'text-gray-600 hover:bg-gray-100',
    danger:  'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  const s: Record<string, string> = {
    default: 'px-4 py-2 text-sm rounded-xl',
    sm:      'px-3 py-1.5 text-xs rounded-lg',
    icon:    'w-9 h-9 rounded-xl',
  };
  return (
    <button className={`inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Toast({ message, type = 'success', onDone }: { message: string; type?: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 ${type === 'error' ? 'bg-red-700' : 'bg-gray-900'}`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />}
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'consent' | 'analysis';

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Consent Management  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function ConsentTab({ students, onRefresh }: { students: Student[]; onRefresh: () => void }) {
  const [consents,     setConsents]     = useState<ConsentRecord[]>(storage.getConsents());
  const [search,       setSearch]       = useState('');
  const [filterClass,  setFilterClass]  = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'granted' | 'pending'>('all');
  const [grantModal,   setGrantModal]   = useState<Student | null>(null);
  const [parentInput,  setParentInput]  = useState('');
  const [bulkClass,    setBulkClass]    = useState('');
  const [bulkParent,   setBulkParent]   = useState('');
  const [toast,        setToast]        = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);

  const refresh = () => { setConsents(storage.getConsents()); onRefresh(); };
  const classes = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort();

  const filtered = students.filter(s => {
    const matchSearch  = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_no.includes(search);
    const matchClass   = filterClass === 'all' || s.class_name === filterClass;
    const hasC         = storage.hasConsent(s.id);
    const matchStatus  = filterStatus === 'all' || (filterStatus === 'granted' ? hasC : !hasC);
    return matchSearch && matchClass && matchStatus;
  });

  const grantedAll    = students.filter(s => storage.hasConsent(s.id)).length;
  const grantedFilter = filtered.filter(s => storage.hasConsent(s.id)).length;

  const handleGrant = (student: Student) => {
    if (!parentInput.trim()) return;
    storage.grantConsent(student.id, parentInput.trim());
    refresh(); setGrantModal(null); setParentInput('');
    setToast({ msg: `Consent granted for ${student.name}` });
  };
  const handleRevoke = (student: Student) => {
    if (!confirm(`Revoke photo consent for ${student.name}?`)) return;
    storage.revokeConsent(student.id); refresh();
    setToast({ msg: `Consent revoked for ${student.name}`, type: 'error' });
  };
  const handleBulkGrant = () => {
    if (!bulkClass || !bulkParent.trim()) return;
    const cls = students.filter(s => s.class_name === bulkClass && !storage.hasConsent(s.id));
    cls.forEach(s => storage.grantConsent(s.id, bulkParent.trim()));
    refresh(); setBulkParent('');
    setToast({ msg: `Bulk consent granted for ${cls.length} students in Class ${bulkClass}` });
  };
  const handleRevokeAll = (className: string) => {
    if (!confirm(`Revoke ALL photo consent for Class ${className}?`)) return;
    students.filter(s => s.class_name === className).forEach(s => storage.revokeConsent(s.id));
    refresh(); setToast({ msg: `All consent revoked for Class ${className}`, type: 'error' });
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Students',  val: students.length,              color: 'bg-gray-50 border-gray-200 text-gray-700'         },
          { label: 'Consent Granted', val: grantedAll,                   color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'Pending Consent', val: students.length - grantedAll, color: 'bg-amber-50 border-amber-200 text-amber-700'       },
          { label: 'Classes',         val: classes.length,               color: 'bg-indigo-50 border-indigo-200 text-indigo-700'    },
        ].map(i => (
          <div key={i.label} className={`border rounded-xl px-4 py-3 ${i.color}`}>
            <p className="text-2xl font-bold">{i.val}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{i.label}</p>
          </div>
        ))}
      </div>

      {/* Privacy notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Data Protection Policy</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            AI photo analysis is only performed for students with verified parental/guardian consent.
            Photos are processed locally on the school server and are never sent to third-party cloud APIs.
            No biometric or facial recognition data is retained. Consent records can be exported or revoked at any time.
          </p>
        </div>
      </div>

      {/* Bulk consent */}
      <Card className="p-5">
        <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" /> Bulk Grant Consent — Entire Class
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={bulkClass} onChange={e => setBulkClass(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1">
            <option value="">Select class…</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={bulkParent} onChange={e => setBulkParent(e.target.value)}
            placeholder="Parent / Guardian name for this class"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1" />
          <Btn variant="success" disabled={!bulkClass || !bulkParent.trim()} onClick={handleBulkGrant}>
            <ShieldCheck className="w-4 h-4" /> Grant All
          </Btn>
        </div>
        {bulkClass && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {students.filter(s => s.class_name === bulkClass && !storage.hasConsent(s.id)).length} without consent in {bulkClass}
            </p>
            <button onClick={() => handleRevokeAll(bulkClass)} className="text-xs text-red-500 hover:text-red-700 underline">
              Revoke all for {bulkClass}
            </button>
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll number…"
            className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Status</option>
          <option value="granted">Consent Granted</option>
          <option value="pending">Pending Consent</option>
        </select>
        <Btn variant="outline" size="sm" onClick={() => exportConsentCSV(students, consents)}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Btn>
      </div>

      <p className="text-xs text-gray-400">
        Showing {filtered.length} students · <strong className="text-emerald-600">{grantedFilter}</strong> with consent
      </p>

      {(() => {
        const grouped = filtered.reduce<Record<string, Student[]>>((acc, s) => {
          const key = s.class_name || 'Unassigned';
          (acc[key] = acc[key] ?? []).push(s);
          return acc;
        }, {});
        return Object.entries(grouped).map(([className, classStudents]) => (
          <div key={className}>
            <div className="flex items-center gap-3 mb-2 px-1">
              <h3 className="text-sm font-bold text-gray-700">{className}</h3>
              <span className="text-xs text-gray-400">
                {classStudents.filter(s => storage.hasConsent(s.id)).length}/{classStudents.length} consented
              </span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-24">
                <div className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${(classStudents.filter(s => storage.hasConsent(s.id)).length / classStudents.length) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1.5 mb-4">
              {classStudents.map(student => {
                const hasC   = storage.hasConsent(student.id);
                const record = consents.find(c => c.student_id === student.id && c.granted);
                return (
                  <div key={student.id} className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${hasC ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${hasC ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {hasC ? <ShieldCheck className="w-4 h-4" /> : student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                        <p className="text-xs text-gray-400">
                          Roll {student.roll_no}
                          {student.parent_name && ` · ${student.parent_name}`}
                          {record && <span className="text-emerald-600"> · Consented by {record.parent_name} on {new Date(record.timestamp).toLocaleDateString()}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      {hasC ? (
                        <Btn variant="danger" size="sm" onClick={() => handleRevoke(student)}>
                          <ShieldX className="w-3 h-3" /> Revoke
                        </Btn>
                      ) : (
                        <Btn variant="success" size="sm" onClick={() => { setGrantModal(student); setParentInput(student.parent_name ?? ''); }}>
                          <ShieldCheck className="w-3 h-3" /> Grant
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ));
      })()}

      {!filtered.length && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{!students.length ? 'Add students in the Student Directory first.' : 'No students match your filters.'}</p>
        </div>
      )}

      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setGrantModal(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Grant Photo Consent</h3>
              <button onClick={() => setGrantModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                The parent/guardian confirms they allow AI photo analysis of <strong>{grantModal.name}</strong>'s image for school attendance. No biometric data is permanently stored.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Student</label>
                <div className="text-sm font-semibold bg-gray-50 rounded-lg px-3 py-2">
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
                  <ShieldCheck className="w-3.5 h-3.5" /> Confirm Consent
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — Batch Photo Analysis  (now uses local backend)
// ─────────────────────────────────────────────────────────────────────────────

type AnalysisStep = 'setup' | 'upload' | 'analyzing' | 'review';

function AnalysisTab({ students }: { students: Student[] }) {
  const [step,          setStep]          = useState<AnalysisStep>('setup');
  const [selectedClass, setSelectedClass] = useState('');
  // Store the raw File so we can POST it directly (no base64 needed)
  const [file,          setFile]          = useState<File | null>(null);
  const [previewUrl,    setPreviewUrl]    = useState('');
  const [blurred,       setBlurred]       = useState(true);
  const [result,        setResult]        = useState<AnalysisResult | null>(null);
  const [error,         setError]         = useState('');
  const [saved,         setSaved]         = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);
  const [backendOk,     setBackendOk]     = useState<boolean | null>(null);
  const usedHashes = useRef<Set<string>>(new Set());
  const hasRun     = useRef(false);

  const classes           = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort();
  const consentedStudents = students.filter(s => s.class_name === selectedClass && storage.hasConsent(s.id));

  // Ping backend on mount
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setBackendOk(d?.status === 'ok'))
      .catch(() => setBackendOk(false));
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError('');
  };

  const runAnalysis = useCallback(async () => {
    if (hasRun.current || !file) return;
    hasRun.current = true;
    try {
      const res = await runLocalAnalysis(file, consentedStudents, usedHashes.current, selectedClass);
      setResult(res);
      setStep('review');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('upload');
      hasRun.current = false;
    }
  }, [file, consentedStudents, selectedClass]);

  useEffect(() => { if (step === 'analyzing') runAnalysis(); }, [step, runAnalysis]);

  const handleSave = () => {
    if (!result) return;
    storage.saveAttendanceFromAI(result, consentedStudents);
    usedHashes.current.add(result.imageHash);
    setSaved(true);
    setToast({ msg: `AI attendance saved — ${result.present_ids.length} present · ${result.absent_ids.length} absent` });
  };

  const reset = () => {
    setStep('setup'); setFile(null); setPreviewUrl('');
    setResult(null); setSaved(false); setError('');
    hasRun.current = false;
  };

  const stepNum = { setup: 1, upload: 2, analyzing: 3, review: 4 }[step];

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
    <div className="space-y-5">

      {/* Backend status banner */}
      {backendOk === false && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-900">Local backend not running</p>
            <p className="text-xs text-red-700 mt-1 font-mono bg-red-100 rounded px-2 py-1 inline-block">
              uvicorn server:app --reload --port 8000
            </p>
            <p className="text-xs text-red-600 mt-1">Then add <code className="bg-red-100 px-1 rounded">'/api': 'http://localhost:8000'</code> to your vite.config.ts proxy.</p>
          </div>
        </div>
      )}
      {backendOk === true && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs text-emerald-800 font-medium">Local backend connected · Salesforce/blip-image-captioning-base ready</p>
        </div>
      )}

      {/* Step bar */}
      <div className="flex items-center gap-2">
        <Dot n={1} label="Select Class" />
        <div className={`flex-1 h-0.5 rounded-full ${stepNum > 1 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
        <Dot n={2} label="Upload Photo" />
        <div className={`flex-1 h-0.5 rounded-full ${stepNum > 2 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
        <Dot n={3} label="AI Analysis" />
        <div className={`flex-1 h-0.5 rounded-full ${stepNum > 3 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
        <Dot n={4} label="Review" />
      </div>

      {/* STEP 1: Select class */}
      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Select a class. Only consented students will be included in the analysis.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classes.map(c => {
              const total     = students.filter(s => s.class_name === c).length;
              const consented = students.filter(s => s.class_name === c && storage.hasConsent(s.id)).length;
              const isSelected = selectedClass === c;
              return (
                <button key={c} onClick={() => setSelectedClass(c)}
                  className={`text-left rounded-2xl border p-4 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-gray-900">Class {c}</p>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-xs text-gray-500">{total} students</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${total ? (consented / total) * 100 : 0}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${consented > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{consented} consented</span>
                  </div>
                  {consented === 0 && <p className="text-xs text-amber-600 mt-1.5">⚠ No consent — go to Consent tab first</p>}
                </button>
              );
            })}
          </div>
          {!classes.length && (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No classes found. Add students in the Student Directory first.</p>
            </div>
          )}
          <div className="flex justify-end">
            <Btn disabled={!selectedClass || consentedStudents.length === 0 || backendOk === false} onClick={() => setStep('upload')}>
              Continue <ChevronRight className="w-4 h-4" />
            </Btn>
          </div>
          {selectedClass && consentedStudents.length === 0 && (
            <p className="text-xs text-amber-600 text-right">No consented students in Class {selectedClass}. Grant consent first.</p>
          )}
        </div>
      )}

      {/* STEP 2: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800">
              Analysing <strong>Class {selectedClass}</strong> · <strong>{consentedStudents.length}</strong> consented student{consentedStudents.length !== 1 ? 's' : ''} will be included.
            </p>
          </div>
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 whitespace-pre-wrap">{error}</p>
            </div>
          )}
          <div
            onClick={() => document.getElementById('lab-photo-input')?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f); }}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer"
          >
            {previewUrl ? (
              <div className="relative">
                <img src={previewUrl} alt="Preview"
                  className={`max-h-56 mx-auto rounded-xl object-contain shadow-md transition-all ${blurred ? 'blur-md scale-95' : ''}`} />
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
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Drag & drop or click to upload class photo</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP · max 10 MB</p>
                </div>
              </div>
            )}
            <input id="lab-photo-input" type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex gap-3">
            <Lock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-500 space-y-0.5">
              <p className="font-semibold text-gray-700">Privacy protections active:</p>
              <p>• Photo processed locally on your school server — never sent to third-party APIs</p>
              <p>• Only the {consentedStudents.length} consented students are passed to the model</p>
              <p>• SHA-256 hash prevents duplicate analysis in the same session</p>
              <p>• No facial embeddings or biometric data are retained after review</p>
            </div>
          </div>
          <div className="flex justify-between">
            <Btn variant="outline" onClick={() => { setStep('setup'); setError(''); }}>← Back</Btn>
            <Btn disabled={!file} onClick={() => { hasRun.current = false; setStep('analyzing'); }}>
              <Sparkles className="w-4 h-4" /> Analyse with AI
            </Btn>
          </div>
        </div>
      )}

      {/* STEP 3: Analysing */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
            <Sparkles className="w-10 h-10 text-indigo-600 absolute inset-0 m-auto" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">Local AI is analysing…</p>
            <p className="text-sm text-gray-500 mt-1">Class {selectedClass} · {consentedStudents.length} consented students</p>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-2.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              BLIP image captioning (Salesforce/blip-image-captioning-base)
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-5 py-2.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Headcount extraction &amp; name matching
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
            <Lock className="w-3 h-3" /> Running locally — no data leaves your server
          </div>
        </div>
      )}

      {/* STEP 4: Review */}
      {step === 'review' && result && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl py-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">{result.present_ids.length}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">Present</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl py-4 text-center">
              <p className="text-3xl font-bold text-red-700">{result.absent_ids.length}</p>
              <p className="text-xs text-red-600 font-semibold mt-1">Absent</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl py-4 text-center">
              <p className="text-3xl font-bold text-indigo-700">{consentedStudents.length}</p>
              <p className="text-xs text-indigo-600 font-semibold mt-1">Total Analysed</p>
            </div>
          </div>
          {result.summary && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> AI Caption — Class {result.analyzedClass}
              </p>
              <p className="text-sm text-indigo-900 leading-relaxed">{result.summary}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">✓ Present ({result.present_ids.length})</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {result.present_ids.length === 0
                  ? <p className="text-xs text-gray-400 italic">No students detected as present</p>
                  : result.present_ids.map(id => {
                      const s = consentedStudents.find(x => x.id === id);
                      return s ? (
                        <div key={id} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-emerald-900">{s.name}</p>
                            <p className="text-xs text-emerald-600">{s.class_name} · Roll {s.roll_no}</p>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                      ) : null;
                    })
                }
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">✗ Absent ({result.absent_ids.length})</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {result.absent_ids.length === 0
                  ? <p className="text-xs text-gray-400 italic">All students accounted for</p>
                  : result.absent_ids.map(id => {
                      const s = consentedStudents.find(x => x.id === id);
                      return s ? (
                        <div key={id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-red-900">{s.name}</p>
                            <p className="text-xs text-red-500">{s.class_name} · Roll {s.roll_no}</p>
                          </div>
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
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
                <p className="text-xs font-semibold text-gray-600">Analysed Photo — Class {selectedClass}</p>
                <button onClick={() => setBlurred(!blurred)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  {blurred ? <><Eye className="w-3 h-3" /> Show</> : <><EyeOff className="w-3 h-3" /> Hide</>}
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img src={previewUrl} alt="Class photo"
                  className={`w-full object-contain max-h-48 transition-all duration-300 ${blurred ? 'blur-xl' : ''}`} />
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
              <strong>Review carefully before saving.</strong> BLIP counts visible people — students are assigned by roll number order.
              Always verify against your register. Photos are not retained after this session.
            </p>
          </div>
          <div className="flex justify-between">
            <Btn variant="outline" onClick={reset}><RotateCcw className="w-4 h-4" /> Start Over</Btn>
            <Btn variant={saved ? 'success' : 'solid'} disabled={saved} onClick={handleSave}>
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><FileText className="w-4 h-4" /> Save Attendance Records</>}
            </Btn>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AIPhotoLab() {
  const [tab,      setTab]      = useState<Tab>('consent');
  const [students, setStudents] = useState<Student[]>([]);

  const reload = () => setStudents(deduplicateStudents(storage.getStudents()));
  useEffect(() => { reload(); }, []);

  const consentedCount = students.filter(s => storage.hasConsent(s.id)).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-indigo-100 rounded-2xl shrink-0">
          <Camera className="w-7 h-7 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">AI Photo Lab</h1>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Local Backend
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
              Principal Only
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage photo consent · Run AI batch attendance — all processed locally, no cloud APIs
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span className="text-sm text-gray-700">
            <strong className="text-emerald-600">{consentedCount}</strong>
            <span className="text-gray-400"> / {students.length}</span> students with photo consent
          </span>
        </div>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-48">
          <div className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${students.length ? (consentedCount / students.length) * 100 : 0}%` }} />
        </div>
        {consentedCount === 0 && (
          <span className="text-xs text-amber-600 font-medium">Grant consent before running analysis</span>
        )}
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {([
            { id: 'consent',  label: 'Consent Management', icon: ShieldCheck },
            { id: 'analysis', label: 'Photo Analysis',     icon: Sparkles    },
          ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        {tab === 'consent'  && <ConsentTab  students={students} onRefresh={reload} />}
        {tab === 'analysis' && <AnalysisTab students={students} />}
      </Card>
    </div>
  );
}