import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Phone, Bell, Mail, MessageSquare,
  Zap, Save, Check, Settings as SettingsIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys (imported by Dashboard + Notification components too)
// ─────────────────────────────────────────────────────────────────────────────

export const SCHOOL_KEY = 'school_info';
export const NOTIF_KEY  = 'notif_prefs';

export interface SchoolInfo {
  name:    string;
  address: string;
  contact: string;
}

export interface NotifPrefs {
  emailOnAbsent: boolean;
  emailOnLate:   boolean;
  smsOnAbsent:   boolean;
  smsOnLate:     boolean;
  autoNotify:    boolean;
}

const DEFAULT_NOTIF: NotifPrefs = {
  emailOnAbsent: true,
  emailOnLate:   true,
  smsOnAbsent:   false,
  smsOnLate:     false,
  autoNotify:    true,
};

export function loadSchoolInfo(): SchoolInfo {
  try { return JSON.parse(localStorage.getItem(SCHOOL_KEY) ?? 'null') ?? { name: '', address: '', contact: '' }; }
  catch { return { name: '', address: '', contact: '' }; }
}

export function loadNotifPrefs(): NotifPrefs {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? 'null') ?? DEFAULT_NOTIF; }
  catch { return DEFAULT_NOTIF; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny save-state hook
// ─────────────────────────────────────────────────────────────────────────────

function useSave() {
  const [st, setSt] = useState<'idle' | 'saved'>('idle');
  const save = (fn: () => void) => {
    fn();
    setSt('saved');
    setTimeout(() => setSt('idle'), 2200);
  };
  return { saved: st === 'saved', save };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  id, label, icon, value, onChange, placeholder, type = 'text',
}: {
  id: string; label: string; icon: React.ReactNode;
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 7, fontFamily: 'inherit',
        }}
      >
        <span style={{ color: '#1e40af' }}>{icon}</span>
        {label}
      </label>
      <input
        id={id} type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 12,
          fontSize: 14, fontFamily: 'inherit', color: '#0f172a',
          background: focus ? '#fff' : '#f8fafc',
          border: `2px solid ${focus ? '#1e40af' : '#e2e8f0'}`,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.18s, background 0.18s',
          boxShadow: focus ? '0 0 0 4px rgba(30,64,175,0.08)' : 'none',
        }}
      />
    </div>
  );
}

function Toggle({
  id, checked, onChange,
}: {
  id: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id} type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex',
        width: 46, height: 26, borderRadius: 999, border: 'none',
        cursor: 'pointer', flexShrink: 0,
        background: checked ? '#1e40af' : '#e2e8f0',
        transition: 'background 0.22s',
        boxShadow: checked ? '0 0 0 3px rgba(30,64,175,0.15)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </button>
  );
}

function SaveBtn({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 22px', borderRadius: 12, border: 'none',
        fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
        cursor: 'pointer',
        background: saved
          ? 'linear-gradient(135deg,#059669,#10b981)'
          : 'linear-gradient(135deg,#1e3a8a,#1e40af)',
        color: '#fff',
        boxShadow: saved
          ? '0 4px 14px rgba(16,185,129,0.3)'
          : '0 4px 14px rgba(30,64,175,0.25)',
        transition: 'all 0.22s',
      }}
    >
      {saved ? <Check size={15} /> : <Save size={15} />}
      {saved ? 'Saved!' : 'Save Changes'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings component
// ─────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [school, setSchool] = useState<SchoolInfo>({ name: '', address: '', contact: '' });
  const [notif,  setNotif]  = useState<NotifPrefs>(DEFAULT_NOTIF);

  const schoolSave = useSave();
  const notifSave  = useSave();

  // Load persisted data on mount
  useEffect(() => {
    setSchool(loadSchoolInfo());
    setNotif(loadNotifPrefs());
  }, []);

  const handleSaveSchool = () =>
    schoolSave.save(() => {
      localStorage.setItem(SCHOOL_KEY, JSON.stringify(school));
      window.dispatchEvent(new CustomEvent('schoolInfoUpdated', { detail: school }));
    });

  const handleSaveNotif = () =>
    notifSave.save(() => {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(notif));
    });

  const sf = (k: keyof SchoolInfo) => (v: string) =>
    setSchool(p => ({ ...p, [k]: v }));

  const NOTIF_ROWS: {
    id: keyof NotifPrefs; label: string; desc: string; icon: React.ReactNode;
  }[] = [
    { id: 'emailOnAbsent', label: 'Email on Absent', desc: 'Email parents when a student is marked absent',  icon: <Mail size={15} /> },
    { id: 'emailOnLate',   label: 'Email on Late',   desc: 'Email parents when a student arrives late',      icon: <Mail size={15} /> },
    { id: 'smsOnAbsent',   label: 'SMS on Absent',   desc: 'Send an SMS when a student is marked absent',    icon: <MessageSquare size={15} /> },
    { id: 'smsOnLate',     label: 'SMS on Late',     desc: 'Send an SMS when a student arrives late',        icon: <MessageSquare size={15} /> },
    { id: 'autoNotify',    label: 'Auto-Notify',     desc: 'Automatically send notifications on attendance mark', icon: <Zap size={15} /> },
  ];

  const activeCount = Object.values(notif).filter(Boolean).length;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 28, animation: 'fadeUp .38s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'linear-gradient(135deg,#1e3a8a,#1e40af)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(30,64,175,0.28)',
          }}>
            <SettingsIcon size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
              Settings
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              Manage school details and notification preferences
            </p>
          </div>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: 22,
      }}>

        {/* ── School Information ── */}
        <div style={{ animation: 'fadeUp .42s ease both .04s' }}>
          <div style={{
            background: '#fff', borderRadius: 20,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: '#dbeafe', color: '#1e40af',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Building2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>School Information</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  Appears on reports, dashboards and exports
                </div>
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field
                id="school-name"
                label="School Name"
                icon={<Building2 size={12} />}
                value={school.name}
                onChange={sf('name')}
                placeholder="e.g. Greenwood Primary School"
              />
              <Field
                id="school-address"
                label="Address"
                icon={<MapPin size={12} />}
                value={school.address}
                onChange={sf('address')}
                placeholder="123 Main Street, Pretoria, 0001"
              />
              <Field
                id="school-contact"
                label="Contact Number"
                icon={<Phone size={12} />}
                value={school.contact}
                onChange={sf('contact')}
                placeholder="+27 12 345 6789"
                type="tel"
              />

              {/* Live preview pill */}
              {school.name && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 14,
                  background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                  border: '1.5px solid #bfdbfe',
                }}>
                  <Building2 size={16} color="#1e40af" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1e40af' }}>{school.name}</div>
                    {school.address && (
                      <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 1 }}>{school.address}</div>
                    )}
                    {school.contact && (
                      <div style={{ fontSize: 11, color: '#3b82f6' }}>{school.contact}</div>
                    )}
                  </div>
                </div>
              )}

              <SaveBtn saved={schoolSave.saved} onClick={handleSaveSchool} />
            </div>
          </div>
        </div>

        {/* ── Notification Settings ── */}
        <div style={{ animation: 'fadeUp .46s ease both .08s' }}>
          <div style={{
            background: '#fff', borderRadius: 20,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg,#f8fafc,#f0fdf4)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: '#d1fae5', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bell size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Notification Settings</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  Control when and how parents are notified
                </div>
              </div>
              {/* Active count badge */}
              <div style={{
                padding: '4px 12px', borderRadius: 999,
                background: activeCount > 0 ? '#d1fae5' : '#f1f5f9',
                color: activeCount > 0 ? '#065f46' : '#94a3b8',
                fontSize: 11, fontWeight: 800,
              }}>
                {activeCount} on
              </div>
            </div>

            {/* Toggle rows */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NOTIF_ROWS.map((row, i) => (
                <React.Fragment key={row.id}>
                  {/* Divider before Auto-Notify */}
                  {i === 4 && (
                    <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 16px', borderRadius: 14,
                    background: notif[row.id] ? '#f0fdf4' : '#f8fafc',
                    border: `1.5px solid ${notif[row.id] ? '#bbf7d0' : '#e2e8f0'}`,
                    transition: 'all 0.18s',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: notif[row.id] ? '#d1fae5' : '#e2e8f0',
                        color: notif[row.id] ? '#059669' : '#94a3b8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.18s',
                      }}>
                        {row.icon}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label
                          htmlFor={`notif-${row.id}`}
                          style={{
                            display: 'block', fontSize: 13, fontWeight: 700,
                            color: '#0f172a', cursor: 'pointer',
                          }}
                        >
                          {row.label}
                        </label>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                          {row.desc}
                        </div>
                      </div>
                    </div>
                    <Toggle
                      id={`notif-${row.id}`}
                      checked={notif[row.id]}
                      onChange={v => setNotif(p => ({ ...p, [row.id]: v }))}
                    />
                  </div>
                </React.Fragment>
              ))}

              <div style={{ paddingTop: 6 }}>
                <SaveBtn saved={notifSave.saved} onClick={handleSaveNotif} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}