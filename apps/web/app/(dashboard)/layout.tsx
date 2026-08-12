"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiGet, apiPost, type AuthUserWithCompany } from "@/lib/api-client";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUserWithCompany | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const me = await apiGet<AuthUserWithCompany>("/auth/me");

        if (!cancelled) {
          setUser(me);
        }
      } catch {
        if (!cancelled) {
          router.push("/login");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout(): Promise<void> {
    try {
      await apiPost<{ message: string }>("/auth/logout", {});
    } finally {
      router.push("/login");
    }
  }

  const isProjectsActive = pathname === "/projects" || pathname.startsWith("/projects/");
  const isTasksActive = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const isSettingsActive = pathname === "/settings/company";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-6">
            <Link
              href="/projects"
              className={`text-sm font-medium ${isProjectsActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            >
              Projects
            </Link>
            <Link
              href="/tasks"
              className={`text-sm font-medium ${isTasksActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            >
              Tasks
            </Link>
            <Link
              href="/settings/company"
              className={`text-sm font-medium ${isSettingsActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            >
              Settings
            </Link>
          </nav>
          {user != null && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {user.name} · {user.role}
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
