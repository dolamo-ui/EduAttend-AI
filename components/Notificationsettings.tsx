import React, { useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Settings {
  emailOnAbsent: boolean;
  emailOnLate: boolean;
  smsOnAbsent: boolean;
  smsOnLate: boolean;
  autoNotify: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI Components
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5 border-b border-gray-100">{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-900">{children}</h3>;
}

function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500 mt-1">{children}</p>;
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({
  children,
  htmlFor,
  className = '',
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`text-sm text-gray-700 ${className}`}>
      {children}
    </label>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────

function Switch({
  id,
  checked,
  onCheckedChange,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

function Button({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const ToastEl = toast.visible ? (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg animate-fade-in">
      {/* Checkmark */}
      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {toast.message}
    </div>
  ) : null;

  return { showToast, ToastEl };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function NotificationSettings() {
  const [settings, setSettings] = useState<Settings>({
    emailOnAbsent: true,
    emailOnLate: true,
    smsOnAbsent: false,
    smsOnLate: false,
    autoNotify: true,
  });

  const { showToast, ToastEl } = useToast();

  const handleSettingChange = (key: keyof Settings, value: boolean): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (): void => {
    // In a real app, this would save to database
    showToast('Notification settings saved');
  };

  const rows: {
    id: keyof Settings;
    label: string;
    icon: React.ReactNode;
    divider?: boolean;
    bold?: boolean;
  }[] = [
    {
      id: 'emailOnAbsent',
      label: 'Email when student is marked absent',
      icon: <Mail className="w-4 h-4 text-blue-600" />,
    },
    {
      id: 'emailOnLate',
      label: 'Email when student is marked late',
      icon: <Mail className="w-4 h-4 text-yellow-600" />,
    },
    {
      id: 'smsOnAbsent',
      label: 'SMS when student is marked absent',
      icon: <MessageSquare className="w-4 h-4 text-blue-600" />,
    },
    {
      id: 'smsOnLate',
      label: 'SMS when student is marked late',
      icon: <MessageSquare className="w-4 h-4 text-yellow-600" />,
    },
    {
      id: 'autoNotify',
      label: 'Enable automatic notifications',
      icon: <Bell className="w-4 h-4 text-indigo-600" />,
      divider: true,
      bold: true,
    },
  ];

  return (
    <>
      {ToastEl}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <CardTitle>Notification Settings</CardTitle>
          </div>
          <CardDescription>
            Configure automatic parent notifications for attendance changes
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center justify-between ${
                  row.divider ? 'pt-4 border-t border-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {row.icon}
                  <Label
                    htmlFor={row.id}
                    className={`cursor-pointer ${row.bold ? 'font-semibold text-gray-900' : ''}`}
                  >
                    {row.label}
                  </Label>
                </div>
                <Switch
                  id={row.id}
                  checked={settings[row.id]}
                  onCheckedChange={(val) => handleSettingChange(row.id, val)}
                />
              </div>
            ))}
          </div>

          <Button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </>
  );
}