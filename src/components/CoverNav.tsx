import { FilePlus2, Library, PenLine, ScrollText } from "lucide-react";
import { NavLink } from "react-router";

const COVER_TABS = [
  { to: "/cover", label: "New letter", icon: FilePlus2, end: true },
  { to: "/cover/builder", label: "Builder", icon: PenLine, end: false },
  {
    to: "/cover/prompt-header",
    label: "Prompt header",
    icon: ScrollText,
    end: false,
  },
  { to: "/cover/references", label: "References", icon: Library, end: false },
];

/** The strip tying the four cover letter pages together. */
function CoverNav() {
  return (
    <div className="flex flex-wrap gap-1">
      {COVER_TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted hover:bg-surface-secondary"
            }`
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

export default CoverNav;
