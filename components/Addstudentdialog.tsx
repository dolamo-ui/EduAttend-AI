import React, { useState, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ClassEntity {
  id: string;
  class_name: string;
}

interface FormData {
  name: string;
  roll_no: string;
  gender: string;
  date_of_birth: string;
  class_name: string;
  parent_name: string;
  parent_contact: string;
  parent_email: string;
}

interface Student extends FormData {
  id: string;
}

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (student: Student) => void;
  classes?: ClassEntity[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default state
// ═══════════════════════════════════════════════════════════════════════════════

const defaultFormData: FormData = {
  name: '',
  roll_no: '',
  gender: '',
  date_of_birth: '',
  class_name: '',
  parent_name: '',
  parent_contact: '',
  parent_email: '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Local "DB" helper
// Stores students in localStorage under the key "students".
// Replace this with your real API/Supabase/Firebase call when ready.
// ═══════════════════════════════════════════════════════════════════════════════

const db = {
  createStudent(data: FormData): Student {
    const students: Student[] = JSON.parse(localStorage.getItem('students') ?? '[]');
    const newStudent: Student = { ...data, id: crypto.randomUUID() };
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    return newStudent;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI Components
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Dialog ──────────────────────────────────────────────────────────────────

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5 border-b border-gray-100 shrink-0">{children}</div>;
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>;
}

function DialogBody({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>;
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
      {children}
    </div>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 ${className}`}
      {...props}
    />
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

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
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; }

function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  id,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
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
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-auto py-1">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">No options available</li>
          ) : (
            options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => { onValueChange(opt.value); setOpen(false); }}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                  opt.value === value
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                {opt.label}
                {opt.value === value && (
                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 mt-5 first:mt-0">
      {children}
    </p>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'MALE',   label: 'Male'   },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Other'  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function AddStudentDialog({
  open,
  onOpenChange,
  onSuccess,
  classes = [],
}: AddStudentDialogProps) {
  const [formData,     setFormData]     = useState<FormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const set = (key: keyof FormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const setFromInput = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => set(key)(e.target.value);

  const classOptions: SelectOption[] = classes.map((c) => ({
    value: c.class_name,
    label: c.class_name,
  }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // 👇 Swap this line for your real API call when ready:
      // e.g. const student = await api.students.create(formData);
      const student = db.createStudent(formData);

      setFormData(defaultFormData);
      onSuccess(student);
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding student:', err);
      setError('Failed to add student. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Add New Student</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <DialogBody>

          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Student info ── */}
          <SectionHeading>Student Information</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={setFromInput('name')}
                placeholder="Enter full name"
                required
              />
            </div>

            <div>
              <Label htmlFor="roll_no">Roll Number *</Label>
              <Input
                id="roll_no"
                value={formData.roll_no}
                onChange={setFromInput('roll_no')}
                placeholder="Enter roll number"
                required
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select
                id="gender"
                value={formData.gender}
                onValueChange={set('gender')}
                options={GENDER_OPTIONS}
                placeholder="Select gender"
              />
            </div>

            <div>
              <Label htmlFor="date_of_birth">Date of Birth *</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={setFromInput('date_of_birth')}
                required
              />
            </div>

            <div>
              <Label htmlFor="class_name">Class *</Label>
              <Select
                id="class_name"
                value={formData.class_name}
                onValueChange={set('class_name')}
                options={classOptions}
                placeholder="Select class"
              />
            </div>
          </div>

          {/* ── Parent info ── */}
          <SectionHeading>Parent / Guardian</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="parent_name">Full Name</Label>
              <Input
                id="parent_name"
                value={formData.parent_name}
                onChange={setFromInput('parent_name')}
                placeholder="Enter parent name"
              />
            </div>

            <div>
              <Label htmlFor="parent_contact">Contact Number</Label>
              <Input
                id="parent_contact"
                value={formData.parent_contact}
                onChange={setFromInput('parent_contact')}
                placeholder="+27 123 456 789"
              />
            </div>

            <div>
              <Label htmlFor="parent_email">Email Address</Label>
              <Input
                id="parent_email"
                type="email"
                value={formData.parent_email}
                onChange={setFromInput('parent_email')}
                placeholder="parent@email.com"
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Student'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}