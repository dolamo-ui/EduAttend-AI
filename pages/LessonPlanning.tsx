import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';
import {
  BookOpen, Sparkles, Download, Copy, Check, ChevronDown,
  Clock, Users, Target, Lightbulb, BookMarked, FlaskConical,
  ClipboardList, Plus, Trash2, Save, RefreshCw, Wand2,
  GraduationCap, Brain, Layers, PenLine,
} from 'lucide-react';
import { groqJSON } from '../src/Groqai';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface LessonSection {
  id: string;
  title: string;
  duration: number;
  content: string;
  icon: string;
}

interface LessonPlan {
  title: string;
  subject: string;
  className: string;
  topic: string;
  duration: number;
  objectives: string[];
  materials: string[];
  sections: LessonSection[];
  assessmentIdeas: string[];
  differentiationTips: string[];
  homeworkSuggestion: string;
  teacherNotes: string;
}

interface SavedPlan {
  id: string;
  title: string;
  subject: string;
  topic: string;
  className: string;
  createdAt: string;
  plan: LessonPlan;
}

interface Student {
  id: string;
  class_name: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Storage helpers
// ═══════════════════════════════════════════════════════════════════════════════

const storage = {
  getStudents(): Student[] {
    try { return JSON.parse(localStorage.getItem('students') ?? '[]'); } catch { return []; }
  },
  getSavedPlans(): SavedPlan[] {
    try { return JSON.parse(localStorage.getItem('lesson_plans') ?? '[]'); } catch { return []; }
  },
  savePlan(plan: SavedPlan): void {
    const plans = storage.getSavedPlans();
    const idx   = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.unshift(plan);
    localStorage.setItem('lesson_plans', JSON.stringify(plans.slice(0, 20)));
  },
  deletePlan(id: string): void {
    const plans = storage.getSavedPlans().filter((p) => p.id !== id);
    localStorage.setItem('lesson_plans', JSON.stringify(plans));
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const SUBJECTS = [
  'Mathematics', 'English Language Arts', 'Science', 'Social Studies',
  'History', 'Geography', 'Biology', 'Chemistry', 'Physics',
  'Life Sciences', 'Technology', 'Computer Science', 'Art', 'Music',
  'Physical Education', 'Economics', 'Accounting', 'Business Studies',
  'isiZulu', 'Afrikaans', 'Religious Studies',
];

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

// ═══════════════════════════════════════════════════════════════════════════════
// Groq AI — generateLessonPlan (replaces Anthropic API)
// ═══════════════════════════════════════════════════════════════════════════════

async function generateLessonPlan(params: {
  subject:         string;
  topic:           string;
  className:       string;
  duration:        number;
  gradeLevel:      string;
  additionalNotes: string;
}): Promise<LessonPlan> {
  const systemPrompt = `You are an expert curriculum designer and teacher.
You MUST respond with ONLY valid JSON — no markdown, no backticks, no preamble.
The JSON must exactly match the schema the user provides.
Do not add any text before or after the JSON object.`;

  const userPrompt = `Generate a detailed, practical lesson plan as a JSON object.

Subject: ${params.subject}
Topic: ${params.topic}
Class: ${params.className}
Duration: ${params.duration} minutes
Grade Level: ${params.gradeLevel || 'Not specified'}
Additional Notes: ${params.additionalNotes || 'None'}

Return ONLY this JSON structure (no markdown, no backticks):
{
  "title": "Lesson title",
  "subject": "${params.subject}",
  "className": "${params.className}",
  "topic": "${params.topic}",
  "duration": ${params.duration},
  "objectives": ["3-5 clear learning objectives starting with action verbs"],
  "materials": ["list of required materials/resources"],
  "sections": [
    {
      "id": "intro",
      "title": "Introduction / Hook",
      "duration": 5,
      "content": "Detailed description of activities, teacher actions, and student engagement strategies",
      "icon": "🎯"
    },
    {
      "id": "warm_up",
      "title": "Prior Knowledge Activation",
      "duration": 5,
      "content": "Activity to activate prior knowledge",
      "icon": "🔥"
    },
    {
      "id": "main_instruction",
      "title": "Direct Instruction / Main Content",
      "duration": 15,
      "content": "Core teaching content with key points, examples, and explanations",
      "icon": "📚"
    },
    {
      "id": "guided_practice",
      "title": "Guided Practice",
      "duration": 10,
      "content": "Structured activities teacher leads with students",
      "icon": "✏️"
    },
    {
      "id": "independent_activity",
      "title": "Independent / Group Activity",
      "duration": 10,
      "content": "Student-centered activity with clear instructions",
      "icon": "👥"
    },
    {
      "id": "wrap_up",
      "title": "Closure & Review",
      "duration": 5,
      "content": "How to summarize, check understanding, and close the lesson",
      "icon": "🏁"
    }
  ],
  "assessmentIdeas": ["3-4 formative/summative assessment suggestions specific to this topic"],
  "differentiationTips": ["tip for struggling learners", "tip for advanced learners", "tip for EAL/D learners"],
  "homeworkSuggestion": "One concrete, meaningful homework task",
  "teacherNotes": "2-3 practical tips, common misconceptions to address, or preparation reminders"
}

IMPORTANT: Section durations must add up to exactly ${params.duration} minutes.
Be specific, practical, and curriculum-aligned. Use real examples relevant to ${params.subject}.`;

  return groqJSON<LessonPlan>(systemPrompt, userPrompt, {
    maxTokens:   1400,
    temperature: 0.6,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI components
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, style = {}, className = '' }: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={className} style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = 'solid', size = 'md', style = {}, title }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'solid' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg'; style?: React.CSSProperties; title?: string;
}) {
  const variants = {
    solid:   { background: 'linear-gradient(135deg,#1e3a8a,#1e40af)', color: '#fff', border: 'none' },
    outline: { background: '#fff', color: '#374151', border: '1px solid #d1d5db' },
    ghost:   { background: 'transparent', color: '#6b7280', border: 'none' },
    danger:  { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' },
  };
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, borderRadius: 8 },
    md: { padding: '9px 16px', fontSize: 13, borderRadius: 10 },
    lg: { padding: '12px 24px', fontSize: 14, borderRadius: 12 },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
      fontFamily: "'DM Sans', sans-serif",
      ...variants[variant], ...sizes[size], ...style,
    }}>
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 12, fontWeight: 700,
      color: '#374151', marginBottom: 6,
      fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em',
    }}>
      {children}
    </label>
  );
}

function Inp({ value, onChange, placeholder, type = 'text', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} {...rest}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
        fontFamily: "'DM Sans', sans-serif", outline: 'none',
        boxSizing: 'border-box', background: '#fff',
      }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
        fontFamily: "'DM Sans', sans-serif", outline: 'none', resize: 'vertical',
        boxSizing: 'border-box', lineHeight: 1.6,
      }}
    />
  );
}

// ─── Searchable select ────────────────────────────────────────────────────────

function SearchSelect({ value, onSelect, options, placeholder }: {
  value: string; onSelect: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: '1px solid #d1d5db', fontSize: 13, textAlign: 'left',
        background: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: value ? '#111827' : '#9ca3af',
      }}>
        {value || placeholder || 'Select...'}
        <ChevronDown size={14} style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search..." style={{
                width: '100%', padding: '6px 10px', borderRadius: 8,
                border: '1px solid #e2e8f0', fontSize: 12, outline: 'none',
                fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map((o) => (
              <button key={o} type="button" onClick={() => { onSelect(o); setQ(''); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 14px',
                  fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  background: o === value ? '#eef2ff' : 'transparent',
                  color: o === value ? '#3730a3' : '#374151', border: 'none',
                  fontWeight: o === value ? 700 : 400,
                }}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading shimmer ──────────────────────────────────────────────────────────

function Shimmer({ height = 20, style = {} }: { height?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      height, borderRadius: 8,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle} title="Copy to clipboard" style={{
      padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
      background: copied ? '#dcfce7' : '#f8fafc', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, color: copied ? '#16a34a' : '#64748b',
      fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s',
    }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lesson Plan Display
// ═══════════════════════════════════════════════════════════════════════════════

function LessonPlanView({
  plan, onEdit, onSave, onExport, isSaving,
}: {
  plan: LessonPlan;
  onEdit: (updated: LessonPlan) => void;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
}) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const totalMins = plan.sections.reduce((s, sec) => s + sec.duration, 0);

  const updateSection = (id: string, field: keyof LessonSection, value: string | number) => {
    onEdit({ ...plan, sections: plan.sections.map((s) => s.id === id ? { ...s, [field]: value } : s) });
  };

  const fullText = [
    `LESSON PLAN: ${plan.title}`,
    `Subject: ${plan.subject} | Class: ${plan.className} | Duration: ${plan.duration} min`,
    '',
    'LEARNING OBJECTIVES',
    ...plan.objectives.map((o, i) => `${i + 1}. ${o}`),
    '',
    'MATERIALS NEEDED',
    ...plan.materials.map((m) => `• ${m}`),
    '',
    'LESSON OUTLINE',
    ...plan.sections.map((s) => `\n[${s.duration} min] ${s.title}\n${s.content}`),
    '',
    'ASSESSMENT IDEAS',
    ...plan.assessmentIdeas.map((a) => `• ${a}`),
    '',
    'DIFFERENTIATION',
    ...plan.differentiationTips.map((t) => `• ${t}`),
    '',
    `HOMEWORK: ${plan.homeworkSuggestion}`,
    '',
    `TEACHER NOTES: ${plan.teacherNotes}`,
  ].join('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Groq badge ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 10,
        background: 'linear-gradient(135deg,#f0f4ff,#eef2ff)',
        border: '1px solid #c7d2fe',
        alignSelf: 'flex-start',
      }}>
        <span style={{ fontSize: 15 }}>⚡</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', fontFamily: "'DM Sans',sans-serif" }}>
          Generated by Groq · llama-3.3-70b-versatile
        </span>
      </div>

      {/* Header bar */}
      <div style={{
        background: 'linear-gradient(135deg,#0f172a,#1e3a8a,#312e81)',
        borderRadius: 16, padding: '20px 24px', color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {plan.subject} · Class {plan.className}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif" }}>{plan.title}</h2>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '⏱', label: `${plan.duration} min`                 },
                { icon: '📚', label: `${plan.sections.length} sections`     },
                { icon: '🎯', label: `${plan.objectives.length} objectives` },
              ].map((chip) => (
                <div key={chip.label} style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: 11, fontWeight: 700, display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  <span>{chip.icon}</span>
                  <span style={{ color: '#e0e7ff' }}>{chip.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CopyBtn text={fullText} />
            <Btn variant="outline" size="sm" onClick={onExport}>
              <Download size={13} /> Export
            </Btn>
            <Btn size="sm" onClick={onSave} disabled={isSaving}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              <Save size={13} /> {isSaving ? 'Saving…' : 'Save Plan'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Objectives + Materials */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={15} color="#1e40af" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Learning Objectives</span>
          </div>
          <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.objectives.map((obj, i) => (
              <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{obj}</li>
            ))}
          </ol>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookMarked size={15} color="#7c3aed" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Materials & Resources</span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {plan.materials.map((m, i) => (
              <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{m}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Timeline + sections */}
      <Card style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={15} color="#059669" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Lesson Outline</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: totalMins !== plan.duration ? '#ef4444' : '#10b981' }}>
            {totalMins} / {plan.duration} min
          </span>
        </div>

        {/* Visual timeline bar */}
        <div style={{ display: 'flex', marginBottom: 16, borderRadius: 8, overflow: 'hidden', height: 10 }}>
          {plan.sections.map((sec, i) => {
            const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#6366f1'];
            return (
              <div key={sec.id} title={`${sec.title}: ${sec.duration} min`}
                style={{ flex: sec.duration, background: colors[i % colors.length], transition: 'flex 0.5s' }} />
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.sections.map((sec, i) => {
            const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#6366f1'];
            const color    = colors[i % colors.length];
            const isEditing = editingSection === sec.id;

            return (
              <div key={sec.id} style={{
                borderRadius: 12,
                border: `1px solid ${isEditing ? color + '55' : '#e2e8f0'}`,
                background: isEditing ? color + '08' : '#f8fafc',
                transition: 'all 0.2s',
              }}>
                {/* Section header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
                  onClick={() => setEditingSection(isEditing ? null : sec.id)}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: color + '18', border: `1px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {sec.icon || '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>{sec.title}</div>
                  </div>
                  <div style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: color + '18', color, flexShrink: 0,
                  }}>{sec.duration} min</div>
                  <span style={{ fontSize: 10, color: '#cbd5e1', display: 'inline-block', transition: 'transform 0.2s', transform: isEditing ? 'rotate(180deg)' : 'none' }}>▼</span>
                </div>

                {/* Expanded / editable content */}
                {isEditing ? (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <Label>Section Title</Label>
                        <Inp value={sec.title} onChange={(e) => updateSection(sec.id, 'title', e.target.value)} />
                      </div>
                      <div style={{ width: 90 }}>
                        <Label>Duration (min)</Label>
                        <Inp type="number" value={sec.duration} onChange={(e) => updateSection(sec.id, 'duration', +e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Content & Activities</Label>
                      <Textarea value={sec.content} rows={4} onChange={(e) => updateSection(sec.id, 'content', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Btn size="sm" onClick={() => setEditingSection(null)}>
                        <Check size={12} /> Done Editing
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '0 14px 14px 56px' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>{sec.content}</p>
                    <button onClick={() => setEditingSection(sec.id)} style={{
                      marginTop: 8, fontSize: 11, color, fontWeight: 700,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <PenLine size={11} /> Edit this section
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Assessment + Differentiation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={15} color="#d97706" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Assessment Ideas</span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.assessmentIdeas.map((a, i) => (
              <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{a}</li>
            ))}
          </ul>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={15} color="#be185d" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Differentiation Tips</span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.differentiationTips.map((t, i) => (
              <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{t}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Homework + Teacher Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={15} color="#16a34a" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Homework</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{plan.homeworkSuggestion}</p>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb size={15} color="#0284c7" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Teacher Notes</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{plan.teacherNotes}</p>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Loading skeleton
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(135deg,#0f172a,#1e3a8a)', padding: '20px 24px' }}>
        <Shimmer height={14} style={{ width: '40%', marginBottom: 10, opacity: 0.3 }} />
        <Shimmer height={24} style={{ width: '70%', marginBottom: 14, opacity: 0.3 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          {[80, 100, 90].map((w, i) => <Shimmer key={i} height={26} style={{ width: w, borderRadius: 999, opacity: 0.2 }} />)}
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} style={{ padding: '18px 20px' }}>
          <Shimmer height={14} style={{ width: '30%', marginBottom: 12 }} />
          {[100, 85, 95, 70].map((w, j) => <Shimmer key={j} height={11} style={{ width: `${w}%`, marginBottom: 8 }} />)}
        </Card>
      ))}

      {/* Groq loading indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
        padding: '14px', borderRadius: 12,
        background: 'linear-gradient(135deg,#f0f4ff,#eef2ff)',
        border: '1px solid #c7d2fe',
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          border: '2.5px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1',
          animation: 'spin 0.7s linear infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', fontFamily: "'DM Sans',sans-serif" }}>
          Groq is generating your lesson plan…
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Saved Plans Sidebar
// ═══════════════════════════════════════════════════════════════════════════════

function SavedPlansSidebar({ plans, onLoad, onDelete, activePlanId }: {
  plans: SavedPlan[];
  onLoad: (plan: LessonPlan) => void;
  onDelete: (id: string) => void;
  activePlanId: string | null;
}) {
  if (plans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8' }}>
        <BookOpen size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>No saved plans yet</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Generate and save your first plan</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {plans.map((p) => (
        <div key={p.id} style={{
          borderRadius: 10,
          border: `1px solid ${p.id === activePlanId ? '#1e40af' : '#e2e8f0'}`,
          background: p.id === activePlanId ? '#eef2ff' : '#f8fafc',
          padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
        }} onClick={() => onLoad(p.plan)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.topic}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                {p.subject} · Class {p.className}
              </div>
              <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1 }}>
                {new Date(p.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
              style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', flexShrink: 0 }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function LessonPlanning(): React.ReactElement {
  const { user } = useAuth();

  // Form state
  const [subject,    setSubject]    = useState('');
  const [topic,      setTopic]      = useState('');
  const [className,  setClassName]  = useState(user?.assignedClass ?? '');
  const [duration,   setDuration]   = useState(60);
  const [gradeLevel, setGradeLevel] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  // App state
  const [plan,         setPlan]         = useState<LessonPlan | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [savedPlans,   setSavedPlans]   = useState<SavedPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);

  const students   = storage.getStudents();
  const classNames = Array.from(new Set(students.map((s) => s.class_name).filter(Boolean))).sort();

  useEffect(() => { setSavedPlans(storage.getSavedPlans()); }, []);
  useEffect(() => {
    if (user?.role === 'TEACHER' && user.assignedClass) setClassName(user.assignedClass);
  }, [user]);

  const canGenerate = subject.trim() && topic.trim() && className.trim();

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true); setError(null); setPlan(null); setActivePlanId(null);
    try {
      const result = await generateLessonPlan({ subject, topic, className, duration, gradeLevel, additionalNotes: extraNotes });
      setPlan(result);
      setTimeout(() => document.getElementById('plan-output')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      setError(msg.includes('MISSING_KEY')
        ? 'Add VITE_GROQ_API_KEY=gsk_... to your .env file. Get a free key at console.groq.com'
        : `Failed to generate lesson plan: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!plan) return;
    setIsSaving(true);
    const id    = activePlanId ?? crypto.randomUUID();
    const saved: SavedPlan = {
      id, title: plan.title, subject: plan.subject,
      topic: plan.topic, className: plan.className,
      createdAt: new Date().toISOString(), plan,
    };
    storage.savePlan(saved);
    setSavedPlans(storage.getSavedPlans());
    setActivePlanId(id);
    setTimeout(() => setIsSaving(false), 800);
  };

  const handleDelete = (id: string) => {
    storage.deletePlan(id);
    setSavedPlans(storage.getSavedPlans());
    if (activePlanId === id) { setPlan(null); setActivePlanId(null); }
  };

  const handleExport = () => {
    if (!plan) return;
    const lines = [
      `LESSON PLAN: ${plan.title}`,
      `Subject: ${plan.subject}  |  Class: ${plan.className}  |  Duration: ${plan.duration} minutes`,
      `Generated by Groq AI · ${new Date().toLocaleDateString('en-ZA')}`,
      '',
      '══════════════════════════════════════',
      'LEARNING OBJECTIVES',
      '══════════════════════════════════════',
      ...plan.objectives.map((o, i) => `${i + 1}. ${o}`),
      '',
      '══════════════════════════════════════',
      'MATERIALS NEEDED',
      '══════════════════════════════════════',
      ...plan.materials.map((m) => `• ${m}`),
      '',
      '══════════════════════════════════════',
      'LESSON OUTLINE',
      '══════════════════════════════════════',
      ...plan.sections.map((s) => [`\n▶ ${s.title} (${s.duration} min)`, s.content].join('\n')),
      '',
      '══════════════════════════════════════',
      'ASSESSMENT IDEAS',
      '══════════════════════════════════════',
      ...plan.assessmentIdeas.map((a) => `• ${a}`),
      '',
      '══════════════════════════════════════',
      'DIFFERENTIATION STRATEGIES',
      '══════════════════════════════════════',
      ...plan.differentiationTips.map((t) => `• ${t}`),
      '',
      '══════════════════════════════════════',
      'HOMEWORK SUGGESTION',
      '══════════════════════════════════════',
      plan.homeworkSuggestion,
      '',
      '══════════════════════════════════════',
      'TEACHER NOTES',
      '══════════════════════════════════════',
      plan.teacherNotes,
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lesson_plan_${plan.subject.replace(/\s+/g,'_')}_${plan.topic.replace(/\s+/g,'_').slice(0,30)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
        @keyframes spin    { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        textarea:focus, input:focus { border-color: #1e40af !important; box-shadow: 0 0 0 3px rgba(30,64,175,0.1) !important; }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 24, animation: 'fadeUp .4s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 38, height: 38, borderRadius: 11,
                background: 'linear-gradient(135deg,#1e3a8a,#7c3aed)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>🧠</span>
              AI Lesson Planning
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0 48px', fontWeight: 500 }}>
              Powered by Groq · Generate comprehensive lesson plans in seconds
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'flex-start' }}>

        {/* ── LEFT: Form + Saved plans ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .45s ease both .05s' }}>

          {/* Generator form */}
          <Card style={{ padding: '20px 20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#1e3a8a,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wand2 size={16} color="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Generate a Plan</span>
              {/* Groq chip */}
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                ⚡ Groq
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Class */}
              <div>
                <Label>Class *</Label>
                {user?.role === 'TEACHER' ? (
                  <Inp value={className} readOnly style={{ background: '#f8fafc', color: '#64748b' }} />
                ) : classNames.length > 0 ? (
                  <SearchSelect value={className} onSelect={setClassName} options={classNames} placeholder="Select class" />
                ) : (
                  <Inp value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. 10-A" />
                )}
              </div>

              {/* Subject */}
              <div>
                <Label>Subject *</Label>
                <SearchSelect value={subject} onSelect={setSubject} options={SUBJECTS} placeholder="Select subject" />
              </div>

              {/* Topic */}
              <div>
                <Label>Topic *</Label>
                <Inp value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis, Quadratic equations…" />
              </div>

              {/* Grade level */}
              <div>
                <Label>Grade Level <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></Label>
                <Inp value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. Grade 10, Year 8…" />
              </div>

              {/* Duration */}
              <div>
                <Label>Duration</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DURATION_OPTIONS.map((d) => (
                    <button key={d} onClick={() => setDuration(d)} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                      background:   duration === d ? '#1e40af'  : '#f8fafc',
                      borderColor:  duration === d ? '#1e40af'  : '#e2e8f0',
                      color:        duration === d ? '#fff'     : '#64748b',
                      fontFamily:   "'DM Sans', sans-serif",
                    }}>{d} min</button>
                  ))}
                </div>
              </div>

              {/* Extra notes */}
              <div>
                <Label>Additional Notes <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></Label>
                <Textarea value={extraNotes} rows={2}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  placeholder="e.g. Focus on hands-on activities, ESL students, upcoming exam…" />
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                  background: canGenerate && !loading
                    ? 'linear-gradient(135deg,#1e3a8a,#7c3aed)'
                    : '#e2e8f0',
                  color:  canGenerate && !loading ? '#fff' : '#94a3b8',
                  fontSize: 14, fontWeight: 800,
                  cursor: canGenerate && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: canGenerate && !loading ? '0 4px 16px rgba(30,58,138,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    Generating with Groq…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Lesson Plan
                  </>
                )}
              </button>

              {!canGenerate && (
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                  Fill in Class, Subject and Topic to generate
                </p>
              )}
            </div>
          </Card>

          {/* How it works */}
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#3730a3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ⚡ Groq-Powered Planning
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <Brain size={14} />,        label: 'Curriculum-aligned',    desc: "Objectives follow Bloom's taxonomy"  },
                { icon: <Layers size={14} />,        label: 'Differentiation built-in', desc: 'Tips for all learner levels'     },
                { icon: <PenLine size={14} />,       label: 'Fully editable',        desc: 'Click any section to customise'     },
                { icon: <GraduationCap size={14} />, label: 'Saves to history',      desc: 'Access past plans anytime'          },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3730a3', flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e1b4b' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Saved plans */}
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BookMarked size={15} color="#64748b" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Saved Plans</span>
              {savedPlans.length > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px',
                  borderRadius: 999, background: '#e0e7ff', color: '#3730a3',
                }}>{savedPlans.length}</span>
              )}
            </div>
            <SavedPlansSidebar
              plans={savedPlans}
              onLoad={(p) => {
                setPlan(p);
                setActivePlanId(savedPlans.find((sp) => sp.plan === p)?.id ?? null);
                setTimeout(() => document.getElementById('plan-output')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
              }}
              onDelete={handleDelete}
              activePlanId={activePlanId}
            />
          </Card>
        </div>

        {/* ── RIGHT: Output ── */}
        <div id="plan-output" style={{ animation: 'fadeUp .5s ease both .1s' }}>
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>😕</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Generation failed</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6, maxWidth: 420, margin: '0 auto 20px' }}>{error}</div>
              <Btn onClick={handleGenerate}><RefreshCw size={14} /> Try Again</Btn>
            </Card>
          ) : plan ? (
            <LessonPlanView
              plan={plan}
              onEdit={setPlan}
              onSave={handleSave}
              onExport={handleExport}
              isSaving={isSaving}
            />
          ) : (
            <Card style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 36,
              }}>🧠</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                Ready to plan your next lesson?
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 380, margin: '0 auto 8px', lineHeight: 1.6 }}>
                Fill in the form on the left — select your class, subject, and topic, then click Generate.
              </div>
              <div style={{ fontSize: 11, color: '#a5b4fc', marginBottom: 24, fontWeight: 600 }}>
                ⚡ Powered by Groq · Fast, free, and curriculum-aligned
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {['Photosynthesis', 'Quadratic Equations', 'The French Revolution', 'Fractions'].map((example) => (
                  <button key={example} onClick={() => setTopic(example)} style={{
                    padding: '7px 14px', borderRadius: 999,
                    border: '1px solid #e0e7ff', background: '#f5f7ff',
                    fontSize: 12, fontWeight: 600, color: '#3730a3',
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    transition: 'all 0.15s',
                  }}>
                    {example}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}