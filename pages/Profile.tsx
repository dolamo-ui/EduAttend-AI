import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Save } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface CurrentUser {
  full_name?: string;
  email?: string;
  contact?: string;
  role?: string;
  created_date?: string;
}

interface FormData {
  full_name: string;
  email: string;
  contact: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI Components
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const show = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const ToastEl = toast ? (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'}`}>
      {toast.type === 'success' ? (
        <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {toast.message}
    </div>
  ) : null;

  return { show, ToastEl };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 border-b border-gray-100 ${className}`}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-900">{children}</h3>;
}

function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500 mt-0.5">{children}</p>;
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-10 h-10 text-sm', md: 'w-16 h-16 text-lg', lg: 'w-24 h-24 text-2xl' };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold select-none shrink-0`}>
      {initials}
    </div>
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

// ─── Input ────────────────────────────────────────────────────────────────────

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
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

// ─── Icon Input Wrapper ───────────────────────────────────────────────────────

function IconInput({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <Input className="pl-10" {...props} />
    </div>
  );
}

// ─── Info Tile ────────────────────────────────────────────────────────────────

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function Profile() {
  const [user,       setUser]       = useState<CurrentUser | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isEditing,  setIsEditing]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [formData,   setFormData]   = useState<FormData>({ full_name: '', email: '', contact: '' });

  const { show: showToast, ToastEl } = useToast();

  // ── Fetch user ────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    // TODO: replace with real auth/user fetching
    // base44.auth.me()
    //   .then((data: CurrentUser) => {
    //     setUser(data);
    //     setFormData({ full_name: data.full_name ?? '', email: data.email ?? '', contact: data.contact ?? '' });
    //   })
    //   .catch(console.error)
    //   .finally(() => setIsLoading(false));
    setIsLoading(false);
  }, []);

  // ── Save profile ──────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // TODO: replace with real profile update
      // const updated = await base44.auth.updateMe(formData);
      // setUser(updated);
      setUser((prev) => prev ? { ...prev, ...formData } : formData);
      showToast('Profile updated successfully', 'success');
      setIsEditing(false);
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    setFormData({
      full_name: user?.full_name ?? '',
      email:     user?.email     ?? '',
      contact:   user?.contact   ?? '',
    });
  };

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  // ── Derived ───────────────────────────────────────────────────────────────

  const initials: string =
    user?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() ?? 'U';

  const memberSince = user?.created_date
    ? new Date(user.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {ToastEl}

      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Page heading ── */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-500 mt-1">Manage your account settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Avatar card ── */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Avatar initials={initials} size="lg" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{user?.full_name}</h3>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                  <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {user?.role ?? 'User'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Edit card ── */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your account details</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full name */}
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <IconInput
                    icon={User}
                    id="full_name"
                    value={formData.full_name}
                    onChange={set('full_name')}
                    disabled={!isEditing}
                    placeholder="Your full name"
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <IconInput
                    icon={Mail}
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>

                {/* Contact */}
                <div>
                  <Label htmlFor="contact">Contact Number</Label>
                  <IconInput
                    icon={Phone}
                    id="contact"
                    value={formData.contact}
                    onChange={set('contact')}
                    disabled={!isEditing}
                    placeholder="Enter contact number"
                  />
                </div>

                {/* Actions */}
                {isEditing && (
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? 'Saving…' : 'Save Changes'}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                      Cancel
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Account info ── */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoTile label="Account Role"  value={user?.role ?? 'User'} />
              <InfoTile label="Member Since"  value={memberSince}           />
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
}