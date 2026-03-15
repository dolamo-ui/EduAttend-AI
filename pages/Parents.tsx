import React, { useState, useEffect } from 'react';
import { Send, Mail, Phone, X, Users, CheckCircle, XCircle, Paperclip, Download, Eye } from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Student {
  id: string; name: string; roll_no: string; class_name: string;
  parent_name?: string; parent_contact?: string; parent_email?: string;
}
interface AttendanceRecord {
  id: string; student_id: string; status: 'PRESENT' | 'LATE' | 'ABSENT'; date: string; reason?: string;
}
interface ParentRow {
  id: string; parent_name: string; parent_contact: string; parent_email: string;
  student_name: string; roll_no: string; class_name: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'UNMARKED'; reason: string;
}
interface LeaveAttachment {
  name: string; type: string; size: number; dataUrl: string;
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
  saveAttendance(r: AttendanceRecord[]) { localStorage.setItem('attendance_records', JSON.stringify(r)); },
  getLeaveRequests(): LeaveRequest[] {
    try { return JSON.parse(localStorage.getItem('leave_requests') ?? '[]'); } catch { return []; }
  },
  saveLeaveRequests(r: LeaveRequest[]) { localStorage.setItem('leave_requests', JSON.stringify(r)); },
  getStaffNotifications(): StaffLeaveNotification[] {
    try { return JSON.parse(localStorage.getItem('staff_leave_notifications') ?? '[]'); } catch { return []; }
  },
  saveStaffNotifications(n: StaffLeaveNotification[]) { localStorage.setItem('staff_leave_notifications', JSON.stringify(n)); },
};

const today = new Date().toISOString().split('T')[0];

function fmtDate(s: string) { return new Date(s + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtShort(s: string) { return new Date(s + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }); }
function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Avatar
// ═══════════════════════════════════════════════════════════════════════════════

const PALETTES = [
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
];
function PersonAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const idx = (name ?? 'A').toUpperCase().charCodeAt(0) % PALETTES.length;
  const { bg, text, border } = PALETTES[idx];
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0]?.[0] ?? '?').toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `2px solid ${border}`, boxShadow: '0 0 0 2px #fff,0 1px 3px rgba(0,0,0,0.08)', color: text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: size <= 32 ? 11 : 13, letterSpacing: '-0.02em', userSelect: 'none', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      {initials}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI Primitives
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'success' | 'danger';
  size?: 'default' | 'sm' | 'icon';
}
function Btn({ variant = 'solid', size = 'default', className = '', children, ...props }: BtnProps) {
  const v = { solid: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm', outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50', ghost: 'bg-transparent text-gray-600 hover:bg-gray-100', success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm', danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm' };
  const s = { default: 'px-4 py-2 text-sm rounded-lg', sm: 'px-3 py-1.5 text-xs rounded-lg', icon: 'w-8 h-8 rounded-lg' };
  return <button className={`inline-flex items-center justify-center font-medium gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`} {...props}>{children}</button>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { PRESENT: 'bg-green-100 text-green-700 border-green-200', LATE: 'bg-yellow-100 text-yellow-700 border-yellow-200', ABSENT: 'bg-red-100 text-red-700 border-red-200', UNMARKED: 'bg-gray-100 text-gray-500 border-gray-200' };
  const icons: Record<string, string> = { PRESENT: '✅', LATE: '🕐', ABSENT: '❌', UNMARKED: '—' };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] ?? styles.UNMARKED}`}>{icons[status] ?? '—'} {status}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Toast
// ═══════════════════════════════════════════════════════════════════════════════

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'err'; visible: boolean }>({ message: '', type: 'ok', visible: false });
  const show = (message: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  };
  const ToastEl = toast.visible ? (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white border ${toast.type === 'ok' ? 'bg-emerald-800 border-emerald-600' : 'bg-red-800 border-red-600'}`} style={{ animation: 'toastSlide .35s ease both' }}>
      <span className="text-lg">{toast.type === 'ok' ? '✅' : '⚠️'}</span>{toast.message}
    </div>
  ) : null;
  return { show, ToastEl };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Leave type config
// ═══════════════════════════════════════════════════════════════════════════════

const LV_CFG = {
  MEDICAL:  { icon: '🏥', label: 'Medical',  bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  FAMILY:   { icon: '🏠', label: 'Family',   bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  PERSONAL: { icon: '👤', label: 'Personal', bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   },
  OTHER:    { icon: '📋', label: 'Other',    bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200'   },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✨ ATTACHMENT VIEWER MODAL  — staff view uploaded proof documents
// ═══════════════════════════════════════════════════════════════════════════════

function AttachmentModal({ attachments, onClose }: { attachments: LeaveAttachment[]; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const att = attachments[active];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setActive(i => Math.min(i + 1, attachments.length - 1));
      if (e.key === 'ArrowLeft')  setActive(i => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [attachments.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}>
      {/* Overlay close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex flex-col w-full max-w-3xl max-h-[90vh]" style={{ animation: 'modalIn .25s ease both' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{ background: 'rgba(255,255,255,.07)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.12)', borderBottom: 'none' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{att.type.startsWith('image/') ? '🖼️' : '📄'}</span>
            <div>
              <div className="font-bold text-white text-sm">{att.name}</div>
              <div className="text-xs text-white/40 mt-0.5">{fmtBytes(att.size)} · {att.type === 'application/pdf' ? 'PDF Document' : att.type.replace('image/','').toUpperCase() + ' Image'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Download */}
            <a href={att.dataUrl} download={att.name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
              style={{ background: 'rgba(56,189,248,.2)', border: '1px solid rgba(56,189,248,.4)' }}
              title="Download file">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
            {/* Close */}
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all" title="Close (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-auto flex items-center justify-center rounded-b-2xl min-h-0" style={{ background: 'rgba(10,10,10,.95)', border: '1px solid rgba(255,255,255,.08)', borderTop: 'none', minHeight: 300 }}>
          {att.type.startsWith('image/') ? (
            <img src={att.dataUrl} alt={att.name} className="max-w-full max-h-[65vh] object-contain p-4 rounded-xl" style={{ animation: 'fadeInImg .2s ease both' }} />
          ) : (
            /* PDF — use iframe for in-browser preview */
            <iframe src={att.dataUrl} title={att.name} className="w-full rounded-b-2xl" style={{ height: '65vh', border: 'none' }} />
          )}
        </div>

        {/* Thumbnails — if multiple files */}
        {attachments.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {attachments.map((a, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === active ? 'border-sky-400 scale-105' : 'border-white/10 opacity-50 hover:opacity-80'}`}>
                {a.type.startsWith('image/') ? (
                  <img src={a.dataUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-2xl">📄</div>
                )}
              </button>
            ))}
          </div>
        )}
        {attachments.length > 1 && (
          <div className="text-center text-xs text-white/30 mt-2 font-medium">
            {active + 1} / {attachments.length} &nbsp;·&nbsp; ← → to navigate
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✨ LEAVE REQUESTS PANEL  — with proof/document viewing
// ═══════════════════════════════════════════════════════════════════════════════

function LeaveRequestsPanel({ assignedClass, isPrincipal, onUpdate }: {
  assignedClass: string; isPrincipal: boolean; onUpdate: () => void;
}) {
  const [notifs,       setNotifs]       = useState<StaffLeaveNotification[]>([]);
  const [leaves,       setLeaves]       = useState<LeaveRequest[]>([]);
  const [noteInputs,   setNoteInputs]   = useState<Record<string, string>>({});
  const [collapsed,    setCollapsed]    = useState(false);
  const [viewingDocs,  setViewingDocs]  = useState<LeaveAttachment[] | null>(null);

  const reload = () => {
    const all  = storage.getStaffNotifications();
    const reqs = storage.getLeaveRequests();
    const filtered = isPrincipal
      ? all
      : all.filter(n => n.class_name.trim().toLowerCase() === assignedClass.trim().toLowerCase());
    setNotifs(filtered);
    setLeaves(reqs);
  };

  useEffect(() => { reload(); }, []);

  const getLeave = (id: string) => leaves.find(l => l.id === id);

  const handleApprove = (id: string) => {
    const note = noteInputs[id] ?? '';
    storage.saveLeaveRequests(storage.getLeaveRequests().map(l => l.id === id ? { ...l, status: 'APPROVED' as const, notes: note || 'Approved.' } : l));
    storage.saveStaffNotifications(storage.getStaffNotifications().map(n => n.id === id ? { ...n, read: true } : n));
    reload(); onUpdate();
  };

  const handleReject = (id: string) => {
    const note = noteInputs[id] ?? '';
    storage.saveLeaveRequests(storage.getLeaveRequests().map(l => l.id === id ? { ...l, status: 'REJECTED' as const, notes: note || 'Not approved.' } : l));
    storage.saveStaffNotifications(storage.getStaffNotifications().map(n => n.id === id ? { ...n, read: true } : n));
    reload(); onUpdate();
  };

  const pendingNotifs  = notifs.filter(n => !n.read);
  const resolvedNotifs = notifs.filter(n =>  n.read);
  const pendingCount   = pendingNotifs.length;

  if (notifs.length === 0) return null;

  return (
    <>
      {/* Document viewer modal */}
      {viewingDocs && <AttachmentModal attachments={viewingDocs} onClose={() => setViewingDocs(null)} />}

      <div className="mb-6 rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: pendingCount > 0 ? '#fbbf24' : '#d1d5db', background: pendingCount > 0 ? '#fffbeb' : '#f9fafb' }}>

        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
          style={{ background: pendingCount > 0 ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : '#f9fafb', borderBottom: collapsed ? 'none' : `1px solid ${pendingCount > 0 ? '#fde68a' : '#e5e7eb'}` }}
          onClick={() => setCollapsed(c => !c)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: pendingCount > 0 ? '#fef3c7' : '#f3f4f6', border: `1.5px solid ${pendingCount > 0 ? '#fde68a' : '#e5e7eb'}` }}>📋</div>
            <div>
              <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                Leave Requests
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />{pendingCount} pending
                  </span>
                )}
                {pendingCount === 0 && resolvedNotifs.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-500">all resolved</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 font-medium">
                {isPrincipal ? 'All classes' : `Class ${assignedClass}`} · {notifs.length} total
              </div>
            </div>
          </div>
          <span className="text-gray-400 text-lg" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }}>▼</span>
        </div>

        {!collapsed && (
          <div className="divide-y divide-gray-100">

            {/* ── Pending ── */}
            {pendingNotifs.map(notif => {
              const leave  = getLeave(notif.id);
              const lvCfg  = LV_CFG[notif.leave_type];
              const days   = Math.max(1, Math.floor((new Date(notif.to_date).getTime() - new Date(notif.from_date).getTime()) / 86400000) + 1);
              const hasDoc = (notif.attachments ?? []).length > 0;

              return (
                <div key={notif.id} className="p-5" style={{ background: '#fffdf5' }}>
                  <div className="flex items-start gap-4 flex-wrap">

                    {/* Left — info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-lg font-black"
                        style={{ background: '#fef3c7', border: '1.5px solid #fde68a', color: '#b45309' }}>
                        {notif.student_name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-gray-900 text-sm">{notif.student_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">Class {notif.class_name}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${lvCfg.bg} ${lvCfg.text} ${lvCfg.border}`}>{lvCfg.icon} {lvCfg.label}</span>
                        </div>

                        {/* Date range */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-2">
                          <span>📅</span>
                          <span>{notif.from_date === notif.to_date ? fmtDate(notif.from_date) : `${fmtShort(notif.from_date)} → ${fmtShort(notif.to_date)}`}
                            {days > 1 && <span className="ml-1 text-gray-400">({days} days)</span>}
                          </span>
                        </div>

                        {/* Reason */}
                        <div className="rounded-lg px-3 py-2.5 text-xs text-gray-700 leading-relaxed mb-3"
                          style={{ background: '#fff8e1', border: '1px solid #fde68a' }}>
                          <span className="font-semibold text-amber-700 block mb-0.5">Reason from parent:</span>
                          "{notif.reason}"
                        </div>

                        {/* ✨ DOCUMENTS ROW */}
                        {hasDoc ? (
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                              <Paperclip className="w-3.5 h-3.5" />
                              {notif.attachments!.length} document{notif.attachments!.length !== 1 ? 's' : ''} attached
                            </div>
                            {/* Thumbnails strip */}
                            {notif.attachments!.map((att, j) => (
                              <button key={j}
                                onClick={() => setViewingDocs(notif.attachments!)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}
                                title={`View: ${att.name}`}>
                                {att.type.startsWith('image/') ? (
                                  <img src={att.dataUrl} alt={att.name} className="w-5 h-5 rounded object-cover" />
                                ) : <span className="text-base">📄</span>}
                                <span className="max-w-[80px] truncate">{att.name}</span>
                                <Eye className="w-3 h-3 ml-0.5 opacity-60" />
                              </button>
                            ))}
                            {/* View All button */}
                            <button
                              onClick={() => setViewingDocs(notif.attachments!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                              style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,.35)' }}>
                              <Eye className="w-3.5 h-3.5" /> View All
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                            <Paperclip className="w-3 h-3" />
                            No documents uploaded
                          </div>
                        )}

                        {/* Parent contact */}
                        {(notif.parent_name || notif.parent_contact) && (
                          <div className="flex items-center gap-3 text-xs text-gray-400 mb-3 flex-wrap">
                            {notif.parent_name && <span>👤 {notif.parent_name}</span>}
                            {notif.parent_contact && <span>📞 {notif.parent_contact}</span>}
                            <span className="text-gray-300">·</span>
                            <span>{new Date(notif.submitted_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}

                        {/* Note to parent */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Add note to parent <span className="font-normal text-gray-400">(optional)</span>
                          </label>
                          <input type="text" value={noteInputs[notif.id] ?? ''}
                            onChange={e => setNoteInputs(p => ({ ...p, [notif.id]: e.target.value }))}
                            placeholder="e.g. Please bring a medical certificate on return…"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                        </div>
                      </div>
                    </div>

                    {/* Right — actions */}
                    <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                      <button onClick={() => handleApprove(notif.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 12px rgba(5,150,105,.3)' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleReject(notif.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: '#fff', border: '1.5px solid #fecaca', color: '#dc2626' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── Resolved ── */}
            {resolvedNotifs.length > 0 && (
              <div className="px-5 py-4 bg-gray-50">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recently Resolved</div>
                <div className="space-y-2">
                  {resolvedNotifs.map(notif => {
                    const leave   = getLeave(notif.id);
                    const status  = leave?.status ?? 'PENDING';
                    const lvCfg   = LV_CFG[notif.leave_type];
                    const hasDoc  = (notif.attachments ?? []).length > 0;
                    return (
                      <div key={notif.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white border border-gray-100">
                        <span className="text-base">{lvCfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-700 text-xs">{notif.student_name}</span>
                          <span className="text-gray-400 text-xs ml-2">Class {notif.class_name}</span>
                          <span className="text-gray-300 text-xs mx-1">·</span>
                          <span className="text-gray-400 text-xs">{notif.from_date === notif.to_date ? fmtDate(notif.from_date) : `${fmtShort(notif.from_date)} – ${fmtShort(notif.to_date)}`}</span>
                        </div>
                        {hasDoc && (
                          <button onClick={() => setViewingDocs(notif.attachments!)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:bg-blue-50"
                            style={{ color: '#3b82f6', border: '1px solid #bfdbfe' }}
                            title="View documents">
                            <Paperclip className="w-3 h-3" />
                            {notif.attachments!.length} doc{notif.attachments!.length !== 1 ? 's' : ''}
                          </button>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {status === 'APPROVED' ? '✅' : status === 'REJECTED' ? '✕' : '⏳'} {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Send Message Dialog
// ═══════════════════════════════════════════════════════════════════════════════

function SendMessageDialog({ open, onOpenChange, parent }: { open: boolean; onOpenChange: (o: boolean) => void; parent: ParentRow | null }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open && parent) {
      const tmpl: Record<string, string> = {
        ABSENT: `Dear ${parent.parent_name},\n\nYour child ${parent.student_name} (Roll ${parent.roll_no}, Class ${parent.class_name}) was marked ABSENT today (${today}).\n\nPlease contact the school if this is incorrect.\n\nKind regards,\nSchool Administration`,
        LATE:   `Dear ${parent.parent_name},\n\nYour child ${parent.student_name} arrived LATE today (${today}). Please ensure punctuality.\n\nKind regards,\nSchool Administration`,
      };
      setMessage(tmpl[parent.status] ?? `Dear ${parent.parent_name},\n\n`);
      setSent(false);
    }
  }, [open, parent]);

  if (!open || !parent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <PersonAvatar name={parent.parent_name} size={40} />
            <div>
              <h2 className="text-base font-bold text-gray-900">{parent.parent_name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Parent of {parent.student_name} · Class {parent.class_name}</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {parent.parent_email && <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"><Mail className="w-3 h-3" />{parent.parent_email}</span>}
            {parent.parent_contact && <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200"><Phone className="w-3 h-3" />{parent.parent_contact}</span>}
            <StatusBadge status={parent.status} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn onClick={() => { setSent(true); setTimeout(() => onOpenChange(false), 1200); }} disabled={!message.trim() || sent} className={sent ? '!bg-green-600 hover:!bg-green-600' : ''}>
            {sent ? '✓ Sent!' : <><Send className="w-4 h-4" />Send Message</>}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Parents Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function Parents() {
  const { user } = useAuth();
  const isPrincipal   = user?.role === 'PRINCIPAL';
  const assignedClass = user?.assignedClass ?? '';

  const [searchTerm,     setSearchTerm]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [showMsgDialog,  setShowMsgDialog]  = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentRow | null>(null);
  const [editingReason,  setEditingReason]  = useState<Record<string, string>>({});
  const [parents,        setParents]        = useState<ParentRow[]>([]);
  const [leaveRefresh,   setLeaveRefresh]   = useState(0);

  const { show: showToast, ToastEl } = useToast();

  const loadParents = () => {
    const students   = storage.getStudents();
    const attendance = storage.getAttendance();
    let list = isPrincipal ? students : students.filter(s => s.class_name.trim().toLowerCase() === assignedClass.trim().toLowerCase());
    setParents(list.map(s => {
      const record = attendance.find(a => a.student_id === s.id && a.date === today);
      return {
        id: s.id, parent_name: s.parent_name || 'No name on record',
        parent_contact: s.parent_contact || '', parent_email: s.parent_email || '',
        student_name: s.name, roll_no: s.roll_no, class_name: s.class_name,
        status: (record?.status ?? 'UNMARKED') as ParentRow['status'],
        reason: record?.reason ?? '',
      };
    }));
  };

  useEffect(() => { loadParents(); }, [isPrincipal, assignedClass, leaveRefresh]);

  const handleReasonBlur = (sid: string) => {
    const reason = editingReason[sid];
    if (reason === undefined) return;
    const all = storage.getAttendance();
    const idx = all.findIndex(a => a.student_id === sid && a.date === today);
    if (idx !== -1) { all[idx] = { ...all[idx], reason }; storage.saveAttendance(all); }
    setParents(prev => prev.map(p => p.id === sid ? { ...p, reason } : p));
    setEditingReason(prev => { const n = { ...prev }; delete n[sid]; return n; });
  };

  const counts = {
    PRESENT:  parents.filter(p => p.status === 'PRESENT').length,
    LATE:     parents.filter(p => p.status === 'LATE').length,
    ABSENT:   parents.filter(p => p.status === 'ABSENT').length,
    UNMARKED: parents.filter(p => p.status === 'UNMARKED').length,
  };

  const filtered = parents.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || p.parent_name.toLowerCase().includes(q) || p.student_name.toLowerCase().includes(q) || p.class_name.toLowerCase().includes(q) || p.roll_no.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        @keyframes toastSlide{from{opacity:0;transform:translateY(16px) scale(.96);}to{opacity:1;transform:none;}}
        @keyframes modalIn{from{opacity:0;transform:scale(.97) translateY(10px);}to{opacity:1;transform:none;}}
        @keyframes fadeInImg{from{opacity:0;transform:scale(.98);}to{opacity:1;transform:none;}}
      `}</style>

      {ToastEl}

      {/* ✨ Leave Requests Panel (with document viewer) */}
      <LeaveRequestsPanel
        assignedClass={assignedClass}
        isPrincipal={isPrincipal}
        onUpdate={() => { setLeaveRefresh(n => n + 1); showToast('Leave request updated. Parent has been notified.', 'ok'); }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: "'DM Sans',sans-serif" }}>
            {isPrincipal ? 'Parents & Guardians' : `Class ${assignedClass} — Parents`}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{parents.length} student{parents.length !== 1 ? 's' : ''} · contact parents about today's attendance</p>
        </div>
        <Btn onClick={() => {
          const targets = filtered.filter(p => p.status === 'ABSENT' || p.status === 'LATE');
          if (!targets.length) { showToast('No absent or late students to notify.', 'err'); return; }
          setSelectedParent(targets[0]); setShowMsgDialog(true);
        }} className="w-full sm:w-auto">
          <Send className="w-4 h-4" /> Notify Absent / Late
        </Btn>
      </div>

      {/* Status pills */}
      {parents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[{ key: 'all', label: 'All', count: parents.length, dot: '#6b7280' }, { key: 'PRESENT', label: 'Present', count: counts.PRESENT, dot: '#16a34a' }, { key: 'LATE', label: 'Late', count: counts.LATE, dot: '#ca8a04' }, { key: 'ABSENT', label: 'Absent', count: counts.ABSENT, dot: '#dc2626' }, { key: 'UNMARKED', label: 'Unmarked', count: counts.UNMARKED, dot: '#94a3b8' }].map(pill => (
            <button key={pill.key} onClick={() => setStatusFilter(pill.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${statusFilter === pill.key ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pill.dot }} />{pill.label} <span className="font-bold">{pill.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="p-4 sm:p-6">
        <div className="mb-5">
          <input type="search" placeholder="Search by parent name, student name or class…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="block w-full sm:max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>

        {parents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
            <p className="text-base font-semibold text-gray-500">No student records found</p>
            <a href="/students" className="mt-4 text-sm text-indigo-600 hover:underline font-medium">→ Go to Student Directory</a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-gray-500">No results match your search.</p>
            <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} className="mt-3 text-xs text-indigo-600 hover:underline">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Parent / Guardian', 'Contact', 'Student', 'Class', "Today's Status", 'Reason', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(p => (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${p.status === 'ABSENT' ? 'bg-red-50/40' : p.status === 'LATE' ? 'bg-yellow-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <PersonAvatar name={p.parent_name} size={32} />
                          <div className="font-semibold text-gray-900 whitespace-nowrap">
                            {p.parent_name === 'No name on record' ? <span className="text-gray-400 font-normal italic text-xs">{p.parent_name}</span> : p.parent_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.parent_contact || p.parent_email ? (
                          <div>{p.parent_contact && <div className="text-sm text-gray-700">{p.parent_contact}</div>}{p.parent_email && <div className="text-xs text-gray-400">{p.parent_email}</div>}</div>
                        ) : <span className="text-xs text-gray-300 italic">No contact</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={p.student_name} size={28} />
                          <div><div className="font-medium text-gray-900 whitespace-nowrap">{p.student_name}</div><div className="text-xs text-gray-400">Roll {p.roll_no}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">{p.class_name}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <input value={editingReason[p.id] !== undefined ? editingReason[p.id] : p.reason}
                          onChange={e => setEditingReason(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onBlur={() => handleReasonBlur(p.id)}
                          placeholder={p.status === 'ABSENT' || p.status === 'LATE' ? 'Enter reason…' : '—'}
                          disabled={p.status === 'PRESENT' || p.status === 'UNMARKED'}
                          className="h-8 w-36 block rounded-lg border border-gray-200 px-2 text-xs text-gray-700 placeholder-gray-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-transparent disabled:border-transparent disabled:cursor-default" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Btn variant="ghost" size="icon" title="Send message" onClick={() => { setSelectedParent(p); setShowMsgDialog(true); }}>
                            <Mail className="w-4 h-4 text-blue-500" />
                          </Btn>
                          <Btn variant="ghost" size="icon" title="Call parent" onClick={() => p.parent_contact && window.open(`tel:${p.parent_contact}`)} disabled={!p.parent_contact}>
                            <Phone className={`w-4 h-4 ${p.parent_contact ? 'text-green-500' : 'text-gray-300'}`} />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-right">Showing <strong className="text-gray-700">{filtered.length}</strong> of {parents.length} student{parents.length !== 1 ? 's' : ''}</p>
          </>
        )}
      </Card>

      <SendMessageDialog open={showMsgDialog} onOpenChange={setShowMsgDialog} parent={selectedParent} />
    </div>
  );
}