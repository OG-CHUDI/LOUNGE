import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  fetchFullCourse,
  gradeQuestion,
  toEmbedSrc,
  formatDuration,
  type QuestionRow,
  type SectionRow,
} from "@/lib/courses";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  AudioLines,
  Video,
  Pencil,
  Check,
  X,
  Sparkles,
  MessageCircleQuestion,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CoursePlayer() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["course-full", id],
    queryFn: () => fetchFullCourse(id!),
    enabled: !!id,
  });

  // step: 0..sections-1 = section; sections = quiz (if any); then "done"
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const sections = useMemo(() => data?.sections ?? [], [data]);
  const questions = useMemo(() => data?.questions ?? [], [data]);
  const hasQuiz = questions.length > 0;
  const totalSteps = sections.length + (hasQuiz ? 1 : 0);
  const onQuiz = hasQuiz && step === sections.length;

  // Resume from saved progress.
  useEffect(() => {
    if (!data || !user) return;
    supabase
      .from("course_progress")
      .select("completed_at")
      .eq("course_id", data.course.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.completed_at) setCompleted(true);
      });
  }, [data, user]);

  const writeProgress = async (percent: number, done: boolean, score: number | null) => {
    if (!user || !data) return;
    await supabase.from("course_progress").upsert(
      {
        user_id: user.id,
        course_id: data.course.id,
        percent,
        completed_at: done ? new Date().toISOString() : null,
        quiz_responses: done ? (responses as Record<string, unknown>) : null,
        quiz_score: score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" },
    );
    queryClient.invalidateQueries({ queryKey: ["course-progress", user.id] });
  };

  const score = useMemo(() => {
    const gradeable = questions.filter((q) => q.correct !== null && q.correct !== undefined && q.kind !== "short");
    if (gradeable.length === 0) return null;
    const correct = gradeable.filter((q) => gradeQuestion(q, responses[q.id]) === "correct").length;
    return { correct, total: gradeable.length };
  }, [questions, responses]);

  const advance = () => {
    const next = step + 1;
    setStep(next);
    void writeProgress(Math.round((Math.min(next, totalSteps) / totalSteps) * 100), false, null);
  };

  const finish = async () => {
    setCompleted(true);
    await writeProgress(100, true, score ? Math.round((score.correct / score.total) * 100) : null);
    toast.success("Course complete. Nice work.");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading course…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>That course couldn't be found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/learn/courses")}>
          Back to courses
        </Button>
      </div>
    );
  }

  const { course } = data;
  const mine = course.author_id === user?.id;
  const progressPct = Math.round((Math.min(step, totalSteps) / Math.max(totalSteps, 1)) * 100);

  // ── Completion screen ─────────────────────────────────────
  if (completed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in text-center py-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 mx-auto">
          <PartyPopper className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">You finished {course.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {score ? `Self-check: ${score.correct}/${score.total}. ` : ""}
            Remember, this isn't a test — it's about picking things up.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("/learn/ama")}>
            <MessageCircleQuestion className="w-4 h-4 mr-1.5" /> Still curious? Ask in the AMA
          </Button>
          <Button onClick={() => navigate("/learn/courses")}>Back to courses</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/learn/courses")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Courses
        </button>
        {mine && (
          <button
            onClick={() => navigate(`/learn/courses/${course.id}/edit`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-[10px]">{course.category}</Badge>
          {course.tags?.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">{course.title}</h1>
        {course.description && <p className="text-sm text-muted-foreground mt-1">{course.description}</p>}
      </div>

      {/* Progress rail */}
      <div className="flex items-center gap-3">
        <Progress value={progressPct} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">
          {onQuiz ? "Quiz" : `Section ${step + 1} of ${sections.length}`}
        </span>
      </div>

      {/* Body */}
      {onQuiz ? (
        <Quiz
          questions={questions}
          responses={responses}
          setResponses={setResponses}
          submitted={submitted}
        />
      ) : (
        <SectionView section={sections[step]} />
      )}

      {/* Nav */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => {
            setSubmitted(false);
            setStep((s) => Math.max(0, s - 1));
          }}
        >
          Previous
        </Button>

        {onQuiz ? (
          submitted ? (
            <Button onClick={finish}>
              <Check className="w-4 h-4 mr-1.5" /> Finish course
            </Button>
          ) : (
            <Button onClick={() => setSubmitted(true)}>
              <Sparkles className="w-4 h-4 mr-1.5" /> Check answers
            </Button>
          )
        ) : step < totalSteps - 1 ? (
          <Button onClick={advance}>
            Next <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={finish}>
            <Check className="w-4 h-4 mr-1.5" /> Finish course
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Section renderer ────────────────────────────────────────
function SectionView({ section }: { section: SectionRow }) {
  const Icon = section.kind === "audio" ? AudioLines : section.kind === "video" ? Video : FileText;
  const embed = section.kind === "video" && section.embed_url ? toEmbedSrc(section.embed_url) : null;

  return (
    <Card className="p-5 bg-card/60 border-border/30 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="w-4 h-4 text-primary" />
        {section.title}
        {section.duration_seconds ? (
          <span className="text-xs text-muted-foreground ml-auto">{formatDuration(section.duration_seconds)}</span>
        ) : null}
      </div>

      {section.kind === "video" &&
        (section.media_url ? (
          <video src={section.media_url} controls className="w-full rounded-xl bg-black" />
        ) : embed ? (
          <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={embed}
              title={section.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null)}

      {section.kind === "audio" && section.media_url && (
        <audio src={section.media_url} controls className="w-full" />
      )}

      {section.body && (
        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{section.body}</div>
      )}
    </Card>
  );
}

// ── Quiz renderer (no-fail) ─────────────────────────────────
function Quiz({
  questions,
  responses,
  setResponses,
  submitted,
}: {
  questions: QuestionRow[];
  responses: Record<string, unknown>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  submitted: boolean;
}) {
  const set = (qid: string, value: unknown) => setResponses((prev) => ({ ...prev, [qid]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4 text-primary" />
        A quick self-check. There's no pass mark.
      </div>

      {questions.map((q, i) => {
        const result = submitted ? gradeQuestion(q, responses[q.id]) : null;
        return (
          <Card key={q.id} className="p-4 bg-card/60 border-border/30 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground mt-0.5">Q{i + 1}</span>
              <p className="text-sm font-medium text-foreground flex-1">{q.prompt}</p>
              {result === "correct" && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              {result === "incorrect" && <X className="w-4 h-4 text-amber-400 shrink-0" />}
            </div>

            {/* Single choice */}
            {q.kind === "single" && (
              <div className="space-y-1.5">
                {q.options.map((o) => (
                  <button
                    key={o.id}
                    disabled={submitted}
                    onClick={() => set(q.id, o.id)}
                    className={cn(
                      "w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                      responses[q.id] === o.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/40 hover:bg-muted/20 text-foreground/80",
                    )}
                  >
                    {o.text}
                  </button>
                ))}
              </div>
            )}

            {/* Multiple choice */}
            {q.kind === "multi" && (
              <div className="space-y-1.5">
                {q.options.map((o) => {
                  const arr = Array.isArray(responses[q.id]) ? (responses[q.id] as string[]) : [];
                  const checked = arr.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      disabled={submitted}
                      onClick={() => set(q.id, checked ? arr.filter((x) => x !== o.id) : [...arr, o.id])}
                      className={cn(
                        "w-full text-left text-sm px-3 py-2 rounded-lg border flex items-center gap-2 transition-colors",
                        checked ? "border-primary bg-primary/10 text-foreground" : "border-border/40 hover:bg-muted/20 text-foreground/80",
                      )}
                    >
                      <span className={cn("w-4 h-4 rounded border flex items-center justify-center", checked ? "bg-primary border-primary" : "border-border")}>
                        {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                      </span>
                      {o.text}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Yes / No */}
            {q.kind === "boolean" && (
              <div className="flex gap-2">
                {([["Yes", true], ["No", false]] as const).map(([label, val]) => (
                  <button
                    key={label}
                    disabled={submitted}
                    onClick={() => set(q.id, val)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm border transition-colors",
                      responses[q.id] === val ? "border-primary bg-primary/10 text-foreground" : "border-border/40 hover:bg-muted/20 text-foreground/80",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Short answer */}
            {q.kind === "short" && (
              <Textarea
                disabled={submitted}
                value={(responses[q.id] as string) ?? ""}
                onChange={(e) => set(q.id, e.target.value)}
                placeholder="Your thoughts…"
                rows={2}
              />
            )}

            {/* Feedback */}
            {submitted && (result === "reflection" || result) && (
              <div
                className={cn(
                  "text-xs rounded-lg px-3 py-2",
                  result === "correct"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : result === "incorrect"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-muted/20 text-muted-foreground",
                )}
              >
                {result === "correct" ? "Nice — that's right. " : result === "incorrect" ? "Not quite, but no worries. " : "Thanks for sharing. "}
                {q.explanation}
              </div>
            )}
          </Card>
        );
      })}

      {!submitted && (
        <p className="text-xs text-muted-foreground text-center">Answer what you can, then check below.</p>
      )}
    </div>
  );
}
