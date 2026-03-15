
import { Student, ClassRoom, User } from "../types";

export const MOCK_TEACHERS: User[] = [
  { id: 't1', name: 'John Smith', email: 'john@school.com', role: 'TEACHER', avatar: 'https://picsum.photos/seed/t1/100' },
  { id: 't2', name: 'Sarah Wilson', email: 'sarah@school.com', role: 'TEACHER', avatar: 'https://picsum.photos/seed/t2/100' },
];

export const MOCK_CLASSES: ClassRoom[] = [
  { id: 'c1', name: '10-A', teacherId: 't1', studentsCount: 2 },
  { id: 'c2', name: '10-B', teacherId: 't2', studentsCount: 1 },
];

export const MOCK_STUDENTS: Student[] = [
  {
    id: 's1',
    firstName: 'Alice',
    lastName: 'Johnson',
    rollNumber: '101',
    classId: 'c1',
    section: 'A',
    parentEmail: 'parent1@email.com',
    parentPhone: '555-0101',
    photoUrl: 'https://picsum.photos/seed/s1/200',
    attendanceRecords: [
      { date: '2024-03-01', status: 'PRESENT' },
      { date: '2024-03-02', status: 'ABSENT' },
      { date: '2024-03-03', status: 'ABSENT' },
      { date: '2024-03-04', status: 'ABSENT' },
    ]
  },
  {
    id: 's2',
    firstName: 'Bob',
    lastName: 'Brown',
    rollNumber: '102',
    classId: 'c1',
    section: 'A',
    parentEmail: 'parent2@email.com',
    parentPhone: '555-0102',
    photoUrl: 'https://picsum.photos/seed/s2/200',
    attendanceRecords: [
      { date: '2024-03-01', status: 'PRESENT' },
      { date: '2024-03-02', status: 'PRESENT' },
      { date: '2024-03-03', status: 'PRESENT' },
    ]
  },
  {
    id: 's3',
    firstName: 'Charlie',
    lastName: 'Davis',
    rollNumber: '201',
    classId: 'c2',
    section: 'B',
    parentEmail: 'parent3@email.com',
    parentPhone: '555-0103',
    photoUrl: 'https://picsum.photos/seed/s3/200',
    attendanceRecords: [
      { date: '2024-03-01', status: 'ABSENT' },
      { date: '2024-03-02', status: 'ABSENT' },
      { date: '2024-03-03', status: 'PRESENT' },
    ]
  },
];
