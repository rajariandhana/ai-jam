import { FileText, LayoutDashboard, PenLine, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import Logo from "./Logo";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/cover", label: "Cover Letter", icon: PenLine },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Layout() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <NavLink to="/" aria-label="Dashboard">
            <Logo className="size-8" />
          </NavLink>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-accent-soft text-accent-soft-foreground font-medium"
                      : "text-muted hover:bg-surface-secondary"
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
