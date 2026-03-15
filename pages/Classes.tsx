import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus, Users, Trash2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ClassEntity {
  id: string;
  class_name: string;
  section: string;
  teacher_name?: string;
  current_enrollment?: number;
  max_enrollment?: number;
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// Storage helpers
// ═══════════════════════════════════════════════════════════════════════════════

const storage = {
  getClasses(): ClassEntity[] {
    try { return JSON.parse(localStorage.getItem('classes') ?? '[]'); } catch { return []; }
  },
  saveClasses(classes: ClassEntity[]): void {
    localStorage.setItem('classes', JSON.stringify(classes));
  },
  getStudents(): Student[] {
    try { return JSON.parse(localStorage.getItem('students') ?? '[]'); } catch { return []; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI Components
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 pt-5 ${className}`}>{children}</div>;
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'icon';
}

function Button({ variant = 'solid', size = 'default', className = '', children, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    solid:   'bg-indigo-600 text-white hover:bg-indigo-700',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    ghost:   'bg-transparent text-gray-700 hover:bg-gray-100',
    link:    'bg-transparent underline-offset-2 hover:underline p-0',
  };
  const sizes: Record<string, string> = {
    default: 'px-4 py-2 text-sm rounded-lg',
    icon:    'w-9 h-9 rounded-full',
  };
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${size !== 'default' || variant !== 'link' ? sizes[size] : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-blue-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">No classes yet</p>
      <p className="text-xs text-gray-400 mt-1">Click "Create Class" to get started.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Create Class Dialog (inline — no separate file needed)
// ═══════════════════════════════════════════════════════════════════════════════

interface FormData {
  class_name: string;
  teacher_name: string;
  section: string;
  max_enrollment: number;
}

const defaultFormData: FormData = {
  class_name: '',
  teacher_name: '',
  section: 'A',
  max_enrollment: 40,
};

const SECTION_OPTIONS = ['A', 'B', 'C', 'D'];

function CreateClassDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: (cls: ClassEntity) => void;
}) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setFormData(defaultFormData); setError(null); }
  }, [open]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const classes = storage.getClasses();
      const newClass: ClassEntity = {
        ...formData,
        id: crypto.randomUUID(),
        current_enrollment: 0,
      };
      classes.push(newClass);
      storage.saveClasses(classes);
      onSuccess(newClass);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError('Failed to create class. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Create New Class</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
            <input
              value={formData.class_name}
              onChange={(e) => setFormData((p) => ({ ...p, class_name: e.target.value }))}
              placeholder="e.g. Grade 5A or 10-A"
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
            <div className="flex gap-2 mt-1">
              {SECTION_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, section: s }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    formData.section === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher Name</label>
            <input
              value={formData.teacher_name}
              onChange={(e) => setFormData((p) => ({ ...p, teacher_name: e.target.value }))}
              placeholder="e.g. Ms. Johnson"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Enrollment *</label>
            <input
              type="number"
              value={formData.max_enrollment}
              min={1}
              max={100}
              required
              onChange={(e) => setFormData((p) => ({ ...p, max_enrollment: parseInt(e.target.value) || 40 }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// View Students Dialog (inline)
// ═══════════════════════════════════════════════════════════════════════════════

function ViewStudentsDialog({
  open,
  onOpenChange,
  classData,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classData: ClassEntity | null;
}) {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (open && classData) {
      const all = storage.getStudents();
      setStudents(all.filter((s) => s.class_name === classData.class_name));
    }
  }, [open, classData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-4xl max-h-[80vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Students in {classData?.class_name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} student{students.length !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">No students enrolled in this class yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add students from the Student Directory and assign them to this class.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Roll No', 'Gender', 'Date of Birth', 'Parent Contact'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center shrink-0">
                            <span className="text-indigo-600 font-bold text-xs">{s.name.charAt(0).toUpperCase()}</span>
                          </div>
                          {s.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.roll_no}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          s.gender === 'MALE' ? 'bg-blue-100 text-blue-700' :
                          s.gender === 'FEMALE' ? 'bg-pink-100 text-pink-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {s.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.date_of_birth || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{s.parent_contact || '—'}</div>
                        <div className="text-gray-400 text-xs">{s.parent_email || ''}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Classes Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function Classes() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog,   setShowViewDialog]   = useState(false);
  const [selectedClass,    setSelectedClass]    = useState<ClassEntity | null>(null);
  const [classes,          setClasses]          = useState<ClassEntity[]>([]);

  // ── Load from localStorage on mount ─────────────────────────────────────

  const loadClasses = (): void => {
    const raw = storage.getClasses();
    const students = storage.getStudents();

    // Sync enrollment counts from students data
    const synced = raw.map((cls) => ({
      ...cls,
      current_enrollment: students.filter((s) => s.class_name === cls.class_name).length,
    }));

    setClasses(synced);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  // ── Handle new class created ─────────────────────────────────────────────

  const handleClassCreated = (cls: ClassEntity): void => {
    setClasses((prev) => [...prev, cls]);
  };

  // ── Delete class ──────────────────────────────────────────────────────────

  const handleDelete = (id: string): void => {
    if (!window.confirm('Delete this class? This will not remove its students.')) return;
    const updated = classes.filter((c) => c.id !== id);
    setClasses(updated);
    storage.saveClasses(updated);
  };

  // ── View students ─────────────────────────────────────────────────────────

  const handleViewStudents = (cls: ClassEntity): void => {
    setSelectedClass(cls);
    setShowViewDialog(true);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Academic Classes</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">
            Overview of active sections and their enrollment
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Class
        </Button>
      </div>

      {/* ── Class Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {classes.length === 0 ? (
          <EmptyState />
        ) : (
          classes.map((cls) => {
            const enrolled = cls.current_enrollment ?? 0;
            const max      = cls.max_enrollment      ?? 40;
            const pct      = Math.round((enrolled / Math.max(max, 1)) * 100);

            return (
              <Card key={cls.id} className="border-blue-200 hover:border-blue-400 hover:shadow-lg hover:scale-[1.02]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <GraduationCap className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
                        {enrolled}/{max}
                      </span>
                      <button
                        onClick={() => handleDelete(cls.id)}
                        title="Delete class"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{cls.class_name}</h3>
                  {cls.section && (
                    <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Section {cls.section}
                    </span>
                  )}
                  <p className="text-sm text-gray-500 mt-2 mb-4">
                    Teacher: {cls.teacher_name || 'Not assigned'}
                  </p>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span className="uppercase tracking-wide font-semibold">Enrollment</span>
                      <span className="font-semibold text-gray-700">{pct}%</span>
                    </div>
                    <ProgressBar value={enrolled} max={max} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => handleViewStudents(cls)}
                      title="View students"
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="link"
                      className="text-blue-600 hover:text-blue-700 text-xs font-semibold tracking-wide"
                      onClick={() => handleViewStudents(cls)}
                    >
                      VIEW STUDENTS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Dialogs ── */}
      <CreateClassDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleClassCreated}
      />

      <ViewStudentsDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        classData={selectedClass}
      />
    </div>
  );
}