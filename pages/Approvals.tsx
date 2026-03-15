// pages/Approvals.tsx
// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Principal approves or rejects pending teacher registrations
//
// Firestore query: users where schoolId == principal's schoolId AND status == 'pending'
// On Approve: updates status → 'active'
// On Reject:  updates status → 'rejected'
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';

import {
  collection, query, where,
  onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';

import { db }       from '../src/firebase/firebaseConfig';
import { useAuth }  from '../src/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingTeacher {
  id:            string;
  name:          string;
  email:         string;
  assignedClass: string;
  createdAt:     any;
  status:        'pending' | 'active' | 'rejected';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function Approvals(): React.ReactElement {
  const { user }        = useAuth();
  const [pending,   setPending]   = useState<PendingTeacher[]>([]);
  const [approved,  setApproved]  = useState<PendingTeacher[]>([]);
  const [rejected,  setRejected]  = useState<PendingTeacher[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState<string | null>(null);  // id being actioned
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const schoolId = user?.schoolId ?? '';

  // ── Real-time listener on all teachers in this school ─────────────────────
  useEffect(() => {
    if (!schoolId) return;
    const q = query(
      collection(db, 'users'),
      where('schoolId', '==', schoolId),
      where('role',     '==', 'TEACHER'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as PendingTeacher));
      setPending(  all.filter(t => t.status === 'pending'));
      setApproved( all.filter(t => t.status === 'active'));
      setRejected( all.filter(t => t.status === 'rejected'));
      setLoading(false);
    });
    return unsub;
  }, [schoolId]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const approve = async (teacher: PendingTeacher) => {
    setActing(teacher.id);
    try {
      await updateDoc(doc(db, 'users', teacher.id), {
        status:     'active',
        approvedAt: serverTimestamp(),
        approvedBy: user?.id,
      });
      showToast(`✅ ${teacher.name} has been approved and can now log in.`, true);
    } catch {
      showToast('Failed to approve. Try again.', false);
    } finally {
      setActing(null);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const reject = async (teacher: PendingTeacher) => {
    if (!window.confirm(`Reject ${teacher.name}'s registration? They will not be able to log in.`)) return;
    setActing(teacher.id);
    try {
      await updateDoc(doc(db, 'users', teacher.id), {
        status:     'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user?.id,
      });
      showToast(`${teacher.name}'s application has been rejected.`, false);
    } catch {
      showToast('Failed to reject. Try again.', false);
    } finally {
      setActing(null);
    }
  };

  // ── Revoke (move active back to rejected) ─────────────────────────────────
  const revoke = async (teacher: PendingTeacher) => {
    if (!window.confirm(`Revoke access for ${teacher.name}? They will not be able to log in.`)) return;
    setActing(teacher.id);
    try {
      await updateDoc(doc(db, 'users', teacher.id), { status: 'rejected' });
      showToast(`${teacher.name}'s access has been revoked.`, false);
    } catch {
      showToast('Failed to revoke. Try again.', false);
    } finally {
      setActing(null);
    }
  };

  // ── Re-approve a rejected teacher ─────────────────────────────────────────
  const reApprove = async (teacher: PendingTeacher) => {
    setActing(teacher.id);
    try {
      await updateDoc(doc(db, 'users', teacher.id), { status: 'active', approvedAt: serverTimestamp() });
      showToast(`✅ ${teacher.name} has been re-approved.`, true);
    } catch {
      showToast('Failed. Try again.', false);
    } finally {
      setActing(null);
    }
  };

  // ─── Teacher card ──────────────────────────────────────────────────────────
  const TeacherCard = ({
    t, actions,
  }: {
    t: PendingTeacher;
    actions: React.ReactNode;
  }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
      borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,.04)', transition: 'box-shadow .15s',
      animation: 'fadeUp .35s ease both',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.04)'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
        border: '1.5px solid #c7d2fe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 18, color: '#6366f1',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {t.name[0]?.toUpperCase()}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>{t.name}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{t.email}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '2px 9px', borderRadius: 999, border: '1px solid #e0e7ff' }}>
            Class {t.assignedClass}
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>
            Applied: {fmtTime(t.createdAt)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {actions}
      </div>
    </div>
  );

  const Btn = ({ onClick, disabled, color, bg, border, children }: {
    onClick: () => void; disabled?: boolean;
    color: string; bg: string; border: string;
    children: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '8px 16px', borderRadius: 10, border: `1px solid ${border}`,
        background: disabled ? '#f1f5f9' : bg,
        color: disabled ? '#94a3b8' : color,
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all .15s', opacity: disabled ? .6 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '.8'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {children}
    </button>
  );

  const tabs: { key: typeof activeTab; label: string; count: number; color: string }[] = [
    { key: 'pending',  label: 'Pending',  count: pending.length,  color: '#f59e0b' },
    { key: 'approved', label: 'Approved', count: approved.length, color: '#10b981' },
    { key: 'rejected', label: 'Rejected', count: rejected.length, color: '#ef4444' },
  ];

  const listMap = { pending, approved, rejected };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: 780 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderRadius: 16,
          background: toast.ok ? '#052e16' : '#450a0a',
          border: `1px solid ${toast.ok ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.3)'}`,
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          animation: 'toastIn .35s ease both',
          maxWidth: 420, fontFamily: "'DM Sans',sans-serif",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28, animation: 'fadeUp .4s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#1e3a8a,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20 }}>👥</span>
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>Staff Approvals</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0', fontWeight: 500 }}>Review and manage teacher registration requests</p>
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {pending.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: '#fef3c7', border: '1px solid #fde68a' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>{pending.length} awaiting approval</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: '#dcfce7', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>{approved.length} active teachers</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, background: '#f8fafc', borderRadius: 14, padding: 4, marginBottom: 22, border: '1px solid #e2e8f0', animation: 'fadeUp .45s ease both .05s' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px', borderRadius: 11, border: 'none',
              background: activeTab === t.key ? '#fff' : 'transparent',
              boxShadow: activeTab === t.key ? '0 2px 8px rgba(0,0,0,.07)' : 'none',
              cursor: 'pointer', transition: 'all .2s',
              fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13,
              color: activeTab === t.key ? '#0f172a' : '#94a3b8',
            }}>
            <span style={{
              minWidth: 22, height: 22, borderRadius: 999, padding: '0 6px',
              background: activeTab === t.key ? t.color : '#e2e8f0',
              color: activeTab === t.key ? '#fff' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
            }}>
              {t.count}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ animation: 'fadeUp .4s ease both .1s' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }}/>
            <div style={{ fontSize: 14 }}>Loading…</div>
          </div>
        ) : listMap[activeTab].length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>
              {activeTab === 'pending' ? '🎉' : activeTab === 'approved' ? '👩‍🏫' : '📋'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {activeTab === 'pending'  && 'No pending requests'}
              {activeTab === 'approved' && 'No approved teachers yet'}
              {activeTab === 'rejected' && 'No rejected applications'}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {activeTab === 'pending'  && 'All registrations have been reviewed.'}
              {activeTab === 'approved' && 'Approved teachers will appear here.'}
              {activeTab === 'rejected' && 'You can re-approve rejected teachers if needed.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listMap[activeTab].map(t => (
              <TeacherCard key={t.id} t={t} actions={
                activeTab === 'pending' ? (
                  <>
                    <Btn onClick={() => approve(t)} disabled={acting === t.id} color="#fff" bg="linear-gradient(135deg,#059669,#10b981)" border="#059669">
                      {acting === t.id ? <Spin/> : '✅'} Approve
                    </Btn>
                    <Btn onClick={() => reject(t)} disabled={acting === t.id} color="#dc2626" bg="#fef2f2" border="#fecaca">
                      ✕ Reject
                    </Btn>
                  </>
                ) : activeTab === 'approved' ? (
                  <Btn onClick={() => revoke(t)} disabled={acting === t.id} color="#dc2626" bg="#fef2f2" border="#fecaca">
                    {acting === t.id ? <Spin/> : '🚫'} Revoke
                  </Btn>
                ) : (
                  <Btn onClick={() => reApprove(t)} disabled={acting === t.id} color="#fff" bg="linear-gradient(135deg,#059669,#10b981)" border="#059669">
                    {acting === t.id ? <Spin/> : '♻️'} Re-approve
                  </Btn>
                )
              }/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Spin() {
  return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }}/>;
}