import Groq from "groq-sdk";
import { Student, AIStatus } from "../types";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true, // required when running in the browser
});

/**
 * Uses Groq (llama-3.3-70b) to predict at-risk students based on historical data.
 */
export async function analyzeAttendanceRisk(students: Student[]): Promise<AIStatus[]> {
  const studentDataSummary = students.map(s => {
    const total = s.attendanceRecords.length;
    const present = s.attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const pct = total === 0 ? 100 : (present / total) * 100;

    let consecutive = 0;
    for (let i = s.attendanceRecords.length - 1; i >= 0; i--) {
      if (s.attendanceRecords[i].status === 'ABSENT') consecutive++;
      else break;
    }

    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      attendancePercentage: Math.round(pct),
      consecutiveAbsences: consecutive,
      recentTrend: s.attendanceRecords.slice(-5).map(r => r.status)
    };
  });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a student attendance risk analyzer. Always respond with valid JSON only — no markdown, no explanation outside the JSON. " +
          "Return a JSON array where each object has: studentId (string), riskScore ('LOW', 'MEDIUM', or 'HIGH'), " +
          "reasoning (string), attendancePercentage (number), consecutiveAbsences (number)."
      },
      {
        role: "user",
        content:
          `Analyze these students' attendance data and identify risks.\n` +
          `Rules: < 75% attendance = HIGH risk. > 3 consecutive absences = HIGH risk.\n` +
          `Students: ${JSON.stringify(studentDataSummary)}`
      }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || '{"results":[]}';
  const parsed = JSON.parse(raw);

  // Groq json_object mode wraps arrays — unwrap if needed
  return Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.students ?? []);
}

/**
 * Uses Groq vision (llama-4-scout) to analyze a student photo based on a prompt.
 * Note: Groq does not support image generation/editing.
 * Returns a text description/analysis of the image.
 */
export async function analyzeStudentPhoto(base64Image: string, prompt: string): Promise<string | null> {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Data}`,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content ?? null;
}