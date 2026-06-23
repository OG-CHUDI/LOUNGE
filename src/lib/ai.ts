import { supabase } from "./supabase";

// Shapes returned by the `generate-course` edge function.
export interface GeneratedQuestion {
  kind: "single" | "multi" | "boolean" | "short";
  prompt: string;
  options?: string[];
  /** single: index · multi: index[] · boolean: true/false · short: undefined */
  answer?: number | number[] | boolean;
  explanation?: string;
}

export interface GeneratedCourse {
  title: string;
  description: string;
  category: string;
  tags: string[];
  durationMinutes: number;
  sections: { title: string; body: string }[];
  questions: GeneratedQuestion[];
}

export interface GenerateCourseInput {
  topic: string;
  audience?: string;
  minutes?: number;
}

/**
 * Ask the AI to draft a mini-course. The Groq key stays server-side in the
 * Supabase edge function — see supabase/functions/generate-course.
 */
export async function generateCourseDraft(input: GenerateCourseInput): Promise<GeneratedCourse> {
  const { data, error } = await supabase.functions.invoke("generate-course", { body: input });

  if (error) {
    // Edge functions surface their JSON { error } body on the context for non-2xx.
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      /* fall back to error.message */
    }
    throw new Error(message || "Course generation failed.");
  }

  if (!data || !Array.isArray((data as GeneratedCourse).sections)) {
    throw new Error("The AI response was empty. Try again.");
  }
  return data as GeneratedCourse;
}
