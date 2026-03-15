// src/types/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Extended AuthUser with Firebase / school fields
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'PRINCIPAL' | 'TEACHER' | 'PARENT';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface AuthUser {
  id:             string;
  name:           string;
  email:          string;
  role:           UserRole;

  // ── School ──────────────────────────────────────────────────────────────
  schoolId?:      string;   // Firestore schools/{id}
  schoolCode?:    string;   // e.g. "GREENWOOD2024"

  // ── Status (teachers only) ───────────────────────────────────────────────
  status?:        UserStatus;  // 'pending' until principal approves

  // ── Teacher ─────────────────────────────────────────────────────────────
  assignedClass?: string;
  avatar?:        string;

  // ── Parent ──────────────────────────────────────────────────────────────
  childId?:       string;
  childName?:     string;
  childClass?:    string;
  childRoll?:     string;
}

export interface AuthState {
  user:            AuthUser | null;
  isAuthenticated: boolean;
}

// ─── Route permission map ─────────────────────────────────────────────────────

export type RouteKey =
  | 'dashboard'
  | 'attendance'
  | 'attendance-history'
  | 'students'
  | 'classes'
  | 'teachers'
  | 'parents'
  | 'settings'
  | 'aiphotolab'
  | 'profile'
  | 'student-progress'
  | 'lesson-planning'
  | 'parent-portal'
  | 'approvals'
  | 'invite-teacher';     // ← NEW: principal adds teacher directly

export const ROUTE_PERMISSIONS: Record<RouteKey, UserRole[]> = {
  dashboard:            ['PRINCIPAL', 'TEACHER'],
  attendance:           ['PRINCIPAL', 'TEACHER'],
  'attendance-history': ['PRINCIPAL', 'TEACHER', 'PARENT'],
  students:             ['PRINCIPAL', 'TEACHER'],
  classes:              ['PRINCIPAL'],
  teachers:             ['PRINCIPAL'],
  parents:              ['PRINCIPAL', 'TEACHER'],
  settings:             ['PRINCIPAL'],
  aiphotolab:           ['PRINCIPAL', 'TEACHER'],
  profile:              ['PRINCIPAL', 'TEACHER'],
  'student-progress':   ['PRINCIPAL', 'TEACHER'],
  'lesson-planning':    ['TEACHER'],
  'parent-portal':      ['PARENT'],
  approvals:            ['PRINCIPAL'],
  'invite-teacher':     ['PRINCIPAL'],
};

export function canAccess(role: UserRole, route: RouteKey): boolean {
  return ROUTE_PERMISSIONS[route]?.includes(role) ?? false;
}