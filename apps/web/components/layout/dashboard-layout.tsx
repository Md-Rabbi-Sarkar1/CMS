"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { User } from "@/lib/types";
import { RoleBadge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: Parameters<typeof can>[0];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◆" },
  { href: "/projects", label: "Projects", icon: "▤", permission: "createProject" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/reports", label: "Daily Reports", icon: "✎" },
  { href: "/materials", label: "Materials", icon: "⚖", permission: "manageMaterial" },
  { href: "/expenses", label: "Expenses", icon: "$" },
  { href: "/issues", label: "Issues", icon: "!" },
  { href: "/documents", label: "Documents", icon: "▦" },
  { href: "/notifications", label: "Notifications", icon: "◔" },
  { href: "/settings/company", label: "Company", icon: "⚙", permission: "manageCompany" },
  { href: "/settings/users", label: "Users", icon: "☺", permission: "manageUsers" },
];

export function DashboardLayout({ user, children }: { user: User; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout()
      .then(() => {
        router.replace("/login");
      })
      .catch(() => {
        router.replace("/login");
      });
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission, user.role));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-100 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          <Link href="/dashboard" className="text-lg font-semibold text-white">
            Construction Ops
          </Link>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {visibleItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { setSidebarOpen(false); }}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="w-5 text-center text-xs">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => { setSidebarOpen(false); }} aria-hidden />
      ) : null}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <button
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => { setSidebarOpen(true); }}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <div className="flex justify-end">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
