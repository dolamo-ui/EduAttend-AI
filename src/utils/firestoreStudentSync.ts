// ─────────────────────────────────────────────────────────────────────────────
// firestoreStudentSync.ts
// ─────────────────────────────────────────────────────────────────────────────
// Drop this file into src/utils/firestoreStudentSync.ts
//
// PURPOSE:
//   Students.tsx currently saves students only to localStorage.
//   ParentRegister.tsx needs students in Firestore (with schoolId) so parents
//   can find their child during registration.
//
//   This module provides:
//     1. writeStudentToFirestore()   — call this when adding a single student
//     2. syncAllStudentsToFirestore() — call this once on app load to sync
//                                       existing localStorage students to Firestore
//
// USAGE in Students.tsx AddStudentDialog handleSubmit:
//
//   import { writeStudentToFirestore } from '../utils/firestoreStudentSync';
//
//   const handleSubmit = async (e) => {
//     ...existing localStorage save...
//     const student = db.create(form);
//     // Also write to Firestore so parents can find this student:
//     await writeStudentToFirestore(student, user.schoolId!, user.schoolCode!);
//     onSuccess(student);
//   };
//
// USAGE in Students.tsx useEffect (one-time sync):
//
//   import { syncAllStudentsToFirestore } from '../utils/firestoreStudentSync';
//
//   useEffect(() => {
//     if (user?.role === 'PRINCIPAL' && user.schoolId && user.schoolCode) {
//       syncAllStudentsToFirestore(user.schoolId, user.schoolCode);
//     }
//   }, [user]);
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, addDoc, getDocs, query,
  where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

interface Student {
  id:              string;
  name:            string;
  roll_no:         string;
  gender:          string;
  date_of_birth:   string;
  class_name:      string;
  parent_name?:    string;
  parent_contact?: string;
  parent_email?:   string;
}

// Write a single student to Firestore (called when principal adds a student)
export async function writeStudentToFirestore(
  student:    Student,
  schoolId:   string,
  schoolCode: string,
): Promise<void> {
  try {
    // Don't duplicate — check if this student already exists in Firestore
    const q    = query(
      collection(db, 'students'),
      where('roll_no',    '==', student.roll_no),
      where('class_name', '==', student.class_name),
      where('schoolId',   '==', schoolId),
    );
    const snap = await getDocs(q);
    if (!snap.empty) return; // Already exists

    await addDoc(collection(db, 'students'), {
      name:            student.name,
      roll_no:         student.roll_no,
      gender:          student.gender,
      date_of_birth:   student.date_of_birth,
      class_name:      student.class_name,
      parent_name:     student.parent_name    ?? '',
      parent_contact:  student.parent_contact ?? '',
      parent_email:    student.parent_email   ?? '',
      schoolId,
      schoolCode,
      localId:         student.id, // keep reference to localStorage id
      createdAt:       serverTimestamp(),
    });
  } catch (err) {
    console.warn('[firestoreSync] Failed to write student to Firestore:', err);
    // Don't throw — localStorage is the source of truth, Firestore is supplementary
  }
}

// Sync ALL localStorage students to Firestore (run once on principal login)
export async function syncAllStudentsToFirestore(
  schoolId:   string,
  schoolCode: string,
): Promise<void> {
  try {
    const raw = localStorage.getItem('students');
    if (!raw) return;
    const students: Student[] = JSON.parse(raw);
    if (!students.length) return;

    // Get existing Firestore students to avoid duplicates
    const q    = query(collection(db, 'students'), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    const existingKeys = new Set(
      snap.docs.map(d => {
        const data = d.data();
        return `${data.class_name}::${data.roll_no}`;
      }),
    );

    // Deduplicate localStorage students
    const seen = new Set<string>();
    const unique = students.filter(s => {
      const k = `${s.class_name}::${s.roll_no}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Write only the ones not yet in Firestore
    const toWrite = unique.filter(
      s => !existingKeys.has(`${s.class_name}::${s.roll_no}`),
    );

    if (toWrite.length === 0) return;
    console.log(`[firestoreSync] Syncing ${toWrite.length} students to Firestore…`);

    await Promise.all(
      toWrite.map(student =>
        addDoc(collection(db, 'students'), {
          name:           student.name,
          roll_no:        student.roll_no,
          gender:         student.gender,
          date_of_birth:  student.date_of_birth,
          class_name:     student.class_name,
          parent_name:    student.parent_name    ?? '',
          parent_contact: student.parent_contact ?? '',
          parent_email:   student.parent_email   ?? '',
          schoolId,
          schoolCode,
          localId:        student.id,
          createdAt:      serverTimestamp(),
        }).catch(err => console.warn('[firestoreSync] skip:', student.name, err)),
      ),
    );

    console.log(`[firestoreSync] ✓ Synced ${toWrite.length} students`);
  } catch (err) {
    console.warn('[firestoreSync] Sync failed:', err);
  }
}