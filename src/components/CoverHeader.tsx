import type { ReactNode } from "react";

import CoverNav from "./CoverNav";

interface CoverHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sits before the title, for a back button. */
  leading?: ReactNode;
  /** The "Unsaved changes" pill, when the page has one. */
  badge?: ReactNode;
  actions?: ReactNode;
  /**
   * Matches the page's own content column so the bar lines up with what is
   * under it. The bar itself always spans the full width.
   */
  width?: string;
}

/**
 * The bar the cover pages share, laid out like the one on `/resume`: it stays
 * under the app header while the page scrolls, with the title and actions on
 * one row and the nav strip beneath them, both starting at the left edge of
 * the content.
 */
function CoverHeader({
  title,
  subtitle,
  leading,
  badge,
  actions,
  width = "",
}: CoverHeaderProps) {
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-background-secondary/95 px-4 py-3 backdrop-blur">
      <div className={`flex flex-col gap-3 ${width}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {leading}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
            </div>
            {badge}
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>

        <CoverNav />
      </div>
    </div>
  );
}

export default CoverHeader;
