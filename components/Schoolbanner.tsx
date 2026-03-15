import React, { useState, useEffect } from 'react';
import { MapPin, Phone } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SchoolBanner — reads school info from localStorage and displays it
// at the top of the dashboard in a warm, human way.
//
// Usage:  <SchoolBanner />   (drop anywhere above the dashboard content)
// ─────────────────────────────────────────────────────────────────────────────

const SCHOOL_KEY = 'school_info';

interface SchoolInfo {
  name:    string;
  address: string;
  contact: string;
}

function load(): SchoolInfo {
  try { return JSON.parse(localStorage.getItem(SCHOOL_KEY) ?? 'null') ?? { name: '', address: '', contact: '' }; }
  catch { return { name: '', address: '', contact: '' }; }
}

// ─── Day greeting ─────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dayLabel(): string {
  return new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SchoolBanner() {
  const [school, setSchool] = useState<SchoolInfo>(load);

  // Listen for live updates from Settings
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const ce = e as CustomEvent<SchoolInfo>;
      setSchool(ce.detail);
    };
    window.addEventListener('schoolInfoUpdated', onUpdate);
    return () => window.removeEventListener('schoolInfoUpdated', onUpdate);
  }, []);

  // If no school name has been set yet, render nothing
  if (!school.name.trim()) return null;

  const initial = school.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        marginBottom: 24,
        animation: 'schoolBannerIn .45s ease both',
      }}
    >
      <style>{`
        @keyframes schoolBannerIn {
          from { opacity:0; transform:translateY(-10px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '20px 26px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)',
          boxShadow: '0 8px 32px rgba(30,64,175,0.22), 0 1px 0 rgba(255,255,255,0.08) inset',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.06) 0%, transparent 60%)',
        }} />

        {/* Monogram badge */}
        <div style={{
          width: 54, height: 54, borderRadius: 16, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 900, color: '#fff',
          letterSpacing: '-0.02em',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          position: 'relative',
        }}>
          {initial}
        </div>

        {/* School info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Greeting */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3,
          }}>
            {greeting()} — {dayLabel()}
          </div>

          {/* School name */}
          <div style={{
            fontSize: 22, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.02em', lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {school.name}
          </div>

          {/* Address + contact */}
          {(school.address || school.contact) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              marginTop: 5, flexWrap: 'wrap',
            }}>
              {school.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={11} color="rgba(255,255,255,0.5)" />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {school.address}
                  </span>
                </div>
              )}
              {school.contact && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={11} color="rgba(255,255,255,0.5)" />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {school.contact}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side — attendance day indicator */}
        <div style={{
          textAlign: 'center', flexShrink: 0,
          padding: '10px 18px', borderRadius: 14,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <div style={{
            fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1,
          }}>
            {new Date().getDate()}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            {new Date().toLocaleDateString('en-ZA', { month: 'short' })}
            &nbsp;{new Date().getFullYear()}
          </div>
          <div style={{
            marginTop: 4, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.35)',
            fontSize: 9, fontWeight: 800, color: '#4ade80',
            letterSpacing: '0.08em',
          }}>
            SCHOOL DAY
          </div>
        </div>
      </div>
    </div>
  );
}