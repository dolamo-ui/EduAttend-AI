// src/context/AuthContext.tsx
//
// FIX SUMMARY:
//
// Problem A (SchoolSetup — already fixed):
//   SchoolSetup called signOut() BEFORE writing Firestore docs.
//   onAuthStateChanged fired with null → permission-denied on setDoc.
//   Fix: skipRef flag tells the listener to ignore the next event.
//
// Problem B (ParentRegister — NEW FIX):
//   ParentRegister calls createUserWithEmailAndPassword, then setDoc.
//   onAuthStateChanged fires immediately after account creation and tries
//   to loadUserProfile — but setDoc hasn't written the doc yet → NO_PROFILE.
//   The auth listener then calls signOut(), nuking the session before the
//   parent's registration write completes.
//   Fix: expose skipNextAuthEvent() so ParentRegister can set skipRef=true
//   before calling createUserWithEmailAndPassword, exactly like setupSchool does.
//   After setDoc completes, ParentRegister calls markRegistrationComplete(user)
//   to set the user directly without going through the listener.

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from 'react';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';

import {
  doc, getDoc, setDoc, collection,
  query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

import { auth, db }            from '../firebase/firebaseConfig';
import { AuthUser, AuthState } from '../types/auth';

// ─────────────────────────────────────────────────────────────────────────────

export interface StudentMatch {
  id: string; name: string; class_name: string; roll_no: string;
}

interface AuthContextValue extends AuthState {
  loading: boolean;
  login: (email: string, password: string, childClass?: string) => Promise<{
    success: boolean; error?: string;
    studentsInClass?: StudentMatch[]; pendingUser?: AuthUser;
  }>;
  confirmChild:           (pendingUser: AuthUser, child: StudentMatch) => void;
  logout:                 () => Promise<void>;
  setupSchool:            (opts: SetupOpts) => Promise<{ success: boolean; error?: string; schoolCode?: string }>;
  // ── Used by ParentRegister (and TeacherRegister) ──────────────────────────
  // Call BEFORE createUserWithEmailAndPassword so the auth listener doesn't
  // try to load a profile before your setDoc write finishes.
  skipNextAuthEvent:      () => void;
  // Call AFTER your setDoc write completes to set the user directly.
  markRegistrationComplete: (user: AuthUser) => void;
}

export interface SetupOpts {
  schoolName: string; schoolAddress: string;
  schoolContact: string; schoolEmail: string;
  principalName: string; principalEmail: string; password: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSchoolCode(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
}

async function retry<T>(fn: () => Promise<T>, times = 4, ms = 700): Promise<T> {
  let last: unknown;
  for (let i = 0; i < times; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < times - 1) await new Promise(r => setTimeout(r, ms)); }
  }
  throw last;
}

async function loadUserProfile(fu: FirebaseUser): Promise<AuthUser> {
  const snap = await retry(() => getDoc(doc(db, 'users', fu.uid)));
  if (!snap.exists()) throw new Error(`NO_PROFILE:${fu.uid}`);
  const d = snap.data();
  return {
    id: fu.uid, name: d.name ?? fu.displayName ?? 'User',
    email: fu.email ?? '', role: d.role,
    schoolId: d.schoolId, schoolCode: d.schoolCode,
    status: d.status ?? 'active',
    assignedClass: d.assignedClass,
    childId: d.childId, childName: d.childName,
    childClass: d.childClass, childRoll: d.childRoll,
  } as AuthUser;
}

async function getStudentsInClass(className: string, schoolId: string): Promise<StudentMatch[]> {
  try {
    const q = query(
      collection(db, 'students'),
      where('class_name', '==', className.trim()),
      where('schoolId',   '==', schoolId),
    );
    const snap = await getDocs(q);
    const seen = new Set<string>();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(s => {
      const k = `${s.class_name}::${s.roll_no}`;
      if (seen.has(k)) return false; seen.add(k); return true;
    });
  } catch { return []; }
}

function humanError(err: unknown): string {
  const e    = err as any;
  const code = e?.code ?? '';
  const msg  = String(e?.message ?? err);
  console.error('[Auth]', code, msg);
  if (code === 'auth/email-already-in-use') return 'This email is already registered. Sign in instead.';
  if (code === 'auth/invalid-email')        return 'Invalid email address.';
  if (code === 'auth/weak-password')        return 'Password too weak — use at least 8 characters.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Invalid email or password.';
  if (code === 'auth/user-not-found')       return 'No account found with this email.';
  if (code === 'auth/too-many-requests')    return 'Too many attempts. Try again later.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection.';
  if (code === 'permission-denied' || msg.includes('permission'))
    return 'Firestore permission denied — make sure you published the latest firestore.rules in Firebase Console.';
  if (msg.startsWith('NO_PROFILE'))
    return 'Account profile missing in database. Please complete School Setup at /setup.';
  return `Error: ${msg}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // When skipRef.current is true, onAuthStateChanged ignores the next event.
  // Used by setupSchool AND ParentRegister (and any future self-registration flow)
  // to prevent the listener from trying to load a profile before setDoc finishes.
  const skipRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (skipRef.current) {
        // A registration flow told us to ignore this event.
        // The flow will call markRegistrationComplete() to set the user directly.
        skipRef.current = false;
        setLoading(false);
        return;
      }
      if (firebaseUser) {
        try {
          const profile = await loadUserProfile(firebaseUser);
          setUser(profile);
        } catch (err) {
          console.error('[Auth] restore failed:', err);
          await signOut(auth).catch(() => {});
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── skipNextAuthEvent ─────────────────────────────────────────────────────
  // Call this BEFORE createUserWithEmailAndPassword in any registration page.
  // It tells the onAuthStateChanged listener to skip the next event so it
  // doesn't try to load a Firestore profile that doesn't exist yet.
  const skipNextAuthEvent = useCallback(() => {
    skipRef.current = true;
    setLoading(true);
  }, []);

  // ── markRegistrationComplete ──────────────────────────────────────────────
  // Call this AFTER your setDoc write completes. Sets the user directly,
  // skipping the listener entirely.
  const markRegistrationComplete = useCallback((registeredUser: AuthUser) => {
    setUser(registeredUser);
    setLoading(false);
  }, []);

  // ── setupSchool ───────────────────────────────────────────────────────────
  const setupSchool = useCallback(async (opts: SetupOpts) => {
    try {
      skipRef.current = true;
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(
        auth, opts.principalEmail.trim(), opts.password,
      );
      const uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: opts.principalName.trim() });

      const code      = generateSchoolCode(opts.schoolName);
      const schoolRef = doc(collection(db, 'schools'));

      await setDoc(schoolRef, {
        name:        opts.schoolName.trim(),
        address:     opts.schoolAddress.trim(),
        contact:     opts.schoolContact.trim(),
        email:       opts.schoolEmail.trim(),
        schoolCode:  code,
        principalId: uid,
        createdAt:   serverTimestamp(),
      });

      await setDoc(doc(db, 'users', uid), {
        id:         uid,
        name:       opts.principalName.trim(),
        email:      opts.principalEmail.trim(),
        role:       'PRINCIPAL',
        status:     'active',
        schoolId:   schoolRef.id,
        schoolCode: code,
        createdAt:  serverTimestamp(),
      });

      localStorage.setItem('school_info', JSON.stringify({
        name: opts.schoolName.trim(), address: opts.schoolAddress.trim(), contact: opts.schoolContact.trim(),
      }));

      const profile = await loadUserProfile(cred.user);
      setUser(profile);
      setLoading(false);

      return { success: true, schoolCode: code };
    } catch (err) {
      skipRef.current = false;
      setLoading(false);
      if (auth.currentUser) await signOut(auth).catch(() => {});
      setUser(null);
      return { success: false, error: humanError(err) };
    }
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string, childClass?: string) => {
    try {
      const cred    = await signInWithEmailAndPassword(auth, email.trim(), password);
      let   profile: AuthUser;
      try   { profile = await loadUserProfile(cred.user); }
      catch (e) { await signOut(auth).catch(() => {}); return { success: false, error: humanError(e) }; }

      if (profile.role === 'TEACHER' && profile.status === 'pending') {
        await signOut(auth).catch(() => {});
        return { success: false, error: 'Your account is awaiting principal approval.' };
      }
      if (profile.role === 'TEACHER' && profile.status === 'rejected') {
        await signOut(auth).catch(() => {});
        return { success: false, error: 'Your registration was not approved. Contact your principal.' };
      }
      if (profile.role !== 'PARENT') {
        setUser(profile); return { success: true };
      }

      // ── Parent login: child is already locked in from registration ────────
      // If childId is stored, go straight to portal — no picker needed.
      if (profile.childId) {
        setUser(profile); return { success: true };
      }

      // Legacy: parent registered without childId — fall back to class picker
      if (!childClass?.trim()) {
        await signOut(auth).catch(() => {});
        return { success: false, error: "Please enter your child's class name." };
      }
      const students = await getStudentsInClass(childClass.trim(), profile.schoolId ?? '');
      if (!students.length) {
        await signOut(auth).catch(() => {});
        return { success: false, error: `No students found in class "${childClass.trim()}".` };
      }
      if (students.length === 1) {
        const c = students[0];
        setUser({ ...profile, childId: c.id, childName: c.name, childClass: c.class_name, childRoll: c.roll_no });
        return { success: true };
      }
      return { success: false, error: '', studentsInClass: students, pendingUser: profile };
    } catch (err) {
      return { success: false, error: humanError(err) };
    }
  }, []);

  const confirmChild = useCallback((p: AuthUser, c: StudentMatch) => {
    setUser({ ...p, childId: c.id, childName: c.name, childClass: c.class_name, childRoll: c.roll_no });
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth); setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, loading,
      login, confirmChild, logout, setupSchool,
      skipNextAuthEvent, markRegistrationComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}