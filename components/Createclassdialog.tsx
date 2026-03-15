import React, { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  name: string;
}

interface FormData {
  class_name: string;
  teacher_id: string;
  teacher_name: string;
  section: string;
  max_enrollment: number;
}

interface ClassEntity extends FormData {
  id: string;
  current_enrollment: number;
}

interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (cls: ClassEntity) => void;
  teachers?: Teacher[];
}

// ─── Default form state ───────────────────────────────────────────────────────

const defaultFormData: FormData = {
  class_name: '',
  teacher_id: '',
  teacher_name: '',
  section: 'A',
  max_enrollment: 40,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Local "DB" helper
// Stores classes in localStorage under the key "classes".
// Swap db.createClass() for your real API call when ready.
// ═══════════════════════════════════════════════════════════════════════════════

const db = {
  createClass(data: FormData): ClassEntity {
    const classes: ClassEntity[] = JSON.parse(localStorage.getItem('classes') ?? '[]');
    const newClass: ClassEntity = { ...data, id: crypto.randomUUID(), current_enrollment: 0 };
    classes.push(newClass);
    localStorage.setItem('classes', JSON.stringify(classes));
    return newClass;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI Components
// ═══════════════════════════════════════════════════════════════════════════════

function Dialog({
  open, onOpenChange, children,
}: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md mx-4">{children}</div>
    </div>
  );
}

function DialogContent({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl shadow-2xl p-6">{children}</div>;
}

function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-5">{children}</div>;
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>;
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end mt-6 gap-2">{children}</div>;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline';
}

function Button({ variant = 'solid', className = '', children, ...props }: ButtonProps) {
  const variants = {
    solid:   'bg-indigo-600 text-white hover:bg-indigo-700',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
  };
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 ${className}`}
      {...props}
    />
  );
}

function Label({ children, className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-sm font-medium text-gray-700 ${className}`} {...props}>
      {children}
    </label>
  );
}

interface SelectOption { value: string; label: string; }

function Select({ value, onValueChange, options, placeholder = 'Select...', id }: {
  value: string; onValueChange: (v: string) => void;
  options: SelectOption[]; placeholder?: string; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative mt-1">
      <button
        id={id} type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto py-1">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">No options available</li>
          ) : options.map((opt) => (
            <li key={opt.value}
              onClick={() => { onValueChange(opt.value); setOpen(false); }}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              {opt.value === value && (
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const SECTION_OPTIONS: SelectOption[] = [
  { value: 'A', label: 'Section A' },
  { value: 'B', label: 'Section B' },
  { value: 'C', label: 'Section C' },
  { value: 'D', label: 'Section D' },
];

export default function CreateClassDialog({
  open, onOpenChange, onSuccess, teachers = [],
}: CreateClassDialogProps) {
  const [formData,     setFormData]     = useState<FormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const teacherOptions: SelectOption[] = teachers.map((t) => ({ value: t.id, label: t.name }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // 👇 Swap this for your real API call when ready:
      // e.g. const cls = await api.classes.create({ ...formData, current_enrollment: 0 });
      const cls = db.createClass(formData);
      setFormData(defaultFormData);
      onSuccess(cls);
      onOpenChange(false);
    } catch (err) {
      console.error('Error creating class:', err);
      setError('Failed to create class. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeacherChange = (teacherId: string): void => {
    const teacher = teachers.find((t) => t.id === teacherId);
    setFormData((prev) => ({ ...prev, teacher_id: teacherId, teacher_name: teacher?.name ?? '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Class</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="class_name">Class Name *</Label>
            <Input id="class_name" value={formData.class_name} placeholder="e.g., 10-A" required
              onChange={(e) => setFormData((prev) => ({ ...prev, class_name: e.target.value }))} />
          </div>

          <div>
            <Label htmlFor="section">Section *</Label>
            <Select id="section" value={formData.section} options={SECTION_OPTIONS} placeholder="Select section"
              onValueChange={(v) => setFormData((prev) => ({ ...prev, section: v }))} />
          </div>

          <div>
            <Label htmlFor="teacher">Assign Teacher</Label>
            <Select id="teacher" value={formData.teacher_id} options={teacherOptions} placeholder="Select teacher"
              onValueChange={handleTeacherChange} />
          </div>

          <div>
            <Label htmlFor="max_enrollment">Maximum Enrollment *</Label>
            <Input id="max_enrollment" type="number" value={formData.max_enrollment} min="1" max="100" required
              onChange={(e) => setFormData((prev) => ({ ...prev, max_enrollment: parseInt(e.target.value) || 40 }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}