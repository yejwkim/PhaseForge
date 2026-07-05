"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

// Live pool summary. If the assessment has no questions yet, it polls (generation
// runs in the background) and shows "Currently generating…" until they land.
export function PoolSummary({
  assessmentId,
  initialCount,
  initialApproved,
}: {
  assessmentId: string;
  initialCount: number;
  initialApproved: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [approved, setApproved] = useState(initialApproved);
  const [generating, setGenerating] = useState(initialCount === 0);

  useEffect(() => {
    if (initialCount > 0) return; // already populated — no need to poll
    let active = true;
    let last = 0;
    let stable = 0;
    const start = Date.now();
    const supabase = createClient();

    const tick = async () => {
      if (!active) return;
      const { data } = await supabase
        .from("questions")
        .select("professor_review_status")
        .eq("assessment_id", assessmentId);
      if (!active) return;

      const total = data?.length ?? 0;
      setCount(total);
      setApproved(
        data?.filter((q) => q.professor_review_status === "approved").length ?? 0,
      );
      if (total > 0) setGenerating(false);

      stable = total === last ? stable + 1 : 0;
      last = total;

      const timedOut = Date.now() - start > 180_000; // 3-min safety cap
      if ((total > 0 && stable >= 2) || timedOut) {
        setGenerating(false);
        return; // settled
      }
      setTimeout(tick, 3000);
    };

    const id = setTimeout(tick, 1500);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [assessmentId, initialCount]);

  if (generating) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#c4c7c8]">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        Currently generating…
      </p>
    );
  }

  return (
    <p className="text-sm text-[#c4c7c8]">
      {count} question{count === 1 ? "" : "s"} · {approved} approved
    </p>
  );
}
