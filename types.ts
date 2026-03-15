
export type Role = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  classId: string;
  section: string;
  parentEmail: string;
  parentPhone: string;
  photoUrl: string;
  attendanceRecords: AttendanceRecord[];
}

export interface AttendanceRecord {
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  reason?: string;
}

export interface AIStatus {
  studentId: string;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  consecutiveAbsences: number;
  attendancePercentage: number;
}

export interface ClassRoom {
  id: string;
  name: string;
  teacherId: string;
  studentsCount: number;
}
