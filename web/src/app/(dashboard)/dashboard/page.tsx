import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Eye,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

const activeAssessments = [
  {
    code: "PHYS-201",
    status: "LIVE",
    live: true,
    title: "Midterm: Thermodynamics",
    students: 142,
    mastery: "0.78",
    remaining: "24m",
    progress: 62,
  },
  {
    code: "CS-105",
    status: "45m left",
    live: false,
    title: "Quiz: Data Structures",
    students: 89,
    mastery: "0.62",
    remaining: "45m",
    progress: 28,
  },
];

const recentActivity = [
  {
    icon: AlertTriangle,
    tint: "text-amber-500 bg-amber-50",
    title: "Concept Gap Flagged",
    time: "12m ago",
    body: "AI flagged 15 students with a concept gap in Thermodynamics, Chapter 3. Difficulty adjustment recommended.",
  },
  {
    icon: Sparkles,
    tint: "text-violet-500 bg-violet-50",
    title: "New Item Family Generated",
    time: "1h ago",
    body: "A new item family was generated for Chapter 4: Fluid Dynamics. 24 new questions are awaiting review.",
  },
  {
    icon: CheckCircle2,
    tint: "text-emerald-500 bg-emerald-50",
    title: "Assessment Finalized",
    time: "3h ago",
    body: "Linear Algebra Quiz #2 grading is complete. Average score: 84.2.",
  },
];

const masteryOverview = [
  { label: "Conceptual Accuracy", value: "94.2%" },
  { label: "AI Item Validity", value: "98.1%" },
  { label: "Total Generated", value: "15,402" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Professor";
  const lastName = name.split(" ").slice(-1)[0];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Good morning, Professor {lastName}.
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            3 assessments are in progress, and the AI is generating new
            questions.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-50">
            <Upload className="size-4" />
            Upload Lecture Notes
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-50">
            <Eye className="size-4" />
            View Conceptual Gaps
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="flex flex-col gap-8">
          {/* Active Assessments */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active Assessments</h2>
              <button className="text-sm font-medium text-gray-500 hover:text-gray-900">
                View all
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {activeAssessments.map((a) => (
                <div
                  key={a.code}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {a.code}
                    </span>
                    <span
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        a.live ? "text-red-500" : "text-gray-400"
                      }`}
                    >
                      {a.live && (
                        <span className="size-1.5 rounded-full bg-red-500" />
                      )}
                      {a.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{a.title}</h3>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Students" value={String(a.students)} />
                    <Stat label="Mastery θ" value={a.mastery} />
                    <Stat label="Remaining" value={a.remaining} />
                  </div>
                  <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{ width: `${a.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
            <div className="flex flex-col gap-3">
              {recentActivity.map((r) => (
                <div
                  key={r.title}
                  className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${r.tint}`}
                  >
                    <r.icon className="size-[18px]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{r.title}</h3>
                      <span className="text-xs text-gray-400">{r.time}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Item Pipeline (dark) */}
          <div className="rounded-xl bg-gray-900 p-5 text-white">
            <div className="mb-5 flex items-center gap-2">
              <Zap className="size-5" />
              <h2 className="text-base font-semibold">Item Pipeline</h2>
            </div>

            <PipelineRow label="Source Material RAG" value="Processing..." progress={70} />
            <PipelineRow label="Family Generation" value="Idle" progress={0} />
            <div className="mb-1 mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-300">Pre-generation Buffer</span>
              <span className="font-medium">85% Full</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white" style={{ width: "85%" }} />
            </div>
            <p className="mt-2 text-[0.7rem] uppercase tracking-wide text-gray-400">
              Estimated 1,240 items ready in cache
            </p>

            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/10">
                <Cpu className="size-[18px]" />
              </div>
              <div className="leading-tight">
                <div className="text-[0.7rem] text-gray-400">System Health</div>
                <div className="text-sm font-medium">Optimal Performance</div>
              </div>
            </div>
          </div>

          {/* Mastery Overview */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Mastery Overview
            </h2>
            <div className="flex flex-col gap-3">
              {masteryOverview.map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{m.label}</span>
                  <span className="text-sm font-semibold">{m.value}</span>
                </div>
              ))}
            </div>
            <button className="mt-5 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium transition hover:bg-gray-50">
              Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.7rem] text-gray-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

function PipelineRow({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/70"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
