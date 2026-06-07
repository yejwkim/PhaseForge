import Link from "next/link";

import { CosmicBackground } from "@/components/landing/cosmic-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      <CosmicBackground className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.75)_70%,#000_100%)]" />
      <Link
        href="/"
        className="relative z-10 mb-8 font-[family-name:var(--font-cormorant)] text-3xl tracking-wide"
      >
        PhaseForge
      </Link>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
