// components/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { RouteKey, canAccess } from '../src/types/auth';
import { ShieldOff } from 'lucide-react';

interface ProtectedRouteProps {
  routeKey: RouteKey;
  children: React.ReactNode;
}

// ─── Loading splash with real logo ───────────────────────────────────────────
function LoadingSplash(): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f1729',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      gap: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Plus+Jakarta+Sans:wght@400;600&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:.4;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* Logo */}
      <div style={{ animation: 'fadeIn .5s ease both' }}>
        <div style={{
          padding: '14px', borderRadius: 20, background: '#1a2744',
          boxShadow: '0 12px 40px rgba(34,197,94,0.18)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img
            src="/logo.png"
            alt="Attendance AI"
            style={{
              width: 56, height: 56, objectFit: 'contain',
              filter: 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(34,197,94,.5))',
            }}
          />
        </div>
      </div>

      {/* Spinner */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        border: '3px solid rgba(34,197,94,0.2)',
        borderTopColor: '#22c55e',
        animation: 'spin .7s linear infinite',
      }}/>

      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,0.35)',
        fontWeight: 500, animation: 'pulse 2s ease-in-out infinite',
        letterSpacing: '0.02em',
      }}>
        Loading…
      </p>
    </div>
  );
}

// ─── Access Denied screen ────────────────────────────────────────────────────
function AccessDenied({ role }: { role: string }): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', padding: '40px 24px', textAlign: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      gap: 0,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');`}</style>

      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: '#fee2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, border: '1.5px solid #fecaca',
      }}>
        <ShieldOff size={32} color="#dc2626" strokeWidth={1.8}/>
      </div>

      <h2 style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: 22, fontWeight: 800, color: '#0f172a',
        margin: '0 0 10px', letterSpacing: '-0.02em',
      }}>
        Access Restricted
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', maxWidth: 340, margin: '0 0 24px', lineHeight: 1.65 }}>
        Your role (<strong style={{ color: '#374151' }}>{role}</strong>) does not have permission to view this page.
        Contact your school principal if you need access.
      </p>

      {/* Logo watermark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.35 }}>
        <img src="/logo.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', filter: 'grayscale(1)' }}/>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Attendance AI</span>
      </div>
    </div>
  );
}

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
export default function ProtectedRoute({ routeKey, children }: ProtectedRouteProps): React.ReactElement {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingSplash />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'PARENT' && routeKey !== 'parent-portal') {
    return <Navigate to="/parent-portal" replace />;
  }

  if (user.role !== 'PARENT' && routeKey === 'parent-portal') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!canAccess(user.role, routeKey)) {
    return <AccessDenied role={user.role} />;
  }

  return <>{children}</>;
}