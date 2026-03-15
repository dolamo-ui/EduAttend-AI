import React, { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Student {
  id: string;
  name: string;
  roll_no: string;
  gender: string;
  date_of_birth: string;
  parent_contact: string;
  parent_email: string;
  class_name: string;
}

interface ClassData {
  class_name?: string;
}

interface ViewStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: ClassData | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Local "DB" helper
// Reads students from localStorage under "students".
// Swap db.getStudents() for your real API call when ready.
// ═══════════════════════════════════════════════════════════════════════════════

const db = {
  getStudents(): Student[] {
    try { return JSON.parse(localStorage.getItem('students') ?? '[]'); } catch { return []; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI Components
// ═══════════════════════════════════════════════════════════════════════════════

function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-4xl max-h-[80vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">{children}</div>
    </div>
  );
}
function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="px-6 py-5 border-b border-gray-100 shrink-0">{children}</div>; }
function DialogTitle({ children }: { children: React.ReactNode }) { return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>; }
function DialogContent({ children }: { children: React.ReactNode }) { return <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>; }

function Badge({ children }: { children: React.ReactNode }) {
  const label = String(children);
  const colors: Record<string, string> = { Male: 'bg-blue-100 text-blue-700', Female: 'bg-pink-100 text-pink-700' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[label] ?? 'bg-gray-100 text-gray-700'}`}>{children}</span>;
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-200 overflow-hidden"><table className="w-full text-sm text-left">{children}</table></div>;
}
function TableHeader({ children }: { children: React.ReactNode }) { return <thead className="bg-gray-50">{children}</thead>; }
function TableBody({ children }: { children: React.ReactNode }) { return <tbody className="divide-y divide-gray-100">{children}</tbody>; }
function TableRow({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <tr className={`transition-colors hover:bg-gray-50 ${className}`}>{children}</tr>; }
function TableHead({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</th>; }
function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>; }

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function ViewStudentsDialog({ open, onOpenChange, classData }: ViewStudentsDialogProps) {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading,     setLoading]     = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open) { fetchedRef.current = false; return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    setLoading(true);
    // Read from localStorage (swap db.getStudents() for your real API when ready)
    setTimeout(() => {
      setAllStudents(db.getStudents());
      setLoading(false);
    }, 0);
  }, [open]);

  const classStudents = allStudents.filter((s) => s.class_name === classData?.class_name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Students in {classData?.class_name}</DialogTitle>
        <p className="text-sm text-gray-500 mt-1">
          {loading ? 'Loading...' : `${classStudents.length} student${classStudents.length !== 1 ? 's' : ''} enrolled`}
        </p>
      </DialogHeader>

      <DialogContent>
        {loading ? (
          <div className="space-y-3 py-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : classStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-sm">No students enrolled in this class yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Parent Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium text-gray-900">{student.name}</TableCell>
                  <TableCell>{student.roll_no}</TableCell>
                  <TableCell><Badge>{student.gender}</Badge></TableCell>
                  <TableCell>{student.date_of_birth}</TableCell>
                  <TableCell>
                    <div className="text-gray-700">{student.parent_contact}</div>
                    <div className="text-gray-400 text-xs">{student.parent_email}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}