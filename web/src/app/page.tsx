import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-4 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        Phase 1 · Instructor app
      </span>
      <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
        PhaseForge
      </h1>
      <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
        Turn your course materials into professor-aligned, adaptive exam
        questions — each student gets a unique variant, graded on mastery, not
        just a score.
      </p>
      <div className="mt-10 flex gap-3">
        <Button size="lg" render={<Link href="/login" />}>
          Log in
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/signup" />}>
          Sign up
        </Button>
      </div>
      <p className="mt-16 text-xs text-muted-foreground">
        Scaffold ready — auth, courses, and material upload coming next.
      </p>
    </main>
  );
}
