import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import {
  COURSE_CATEGORIES,
  COURSE_FIELDS,
  COURSE_MEDIA_BUCKET,
  fetchFullCourse,
  inspectVideoFile,
  makeTemplateQuestions,
  type QuestionKind,
  type QuestionOption,
  type SectionKind,
} from "@/lib/courses";
import { generateCourseDraft, type GeneratedQuestion } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Loader2,
  FileText,
  AudioLines,
  Video,
  Upload,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `k${Math.random()}`;

interface DraftSection {
  key: string;
  title: string;
  kind: SectionKind;
  body: string;
  media_url: string | null;
  embed_url: string | null;
  duration_seconds: number | null;
  uploading?: boolean;
}

interface DraftQuestion {
  key: string;
  kind: QuestionKind;
  prompt: string;
  options: QuestionOption[];
  correct: string | string[] | boolean | null;
  explanation: string;
}

const SECTION_ICON: Record<SectionKind, typeof FileText> = {
  text: FileText,
  audio: AudioLines,
  video: Video,
};

function newSection(): DraftSection {
  return { key: uid(), title: "", kind: "text", body: "", media_url: null, embed_url: null, duration_seconds: null };
}

// Convert an AI-generated question into the editor's draft shape.
function mapGeneratedQuestion(g: GeneratedQuestion): DraftQuestion {
  const base = { key: uid(), prompt: g.prompt ?? "", explanation: g.explanation ?? "" };
  if (g.kind === "single" || g.kind === "multi") {
    const options = (g.options ?? []).map((text) => ({ id: uid(), text }));
    let correct: DraftQuestion["correct"] = null;
    if (g.kind === "single" && typeof g.answer === "number") {
      correct = options[g.answer]?.id ?? null;
    } else if (g.kind === "multi" && Array.isArray(g.answer)) {
      correct = g.answer.map((i) => options[i]?.id).filter(Boolean) as string[];
    }
    return { ...base, kind: g.kind, options, correct };
  }
  if (g.kind === "boolean") {
    return { ...base, kind: "boolean", options: [], correct: typeof g.answer === "boolean" ? g.answer : null };
  }
  return { ...base, kind: "short", options: [], correct: null };
}

export default function CourseEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("General");
  const [tags, setTags] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [sections, setSections] = useState<DraftSection[]>([newSection()]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newField, setNewField] = useState("");

  // AI draft generation
  const [aiTopic, setAiTopic] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const generate = async () => {
    const topic = aiTopic.trim();
    if (!topic) {
      toast.error("Give the AI a topic first.");
      return;
    }
    setAiLoading(true);
    try {
      const draft = await generateCourseDraft({
        topic,
        audience: aiAudience.trim() || undefined,
        minutes: durationMinutes,
      });
      setTitle(draft.title);
      setDescription(draft.description);
      if (draft.category) setCategory(draft.category);
      if (draft.tags?.length) setTags((prev) => Array.from(new Set([...prev, ...draft.tags])));
      if (draft.durationMinutes) setDurationMinutes(draft.durationMinutes);
      setSections(
        draft.sections.length
          ? draft.sections.map((s) => ({
              key: uid(),
              title: s.title,
              kind: "text" as SectionKind,
              body: s.body,
              media_url: null,
              embed_url: null,
              duration_seconds: null,
            }))
          : [newSection()],
      );
      setQuestions((draft.questions ?? []).map(mapGeneratedQuestion));
      toast.success("Draft generated — review and edit before publishing.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setAiLoading(false);
    }
  };

  // Built-in options merged with any custom ones the author has chosen.
  const categoryOptions = useMemo(
    () => Array.from(new Set<string>([...COURSE_CATEGORIES, category])),
    [category],
  );
  const fieldOptions = useMemo(
    () => Array.from(new Set<string>([...COURSE_FIELDS, ...tags])),
    [tags],
  );

  const addCategory = () => {
    const c = newCategory.trim();
    if (!c) return;
    setCategory(c);
    setNewCategory("");
    setAddingCategory(false);
  };
  const addField = () => {
    const f = newField.trim();
    if (!f) return;
    if (!tags.includes(f)) setTags((p) => [...p, f]);
    setNewField("");
  };

  // Load existing course for editing.
  const { data: existing, isLoading } = useQuery({
    queryKey: ["course-edit", id],
    queryFn: () => fetchFullCourse(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!existing) return;
    const { course, sections: secs, questions: qs } = existing;
    if (course.author_id && user && course.author_id !== user.id) {
      toast.error("You can only edit courses you created.");
      navigate(`/learn/courses/${course.id}`);
      return;
    }
    setTitle(course.title);
    setDescription(course.description ?? "");
    setCategory(course.category);
    setTags(course.tags ?? []);
    setCoverUrl(course.cover_url);
    setDurationMinutes(course.duration_minutes ?? 15);
    setSections(
      secs.length
        ? secs.map((s) => ({
            key: s.id,
            title: s.title,
            kind: s.kind,
            body: s.body ?? "",
            media_url: s.media_url,
            embed_url: s.embed_url,
            duration_seconds: s.duration_seconds,
          }))
        : [newSection()],
    );
    setQuestions(
      qs.map((q) => ({
        key: q.id,
        kind: q.kind,
        prompt: q.prompt,
        options: q.options ?? [],
        correct: q.correct,
        explanation: q.explanation ?? "",
      })),
    );
  }, [existing, user, navigate]);

  // ── Section helpers ───────────────────────────────────────
  const patchSection = (key: string, patch: Partial<DraftSection>) =>
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const moveSection = (idx: number, dir: -1 | 1) =>
    setSections((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const uploadMedia = async (key: string, file: File, kind: SectionKind) => {
    if (!user) return;
    if (kind === "video") {
      const check = await inspectVideoFile(file);
      if (!check.ok) {
        toast.error(check.error ?? "That video can't be used.");
        return;
      }
      patchSection(key, { duration_seconds: check.durationSeconds });
    }
    patchSection(key, { uploading: true });
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${user.id}/courses/${key}-${safe}`;
      const url = await uploadToBucket(COURSE_MEDIA_BUCKET, path, file, file.type);
      patchSection(key, { media_url: url, embed_url: null, uploading: false });
      toast.success("Uploaded.");
    } catch (e) {
      patchSection(key, { uploading: false });
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  const uploadCover = async (file: File) => {
    if (!user) return;
    setCoverUploading(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const url = await uploadToBucket(COURSE_MEDIA_BUCKET, `${user.id}/covers/${uid()}-${safe}`, file, file.type);
      setCoverUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cover upload failed.");
    } finally {
      setCoverUploading(false);
    }
  };

  // ── Question helpers ──────────────────────────────────────
  const patchQuestion = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const addQuestion = () =>
    setQuestions((prev) => [
      ...prev,
      { key: uid(), kind: "single", prompt: "", options: [{ id: uid(), text: "" }], correct: null, explanation: "" },
    ]);

  const loadTemplate = () =>
    setQuestions(makeTemplateQuestions().map((q) => ({ key: uid(), ...q, explanation: q.explanation ?? "" })));

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  // ── Save ──────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!user) throw new Error("You need to be signed in.");
      const t = title.trim();
      if (!t) throw new Error("Give your course a title.");
      const usableSections = sections.filter(
        (s) => s.title.trim() || s.body.trim() || s.media_url || s.embed_url,
      );
      if (usableSections.length === 0) throw new Error("Add at least one section with some content.");

      // 1. Upsert the course row.
      const coursePayload = {
        title: t,
        description: description.trim() || null,
        category,
        tags,
        cover_url: coverUrl,
        duration_minutes: durationMinutes,
        published: publish,
        author_id: user.id,
        updated_at: new Date().toISOString(),
      };

      let courseId = id;
      if (isNew) {
        const { data, error } = await supabase.from("courses").insert(coursePayload).select("id").single();
        if (error) throw error;
        courseId = (data as { id: string }).id;
      } else {
        const { error } = await supabase.from("courses").update(coursePayload).eq("id", courseId!);
        if (error) throw error;
      }

      // 2. Replace sections (delete-all + insert keeps ordering simple).
      await supabase.from("course_sections").delete().eq("course_id", courseId!);
      const { error: secErr } = await supabase.from("course_sections").insert(
        usableSections.map((s, i) => ({
          course_id: courseId,
          position: i,
          title: s.title.trim() || `Section ${i + 1}`,
          kind: s.kind,
          body: s.body.trim() || null,
          media_url: s.kind === "text" ? null : s.media_url,
          embed_url: s.kind === "video" ? s.embed_url : null,
          duration_seconds: s.duration_seconds,
        })),
      );
      if (secErr) throw secErr;

      // 3. Replace questions.
      await supabase.from("course_questions").delete().eq("course_id", courseId!);
      const usableQuestions = questions.filter((q) => q.prompt.trim());
      if (usableQuestions.length) {
        const { error: qErr } = await supabase.from("course_questions").insert(
          usableQuestions.map((q, i) => ({
            course_id: courseId,
            position: i,
            kind: q.kind,
            prompt: q.prompt.trim(),
            options: q.kind === "single" || q.kind === "multi" ? q.options.filter((o) => o.text.trim()) : [],
            correct: q.correct,
            explanation: q.explanation.trim() || null,
          })),
        );
        if (qErr) throw qErr;
      }

      return courseId!;
    },
    onSuccess: (courseId, publish) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["course-edit", courseId] });
      toast.success(publish ? "Course published." : "Draft saved.");
      navigate(`/learn/courses/${courseId}`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't save the course."),
  });

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading course…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      <button
        onClick={() => navigate("/learn/courses")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to courses
      </button>

      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          {isNew ? "Create a mini-course" : "Edit course"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Share something you know. Keep it short — the goal is upskilling, not exams.
        </p>
      </div>

      {/* ── AI draft generator ──────────────────────────── */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 to-fuchsia-500/5 border-primary/20 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Draft with AI</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Describe a topic and the AI will draft sections and a quiz. It overwrites the fields below — review everything before publishing.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Topic, e.g. Writing a tight design critique"
            onKeyDown={(e) => e.key === "Enter" && !aiLoading && (e.preventDefault(), generate())}
          />
          <Input
            value={aiAudience}
            onChange={(e) => setAiAudience(e.target.value)}
            placeholder="Audience (optional), e.g. junior designers"
          />
        </div>
        <Button type="button" onClick={generate} disabled={aiLoading} className="rounded-xl">
          {aiLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          {aiLoading ? "Generating…" : "Generate draft"}
        </Button>
      </Card>

      {/* ── Course meta ─────────────────────────────────── */}
      <Card className="p-5 bg-card/60 border-border/30 space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reading a Figma handoff" />
        </div>

        <div className="space-y-1.5">
          <Label>Short description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One or two lines on what someone will walk away with."
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            {addingCategory ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                  placeholder="New category"
                />
                <Button type="button" variant="secondary" onClick={addCategory}>Add</Button>
                <Button type="button" variant="ghost" onClick={() => setAddingCategory(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setAddingCategory(true)} title="Add a new category">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Estimated minutes</Label>
            <Input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Fields it covers</Label>
          <div className="flex flex-wrap gap-2">
            {fieldOptions.map((f) => (
              <Badge
                key={f}
                onClick={() => toggleTag(f)}
                variant={tags.includes(f) ? "default" : "outline"}
                className="cursor-pointer rounded-full px-3 py-1 text-xs transition-all hover:scale-105"
              >
                {tags.includes(f) && <Check className="w-3 h-3 mr-1" />}
                {f}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Input
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField())}
              placeholder="Add another field…"
              className="h-9"
            />
            <Button type="button" variant="secondary" className="h-9" onClick={addField}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Cover image (optional)</Label>
          <div className="flex items-center gap-3">
            {coverUrl && <img src={coverUrl} alt="cover" className="w-20 h-14 rounded-lg object-cover" />}
            <label className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors">
              {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {coverUrl ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
              />
            </label>
            {coverUrl && (
              <button onClick={() => setCoverUrl(null)} className="text-xs text-muted-foreground hover:text-destructive">
                Remove
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Sections ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground">Sections</h3>
          <span className="text-xs text-muted-foreground">{sections.length} section{sections.length === 1 ? "" : "s"}</span>
        </div>

        {sections.map((s, idx) => {
          const Icon = SECTION_ICON[s.kind];
          return (
            <Card key={s.key} className="p-4 bg-card/60 border-border/30 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <Input
                  value={s.title}
                  onChange={(e) => patchSection(s.key, { title: e.target.value })}
                  placeholder={`Section ${idx + 1} title`}
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/30 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === sections.length - 1}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/30 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSections((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== s.key) : prev))}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Kind switcher */}
              <div className="flex gap-1.5">
                {(["text", "audio", "video"] as SectionKind[]).map((k) => {
                  const KIcon = SECTION_ICON[k];
                  return (
                    <button
                      key={k}
                      onClick={() => patchSection(s.key, { kind: k })}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                        s.kind === k ? "bg-primary/15 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
                      )}
                    >
                      <KIcon className="w-3.5 h-3.5" />
                      {k}
                    </button>
                  );
                })}
              </div>

              {/* Body / media */}
              {s.kind === "text" ? (
                <Textarea
                  value={s.body}
                  onChange={(e) => patchSection(s.key, { body: e.target.value })}
                  placeholder="Write the lesson. Plain text or simple Markdown."
                  rows={6}
                />
              ) : (
                <div className="space-y-3">
                  {s.kind === "video" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Paste a video link (YouTube, Loom, Vimeo, Drive)</Label>
                      <Input
                        value={s.embed_url ?? ""}
                        onChange={(e) => patchSection(s.key, { embed_url: e.target.value || null, media_url: null })}
                        placeholder="https://…"
                      />
                      <p className="text-[11px] text-muted-foreground">or upload a file below</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors">
                      {s.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload {s.kind}
                      <input
                        type="file"
                        accept={s.kind === "audio" ? "audio/*" : "video/*"}
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadMedia(s.key, e.target.files[0], s.kind)}
                      />
                    </label>
                    {s.media_url && <span className="text-xs text-emerald-300 flex items-center gap-1"><Check className="w-3 h-3" /> uploaded</span>}
                  </div>
                  {s.kind === "video" && (
                    <p className="text-[11px] text-muted-foreground">Uploaded video must be 4 minutes or less and 480p or lower.</p>
                  )}
                  <Textarea
                    value={s.body}
                    onChange={(e) => patchSection(s.key, { body: e.target.value })}
                    placeholder="Optional notes or a transcript to go with the media."
                    rows={3}
                  />
                </div>
              )}
            </Card>
          );
        })}

        <Button variant="outline" className="w-full rounded-xl" onClick={() => setSections((p) => [...p, newSection()])}>
          <Plus className="w-4 h-4 mr-1.5" /> Add section
        </Button>
      </div>

      {/* ── Quiz ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-foreground">Quiz (optional)</h3>
            <p className="text-xs text-muted-foreground">A light self-check. Learners can't fail it.</p>
          </div>
          {questions.length === 0 && (
            <Button variant="ghost" size="sm" onClick={loadTemplate}>
              <Sparkles className="w-4 h-4 mr-1.5" /> Use a template
            </Button>
          )}
        </div>

        {questions.map((q, idx) => (
          <QuestionEditor
            key={q.key}
            q={q}
            index={idx}
            onChange={(patch) => patchQuestion(q.key, patch)}
            onRemove={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))}
          />
        ))}

        <Button variant="outline" className="w-full rounded-xl" onClick={addQuestion}>
          <Plus className="w-4 h-4 mr-1.5" /> Add question
        </Button>
      </div>

      {/* ── Save bar ────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 sticky bottom-0 py-3 bg-background/80 backdrop-blur-xl border-t border-border/30">
        <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate(false)}>
          Save draft
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
          {save.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
          {isNew ? "Publish" : "Save & publish"}
        </Button>
      </div>
    </div>
  );
}

// ── Per-question editor ─────────────────────────────────────
function QuestionEditor({
  q,
  index,
  onChange,
  onRemove,
}: {
  q: DraftQuestion;
  index: number;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onRemove: () => void;
}) {
  const hasCorrect = q.correct !== null && q.correct !== undefined;
  const isChoice = q.kind === "single" || q.kind === "multi";

  const setKind = (kind: QuestionKind) => {
    // Reset correctness when switching types to avoid mismatched shapes.
    if (kind === "multi") onChange({ kind, correct: Array.isArray(q.correct) ? q.correct : [] });
    else if (kind === "short") onChange({ kind, correct: null });
    else onChange({ kind, correct: null });
  };

  const patchOption = (oid: string, text: string) =>
    onChange({ options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)) });

  const toggleCorrectOption = (oid: string) => {
    if (q.kind === "single") onChange({ correct: q.correct === oid ? null : oid });
    else if (q.kind === "multi") {
      const cur = Array.isArray(q.correct) ? q.correct : [];
      onChange({ correct: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] });
    }
  };

  return (
    <Card className="p-4 bg-card/60 border-border/30 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-muted-foreground mt-2.5">Q{index + 1}</span>
        <Input
          value={q.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="Question prompt"
          className="flex-1"
        />
        <button onClick={onRemove} className="p-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["single", "multi", "boolean", "short"] as QuestionKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
              q.kind === k ? "bg-primary/15 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
            )}
          >
            {k === "single" ? "Single choice" : k === "multi" ? "Multiple choice" : k === "boolean" ? "Yes / No" : "Short answer"}
          </button>
        ))}
      </div>

      {isChoice && (
        <div className="space-y-2">
          {q.options.map((o) => {
            const correct =
              q.kind === "single" ? q.correct === o.id : Array.isArray(q.correct) && q.correct.includes(o.id);
            return (
              <div key={o.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCorrectOption(o.id)}
                  title="Mark as the correct answer"
                  className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                    correct ? "bg-emerald-500/80 border-emerald-500 text-white" : "border-border hover:border-primary",
                  )}
                >
                  {correct && <Check className="w-3 h-3" />}
                </button>
                <Input value={o.text} onChange={(e) => patchOption(o.id, e.target.value)} placeholder="Option" className="flex-1" />
                <button
                  onClick={() => onChange({ options: q.options.filter((x) => x.id !== o.id) })}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ options: [...q.options, { id: uid(), text: "" }] })}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add option
          </Button>
        </div>
      )}

      {q.kind === "boolean" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Correct answer:</span>
          {([["Yes", true], ["No", false]] as const).map(([label, val]) => (
            <button
              key={label}
              onClick={() => onChange({ correct: q.correct === val ? null : val })}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                q.correct === val ? "bg-emerald-500/80 text-white" : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(isChoice || q.kind === "boolean") && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={!hasCorrect}
            onCheckedChange={(on) => onChange({ correct: on ? null : q.kind === "multi" ? [] : q.kind === "boolean" ? true : "" })}
          />
          Reflection only (no right answer)
        </div>
      )}

      <Textarea
        value={q.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        placeholder="Optional note shown after answering (the 'why')."
        rows={2}
      />
    </Card>
  );
}
