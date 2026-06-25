import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { CourseRow, ProgressRow } from "@/lib/courses";
import { COURSE_CATEGORIES } from "@/lib/courses";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Play, Plus, Check, Pencil, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LearnCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("All");

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as CourseRow[];
    },
    staleTime: 60_000,
  });

  const { data: progress } = useQuery({
    queryKey: ["course-progress", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_progress")
        .select("*")
        .eq("user_id", user!.id);
      return (data ?? []) as ProgressRow[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const filters = useMemo(() => {
    const cats = new Set<string>(COURSE_CATEGORIES);
    (courses ?? []).forEach((c) => c.category && cats.add(c.category));
    return ["All", ...Array.from(cats)];
  }, [courses]);

  const visible = useMemo(
    () => (courses ?? []).filter((c) => filter === "All" || c.category === filter),
    [courses, filter],
  );

  const progressFor = (courseId: string) => progress?.find((p) => p.course_id === courseId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Mini-Courses</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Bite-sized learning, shared by the team. No grades, no failing — just upskilling.
          </p>
        </div>
        <Button className="rounded-xl shrink-0" onClick={() => navigate("/learn/courses/new")}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create a course
        </Button>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map((t) => (
          <Badge
            key={t}
            onClick={() => setFilter(t)}
            variant={t === filter ? "default" : "outline"}
            className="cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition-all hover:scale-105"
          >
            {t}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 bg-card/60 border-border/30 animate-pulse">
              <div className="w-full h-32 rounded-xl bg-muted/20 mb-4" />
              <div className="h-4 w-3/4 bg-muted/20 rounded mb-2" />
              <div className="h-3 w-1/2 bg-muted/10 rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((course) => {
            const p = progressFor(course.id);
            const percent = p?.percent ?? 0;
            const done = !!p?.completed_at;
            const mine = course.author_id === user?.id;

            return (
              <Card
                key={course.id}
                onClick={() => navigate(`/learn/courses/${course.id}`)}
                className="overflow-hidden border-border/30 bg-card/60 backdrop-blur-sm shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
              >
                {/* Cover */}
                <div className="h-36 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 flex items-center justify-center relative overflow-hidden">
                  {course.cover_url ? (
                    <img src={course.cover_url} alt={course.title} className="w-full h-full object-contain" />
                  ) : (
                    <BookOpen className="w-10 h-10 text-teal-400/40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm">
                      {course.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {course.duration_minutes}m
                    </span>
                  </div>
                  {done && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-medium text-emerald-200 bg-emerald-600/80 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Done
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    {mine && (
                      <button
                        title="Edit your course"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/learn/courses/${course.id}/edit`);
                        }}
                        className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {course.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{course.description}</p>
                  )}
                  {!!course.tags?.length && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {course.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[10px] text-muted-foreground/80 bg-muted/20 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={done ? 100 : percent} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {done ? "100%" : `${percent}%`}
                    </span>
                  </div>
                  <button
                    className={cn(
                      "mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
                      done
                        ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        : "bg-primary/10 text-primary hover:bg-primary/20",
                    )}
                  >
                    {done ? <CheckCircle2 className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {done ? "Revisit" : percent > 0 ? "Continue" : "Start"} Learning
                  </button>
                </div>
              </Card>
            );
          })}

          {visible.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BookOpen className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">
                {filter === "All" ? "No courses yet — be the first to share one." : `No ${filter} courses yet.`}
              </p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/learn/courses/new")}>
                <Plus className="w-4 h-4 mr-1.5" /> Create a course
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
