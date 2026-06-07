import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
} from "lucide-react";

import { logout } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: true },
  { label: "Courses", href: "#", icon: BookOpen },
  { label: "Source Materials", href: "#", icon: FileText },
  { label: "Assessments", href: "#", icon: ClipboardList },
  { label: "Analytics", href: "#", icon: BarChart3 },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Professor";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white px-4 py-5">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gray-900 font-[family-name:var(--font-cormorant)] text-lg text-white">
            P
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">PhaseForge</div>
            <div className="text-[0.7rem] text-gray-400">Academic Assessment</div>
          </div>
        </Link>

        <button className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">
          <Plus className="size-4" />
          New Assessment
        </button>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                item.active
                  ? "bg-gray-100 font-medium text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-gray-100 pt-3">
          <Link
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <HelpCircle className="size-[18px]" />
            Help Center
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut className="size-[18px]" />
              Log Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-8">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search or type a command..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-gray-300 focus:bg-white"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100">
              <Bell className="size-5" />
            </button>
            <button className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100">
              <Settings className="size-5" />
            </button>
            <div className="flex size-9 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
