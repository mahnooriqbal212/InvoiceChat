import { Outlet, NavLink, Link } from "react-router-dom";
import { Bot, LayoutDashboard, MessageSquarePlus } from "lucide-react";
import Brand from "@/components/layout/Brand";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";

const NAV = [
  { to: "/", label: "New invoice", icon: MessageSquarePlus, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agent", label: "Agent queue", icon: Bot },
];

function Logo() {
  return (
    <Link to="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Brand />
    </Link>
  );
}

export default function AppLayout() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Soft emerald + rose glow behind the top of every page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(40%_80%_at_25%_0%,var(--highlight),transparent),radial-gradient(40%_80%_at_75%_0%,var(--primary),transparent)] opacity-25 dark:opacity-20"
      />

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
          <Logo />
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {/* On phones only the icon shows, so the header fits */}
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <Outlet />
      </main>
    </div>
  );
}
