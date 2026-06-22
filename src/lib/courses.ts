import { supabase } from "./supabase";

// ── Domain types ────────────────────────────────────────────
export type SectionKind = "text" | "audio" | "video";
export type QuestionKind = "single" | "multi" | "boolean" | "short";

export interface CourseRow {
  id: string;
  title: string;
  cover_url: string | null;
  duration_minutes: number;
  category: string;
  tags: string[] | null;
  description: string | null;
  author_id: string | null;
  published: boolean;
  clarify_ama_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SectionRow {
  id: string;
  course_id: string;
  position: number;
  title: string;
  kind: SectionKind;
  body: string | null;
  media_url: string | null;
  embed_url: string | null;
  duration_seconds: number | null;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionRow {
  id: string;
  course_id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: QuestionOption[];
  /** single: optId · multi: optId[] · boolean: true/false · short: null */
  correct: string | string[] | boolean | null;
  explanation: string | null;
}

export interface ProgressRow {
  user_id: string;
  course_id: string;
  percent: number;
  completed_at: string | null;
  quiz_responses: Record<string, unknown> | null;
  quiz_score: number | null;
  updated_at: string | null;
}

// ── Shared options ──────────────────────────────────────────
export const COURSE_CATEGORIES = [
  "Design",
  "Engineering",
  "Leadership",
  "Product",
  "Research",
  "Operations",
  "General",
] as const;

export const COURSE_FIELDS = [
  "UX",
  "UI",
  "Frontend",
  "Backend",
  "AI/ML",
  "Data",
  "Strategy",
  "Process",
  "Comms",
  "Career",
] as const;

// ── Uploaded-video constraints (enforced client-side) ───────
export const VIDEO_MAX_SECONDS = 240; // 4 minutes
export const VIDEO_MAX_HEIGHT = 480; // 480p
export const COURSE_MEDIA_BUCKET = "course-media";

export interface VideoCheck {
  ok: boolean;
  durationSeconds: number;
  height: number;
  error?: string;
}

/**
 * Read an uploaded video's metadata in the browser and enforce the
 * 4-minute / 480p ceiling before we ever upload it.
 */
export function inspectVideoFile(file: File): Promise<VideoCheck> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const done = (check: VideoCheck) => {
      URL.revokeObjectURL(url);
      resolve(check);
    };

    video.onloadedmetadata = () => {
      const durationSeconds = Math.round(video.duration);
      const height = video.videoHeight;
      let error: string | undefined;
      if (durationSeconds > VIDEO_MAX_SECONDS) {
        error = `Video is ${Math.ceil(durationSeconds / 60)} min — the limit is 4 minutes.`;
      } else if (height > VIDEO_MAX_HEIGHT) {
        error = `Video is ${height}p — the limit is 480p. Please downscale it first.`;
      }
      done({ ok: !error, durationSeconds, height, error });
    };
    video.onerror = () =>
      done({ ok: false, durationSeconds: 0, height: 0, error: "Couldn't read that video file." });

    video.src = url;
  });
}

// ── External video embeds ───────────────────────────────────
/**
 * Convert a shared video URL (YouTube, Loom, Vimeo, Google Drive) into an
 * iframe-embeddable src. Unknown hosts are returned unchanged.
 */
export function toEmbedSrc(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (host.endsWith("loom.com")) return url.replace("/share/", "/embed/");
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
    if (host.endsWith("drive.google.com")) {
      const m = /\/file\/d\/([^/]+)/.exec(u.pathname);
      return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
    }
    return url;
  } catch {
    return null;
  }
}

// ── Quiz template + grading ─────────────────────────────────
let tmplCounter = 0;
const opt = (text: string): QuestionOption => ({ id: `o${tmplCounter++}`, text });

/** A starter quiz the author can edit, reorder, or delete freely. */
export function makeTemplateQuestions(): Omit<QuestionRow, "id" | "course_id">[] {
  return [
    {
      position: 0,
      kind: "single",
      prompt: "Which idea from this course felt most useful?",
      options: [opt("Option A"), opt("Option B"), opt("Option C")],
      correct: null,
      explanation: "There's no wrong answer — this is just to help it stick.",
    },
    {
      position: 1,
      kind: "boolean",
      prompt: "Do you feel ready to apply this in your own work?",
      options: [],
      correct: null,
      explanation: "If not, the AMA link below is a good next step.",
    },
    {
      position: 2,
      kind: "short",
      prompt: "In a sentence, what's one thing you'll try differently?",
      options: [],
      correct: null,
      explanation: "",
    },
  ];
}

export type GradeResult = "correct" | "incorrect" | "reflection";

/** Grade a single response. Short answers and answerless questions never fail. */
export function gradeQuestion(q: QuestionRow, response: unknown): GradeResult {
  if (q.kind === "short" || q.correct === null || q.correct === undefined) return "reflection";

  if (q.kind === "single" || q.kind === "boolean") {
    return response === q.correct ? "correct" : "incorrect";
  }
  if (q.kind === "multi" && Array.isArray(q.correct) && Array.isArray(response)) {
    const a = [...(q.correct as string[])].sort();
    const b = [...(response as string[])].sort();
    return a.length === b.length && a.every((v, i) => v === b[i]) ? "correct" : "incorrect";
  }
  return "reflection";
}

// ── Fetch a full course (course + sections + questions) ─────
export interface FullCourse {
  course: CourseRow;
  sections: SectionRow[];
  questions: QuestionRow[];
}

export async function fetchFullCourse(id: string): Promise<FullCourse | null> {
  const [{ data: course }, { data: sections }, { data: questions }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).single(),
    supabase.from("course_sections").select("*").eq("course_id", id).order("position"),
    supabase.from("course_questions").select("*").eq("course_id", id).order("position"),
  ]);
  if (!course) return null;
  return {
    course: course as CourseRow,
    sections: (sections ?? []) as SectionRow[],
    questions: (questions ?? []) as QuestionRow[],
  };
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
