// Supabase Edge Function: generate-course
//
// Generates a mini-course draft with Groq (free tier) and returns structured
// JSON the Course Editor maps onto its form. The Groq API key lives only here
// as a function secret — it never reaches the browser.
//
// Deploy:
//   supabase functions deploy generate-course
//   supabase secrets set GROQ_API_KEY=gsk_...           (from console.groq.com)
//   # optional override (default: openai/gpt-oss-120b)
//   supabase secrets set GROQ_MODEL=openai/gpt-oss-120b

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CATEGORIES = ["Design", "Engineering", "Leadership", "Product", "Research", "Operations", "General"];
const FIELDS = ["UX", "UI", "Frontend", "Backend", "AI/ML", "Data", "Strategy", "Process", "Comms", "Career"];

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return json({ error: "GROQ_API_KEY is not set on the function." }, 500);
  const model = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b";

  let input: { topic?: string; audience?: string; minutes?: number };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const topic = (input.topic ?? "").trim();
  if (!topic) return json({ error: "Give it a topic to write about." }, 400);
  const audience = (input.audience ?? "a busy product/design/engineering team").trim();
  const minutes = Math.min(60, Math.max(3, Number(input.minutes) || 15));

  const system = [
    "You are an instructional designer creating a short, practical mini-course for a team learning lounge.",
    "Return ONLY a single JSON object (no markdown, no prose) with this exact shape:",
    "{",
    '  "title": string,',
    '  "description": string (one or two sentences),',
    `  "category": one of ${JSON.stringify(CATEGORIES)},`,
    `  "tags": string[] (2-4 items, prefer from ${JSON.stringify(FIELDS)} but you may add others),`,
    '  "durationMinutes": number,',
    '  "sections": [ { "title": string, "body": string } ]  (3 to 5 sections; body is concise Markdown, ~120-200 words, may use bullet lists and short examples),',
    '  "questions": [ Question ]  (3 to 4 items)',
    "}",
    "Question is one of:",
    '  { "kind": "single", "prompt": string, "options": string[] (3-4), "answer": number (0-based index of the correct option), "explanation": string },',
    '  { "kind": "multi", "prompt": string, "options": string[] (3-5), "answer": number[] (indexes of correct options), "explanation": string },',
    '  { "kind": "boolean", "prompt": string, "answer": boolean, "explanation": string },',
    '  { "kind": "short", "prompt": string, "explanation": string }',
    "Keep it accurate and pragmatic. No filler. British English spelling.",
  ].join("\n");

  const userMsg = `Topic: ${topic}\nAudience: ${audience}\nTarget length: about ${minutes} minutes of reading.`;

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });
  } catch (e) {
    return json({ error: `Couldn't reach Groq: ${e instanceof Error ? e.message : "network error"}` }, 502);
  }

  if (!groqRes.ok) {
    const text = await groqRes.text();
    return json({ error: `Groq error (${groqRes.status}): ${text.slice(0, 500)}` }, 502);
  }

  const data = await groqRes.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return json({ error: "Groq returned an empty response." }, 502);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "Groq returned malformed JSON. Try again." }, 502);
  }

  // Normalise the shape so the client can trust it.
  const category = CATEGORIES.includes(parsed.category as string) ? parsed.category : "General";
  const sections = Array.isArray(parsed.sections)
    ? (parsed.sections as Array<Record<string, unknown>>)
        .filter((s) => s && (s.title || s.body))
        .map((s) => ({ title: String(s.title ?? ""), body: String(s.body ?? "") }))
    : [];
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  return json({
    title: String(parsed.title ?? topic),
    description: String(parsed.description ?? ""),
    category,
    tags: Array.isArray(parsed.tags) ? (parsed.tags as unknown[]).map(String).slice(0, 6) : [],
    durationMinutes: Math.min(60, Math.max(3, Number(parsed.durationMinutes) || minutes)),
    sections,
    questions,
  });
});
