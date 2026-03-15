import React, { useState, useRef, useEffect } from 'react';
import { Mail, Phone } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Parent {
  parent_name?: string;
  parent_email?: string;
  parent_contact?: string;
  student_name?: string;
  status?: string;
}

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: Parent | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Email placeholder
// No real sending without a backend. Logs to console.
// 👇 Replace with your real email API call when ready:
// e.g. await fetch('/api/send-email', { method: 'POST', body: JSON.stringify({ to, subject, body }) })
// ═══════════════════════════════════════════════════════════════════════════════

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.info('[Email placeholder] To:', to, '\nSubject:', subject, '\nBody:', body);
}

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
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">{children}</div>
    </div>
  );
}
function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="px-6 py-5 border-b border-gray-100 shrink-0">{children}</div>; }
function DialogTitle({ children }: { children: React.ReactNode }) { return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>; }
function DialogContent({ children }: { children: React.ReactNode }) { return <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">{children}</div>; }
function DialogFooter({ children }: { children: React.ReactNode }) { return <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">{children}</div>; }

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'solid' | 'outline'; }
function Button({ variant = 'solid', className = '', children, ...props }: ButtonProps) {
  const v = { solid: 'bg-indigo-600 text-white hover:bg-indigo-700', outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50' };
  return <button className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${className}`} {...props}>{children}</button>;
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm resize-none focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${className}`} {...props} />;
}

interface SelectOption { value: string; label: React.ReactNode; plainLabel: string; }
function Select({ value, onValueChange, options }: { value: string; onValueChange: (v: string) => void; options: SelectOption[]; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
        <span>{selected?.plainLabel ?? 'Select...'}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.map((opt) => (
            <li key={opt.value} onClick={() => { onValueChange(opt.value); setOpen(false); }}
              className={`flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer transition-colors ${opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900 hover:bg-gray-50'}`}>
              {opt.label}
              {opt.value === value && <svg className="w-4 h-4 text-indigo-600 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
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

export default function SendMessageDialog({ open, onOpenChange, parent }: SendMessageDialogProps) {
  const [method,    setMethod]    = useState<'email' | 'call'>('email');
  const [message,   setMessage]   = useState('');
  const [isSending, setIsSending] = useState(false);

  const defaultMessage = `Dear ${parent?.parent_name ?? 'Parent'},

We noticed that ${parent?.student_name} was marked as ${parent?.status?.toLowerCase() ?? 'absent'} today.

Could you please provide the reason for the absence/lateness so we can update our records?

Thank you for your cooperation.

Best regards,
School Administration`;

  const contactOptions: SelectOption[] = [
    {
      value: 'email',
      plainLabel: `Email — ${parent?.parent_email ?? 'No email'}`,
      label: <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-500 shrink-0" />Email — {parent?.parent_email ?? 'No email'}</span>,
    },
    {
      value: 'call',
      plainLabel: `Call — ${parent?.parent_contact ?? 'No contact'}`,
      label: <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-green-500 shrink-0" />Call — {parent?.parent_contact ?? 'No contact'}</span>,
    },
  ];

  const handleSend = async (): Promise<void> => {
    setIsSending(true);
    try {
      if (method === 'email' && parent?.parent_email) {
        // Placeholder — swap sendEmail() for your real API when ready
        await sendEmail(
          parent.parent_email,
          `Attendance Inquiry - ${parent.student_name}`,
          message || defaultMessage,
        );
        alert('Email logged to console (no backend connected yet).');
      } else if (method === 'call' && parent?.parent_contact) {
        window.open(`tel:${parent.parent_contact}`);
      }
      onOpenChange(false);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const isSendDisabled =
    isSending ||
    (method === 'email' && !parent?.parent_email) ||
    (method === 'call'  && !parent?.parent_contact);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Contact Parent</DialogTitle>
        <p className="text-sm text-gray-500 mt-0.5">{parent?.parent_name} — {parent?.student_name}</p>
      </DialogHeader>

      <DialogContent>
        <div>
          <Label>Contact Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as 'email' | 'call')} options={contactOptions} />
        </div>

        {method === 'email' && (
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={defaultMessage} rows={10} className="font-mono text-sm" />
          </div>
        )}

        {method === 'call' && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Phone className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              Click <span className="font-semibold">"Call Now"</span> to open your phone dialer and call <span className="font-semibold">{parent?.parent_contact}</span>.
            </p>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
        <Button onClick={handleSend} disabled={isSendDisabled}>
          {isSending ? 'Sending...' : method === 'email' ? 'Send Email' : 'Call Now'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}