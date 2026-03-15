// ═══════════════════════════════════════════════════════════════════════════════
// groqAI.ts  —  Shared Groq API helper
// Requires:  VITE_GROQ_API_KEY in your .env file
// Model:     llama-3.3-70b-versatile  (free tier, ~14,400 req/day)
// Usage:     import { groqChat, groqJSON } from './groqAI'
// ═══════════════════════════════════════════════════════════════════════════════

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroqOptions {
  maxTokens?:   number;   // default 1000
  temperature?: number;   // default 0.7
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function groqFetch(
  systemPrompt: string,
  userMessage:  string,
  opts:         GroqOptions = {},
): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY as string | undefined;

  if (!apiKey) {
    throw new Error(
      'MISSING_KEY: Add VITE_GROQ_API_KEY=gsk_... to your .env file. ' +
      'Get a free key at https://console.groq.com',
    );
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      max_tokens:  opts.maxTokens  ?? 1000,
      temperature: opts.temperature ?? 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content as string | undefined;

  if (!text) throw new Error('Groq returned an empty response.');
  return text;
}

// ─── Public: plain text ───────────────────────────────────────────────────────

/**
 * Call Groq and return the raw text response.
 *
 * @example
 * const reply = await groqChat('You are a helpful assistant.', 'Summarise today.');
 */
export async function groqChat(
  systemPrompt: string,
  userMessage:  string,
  opts?:        GroqOptions,
): Promise<string> {
  return groqFetch(systemPrompt, userMessage, opts);
}

// ─── Public: typed JSON ───────────────────────────────────────────────────────

/**
 * Call Groq and parse the response as JSON.
 * The system prompt MUST instruct the model to respond ONLY with JSON.
 *
 * @example
 * const plan = await groqJSON<LessonPlan>(systemPrompt, userMessage);
 */
export async function groqJSON<T = unknown>(
  systemPrompt: string,
  userMessage:  string,
  opts?:        GroqOptions,
): Promise<T> {
  const raw = await groqFetch(systemPrompt, userMessage, opts);

  // Strip markdown code fences if the model added them
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`Groq returned invalid JSON:\n${clean.slice(0, 300)}`);
  }
}