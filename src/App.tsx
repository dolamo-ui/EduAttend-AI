// src/App.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Updated: added /parent-register public route
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage         from '../pages/LoginPage';
import Landing           from '../pages/Landing';
import SchoolSetup       from '../pages/SchoolSetup';
import Register          from '../pages/Register';
import ParentRegister    from '../pages/Parentregister';   // ← NEW
import Approvals         from '../pages/Approvals';
import InviteTeacher     from '../pages/InviteTeacher';
import ProtectedRoute    from '../components/ProtectedRoute';
import Layout            from '../components/Layout';

import Dashboard         from '../pages/Dashboard';
import Attendance        from '../pages/Attendance';
import AttendanceHistory from '../pages/AttendanceHistory';
import Students          from '../pages/Students';
import Classes           from '../pages/Classes';
import Teachers          from '../pages/Teachers';
import Parents           from '../pages/Parents';
import Settings          from '../pages/Settings';
import Aiphotolab        from '../pages/Aiphotolab';
import Profile           from '../pages/Profile';
import LessonPlanning    from '../pages/LessonPlanning';
import ParentPortal      from '../pages/ParentPortal';

import { RouteKey } from './types/auth';

// ─── Protected route config ───────────────────────────────────────────────────
const PROTECTED_ROUTES = [
  { path: '/dashboard',          pageName: 'Dashboard',          routeKey: 'dashboard',          element: <Dashboard />         },
  { path: '/attendance',         pageName: 'Attendance',         routeKey: 'attendance',         element: <Attendance />        },
  { path: '/attendance-history', pageName: 'Attendance History', routeKey: 'attendance-history', element: <AttendanceHistory /> },
  { path: '/students',           pageName: 'Students',           routeKey: 'students',           element: <Students />          },
  { path: '/classes',            pageName: 'Classes',            routeKey: 'classes',            element: <Classes />           },
  { path: '/teachers',           pageName: 'Teachers',           routeKey: 'teachers',           element: <Teachers />          },
  { path: '/parents',            pageName: 'Parents',            routeKey: 'parents',            element: <Parents />           },
  { path: '/settings',           pageName: 'Settings',           routeKey: 'settings',           element: <Settings />          },
  { path: '/aiphotolab',         pageName: 'AI Photo Lab',       routeKey: 'aiphotolab',         element: <Aiphotolab />        },
  { path: '/lesson-planning',    pageName: 'Lesson Planning',    routeKey: 'lesson-planning',    element: <LessonPlanning />    },
  { path: '/profile',            pageName: 'My Profile',         routeKey: 'profile',            element: <Profile />           },
  { path: '/parent-portal',      pageName: 'Parent Portal',      routeKey: 'parent-portal',      element: <ParentPortal />      },
  { path: '/approvals',          pageName: 'Staff Approvals',    routeKey: 'approvals',          element: <Approvals />         },
  { path: '/invite-teacher',     pageName: 'Add Teacher',        routeKey: 'invite-teacher',     element: <InviteTeacher />     },
];

// ─── Loading splash while Firebase resolves auth state ───────────────────────
function LoadingSplash(): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0f4ff,#faf5ff)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(99,102,241,.35)' }}>
        <span style={{ fontSize: 22 }}>🏫</span>
      </div>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e0e7ff', borderTopColor: '#6366f1', animation: 'spin .7s linear infinite' }}/>
    </div>
  );
}

// ─── Root redirect ────────────────────────────────────────────────────────────
function RootRedirect(): React.ReactElement {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingSplash />;
  if (!isAuthenticated) return <Landing />;
  if (user?.role === 'PARENT') return <Navigate to="/parent-portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ─── Login route guard ────────────────────────────────────────────────────────
function LoginRoute(): React.ReactElement {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingSplash />;
  if (isAuthenticated) {
    if (user?.role === 'PARENT') return <Navigate to="/parent-portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginPage />;
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
function PageWrapper({ pageName, routeKey, children }: {
  pageName:  string;
  routeKey:  RouteKey | string;
  children:  React.ReactNode;
}): React.ReactElement {
  return (
    <ProtectedRoute routeKey={routeKey as RouteKey}>
      <Layout currentPageName={pageName}>{children}</Layout>
    </ProtectedRoute>
  );
}

// ─── 404 ──────────────────────────────────────────────────────────────────────
function NotFound(): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>😕</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>Page Not Found</h2>
      <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>The page you're looking for doesn't exist.</p>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>

        {/* ── Public routes ── */}
        <Route path="/"                element={<RootRedirect />}    />
        <Route path="/login"           element={<LoginRoute />}      />
        <Route path="/setup"           element={<SchoolSetup />}     />
        <Route path="/register"        element={<Register />}        />
        <Route path="/parent-register" element={<ParentRegister />}  />  {/* ← NEW */}

        {/* ── Protected routes ── */}
        {PROTECTED_ROUTES.map(({ path, pageName, routeKey, element }) => (
          <Route
            key={path}
            path={path}
            element={
              <PageWrapper pageName={pageName} routeKey={routeKey}>
                {element}
              </PageWrapper>
            }
          />
        ))}

        {/* ── 404 ── */}
        <Route path="*" element={
          <ProtectedRoute routeKey="dashboard">
            <Layout currentPageName=""><NotFound /></Layout>
          </ProtectedRoute>
        }/>

      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;