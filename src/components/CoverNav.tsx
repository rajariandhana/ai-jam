import { FilePlus2, Library, PenLine, ScrollText } from "lucide-react";
import type { ReactNode } from "react";

import { type CoverTab, useCoverTabs } from "../lib/cover_tabs";

const COVER_TABS: { key: CoverTab; label: string; icon: typeof PenLine }[] = [
  { key: "new", label: "New letter", icon: FilePlus2 },
  { key: "builder", label: "Builder", icon: PenLine },
  { key: "prompt-header", label: "Prompt header", icon: ScrollText },
  { key: "references", label: "References", icon: Library },
];

interface CoverNavProps {
  /** Sits before the tabs, for a back button. */
  leading?: ReactNode;
  /** The "Unsaved changes" pill, when the page has one. */
  badge?: ReactNode;
  actions?: ReactNode;
}

/**
 * The bar tying the four cover letter tabs together. It stays under the app
 * header while the page scrolls, with the tabs on the left and the page's own
 * actions on the right. The highlighted tab names the page, so there is no
 * title. A fixed height (py-2 plus a 40px row) keeps it from jumping between
 * tabs; pages that pin things under it clear it with --cover-bar (3.5rem).
 */
function CoverNav({ leading, badge, actions }: CoverNavProps) {
  const { tab, set_tab } = useCoverTabs();

  return (
    <div className="sticky top-14 z-20 -mx-4 h-14 border-b border-border bg-background-secondary/95 px-4 py-2 backdrop-blur">
      <div className="flex h-10 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          {leading}
          <div className="flex gap-1 overflow-x-auto">
            {COVER_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => set_tab(key)}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === key
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted hover:bg-surface-secondary"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {(badge || actions) && (
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default CoverNav;
