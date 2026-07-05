import {
  QuestionPoolBrowser,
  type PoolCourse,
} from "@/components/dashboard/question-pool-browser";
import { type PoolQuestion } from "@/components/dashboard/question-review-card";
import { createClient } from "@/lib/supabase/server";

type QuestionRow = PoolQuestion & {
  course_id: string;
  category_id: string | null;
  assessment_id: string | null;
};
type CategoryRow = { id: string; name: string; course_id: string };
type CourseRow = { id: string; title: string };
type AssessmentRow = { id: string; title: string; code: string; status: string; course_id: string };

export default async function QuestionPoolsPage() {
  const supabase = await createClient();
  const [
    { data: courseData },
    { data: assessmentData },
    { data: categoryData },
    { data: questionData },
  ] = await Promise.all([
    supabase.from("courses").select("id, title").order("created_at", { ascending: false }),
    supabase
      .from("assessments")
      .select("id, title, code, status, course_id")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name, course_id"),
    supabase
      .from("questions")
      .select(
        "id, type, topic, difficulty, prompt, options, answer, explanation, rubric, figure_svg, professor_review_status, course_id, category_id, assessment_id",
      )
      .order("created_at", { ascending: true }),
  ]);

  const categories = (categoryData ?? []) as CategoryRow[];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  // questions grouped by assessment, then by category
  const byAssessmentCategory = new Map<string, Map<string, PoolQuestion[]>>();
  for (const q of (questionData ?? []) as QuestionRow[]) {
    if (!q.assessment_id || !q.category_id) continue;
    const cats = byAssessmentCategory.get(q.assessment_id) ?? new Map<string, PoolQuestion[]>();
    const list = cats.get(q.category_id) ?? [];
    list.push(q);
    cats.set(q.category_id, list);
    byAssessmentCategory.set(q.assessment_id, cats);
  }

  const assessmentsByCourse = new Map<string, AssessmentRow[]>();
  for (const a of (assessmentData ?? []) as AssessmentRow[]) {
    const list = assessmentsByCourse.get(a.course_id) ?? [];
    list.push(a);
    assessmentsByCourse.set(a.course_id, list);
  }

  const allTopicsByCourse = new Map<string, { id: string; name: string }[]>();
  for (const c of categories) {
    const list = allTopicsByCourse.get(c.course_id) ?? [];
    list.push({ id: c.id, name: c.name });
    allTopicsByCourse.set(c.course_id, list);
  }

  const courses: PoolCourse[] = ((courseData ?? []) as CourseRow[])
    .map((course) => ({
      id: course.id,
      title: course.title,
      allTopics: allTopicsByCourse.get(course.id) ?? [],
      assessments: (assessmentsByCourse.get(course.id) ?? [])
        .map((a) => {
          const cats = byAssessmentCategory.get(a.id) ?? new Map<string, PoolQuestion[]>();
          const topics = [...cats.entries()].map(([catId, questions]) => ({
            id: catId,
            name: categoryName.get(catId) ?? "Topic",
            questions,
          }));
          return { id: a.id, title: a.title, code: a.code, status: a.status, topics };
        })
        .filter((a) => a.topics.length > 0),
    }))
    .filter((course) => course.assessments.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-[32px] leading-tight tracking-tight">
          Question Pools
        </h1>
        <p className="mt-2 text-[#c4c7c8]">
          Browse by course and assessment. Review and approve generated questions
          — approved ones are eligible for exams.
        </p>
      </div>

      <QuestionPoolBrowser courses={courses} />
    </div>
  );
}
