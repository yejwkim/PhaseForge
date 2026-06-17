"use server";

import { createClient } from "@/lib/supabase/server";

export type CreateAssessmentInput = {
  courseId: string;
  title: string;
  topicIds: string[];
  questions: number;
  difficulty: { easy: number; medium: number; hard: number };
  opensAt: string | null;
  closesAt: string | null;
  instructions: string;
};

export type CreateAssessmentResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

// Unambiguous alphabet (no 0/O/1/I/L) for codes students type by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `PF-${s}`;
}

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<CreateAssessmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!input.courseId) return { ok: false, error: "Pick a course." };

  const title = input.title.trim() || "Untitled assessment";

  // Resolve topic names so the desktop app can show them on the consent screen.
  let topicNames: string[] = [];
  if (input.topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("categories")
      .select("name")
      .in("id", input.topicIds);
    topicNames = ((topics ?? []) as { name: string }[]).map((t) => t.name);
  }

  const config = {
    questions: input.questions,
    minutes: 60,
    topics: topicNames,
    topicIds: input.topicIds,
    difficulty: input.difficulty,
    instructions: input.instructions.trim(),
  };

  // Generate a unique code; retry on the rare unique-collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from("assessments").insert({
      course_id: input.courseId,
      title,
      code,
      status: "open",
      window_open: input.opensAt || null,
      window_close: input.closesAt || null,
      config_json: config,
    });
    if (!error) return { ok: true, code };
    if (error.code !== "23505") {
      console.error("createAssessment failed:", error);
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Could not generate a unique code. Try again." };
}
