import { Button } from "@heroui/react";
import { ChevronDown, ChevronRight, ChevronUp, EyeOff, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface ItemCardProps {
  title: string;
  subtitle?: string;
  index: number;
  total: number;
  onMove: (offset: number) => void;
  onRemove: () => void;
  /** False when the Layout tab is keeping this entry out of the PDF. */
  included?: boolean;
  children: ReactNode;
}

/** One entry in an editable list: collapsible body, reorder and delete controls. */
export function ItemCard({
  title,
  subtitle,
  index,
  total,
  onMove,
  onRemove,
  included = true,
  children,
}: ItemCardProps) {
  const [is_open, set_is_open] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 overflow-hidden text-left"
          onClick={() => set_is_open(!is_open)}
        >
          {is_open ? (
            <ChevronDown className="size-4 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted" />
          )}
          <span
            className={`truncate text-sm font-medium ${included ? "" : "text-muted line-through"}`}
          >
            {title || "Untitled"}
          </span>

          {!included && (
            <span
              title="Excluded from the PDF in the Layout tab"
              className="flex shrink-0 items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted"
            >
              <EyeOff className="size-3" />
              Excluded
            </span>
          )}
          {subtitle && (
            <span className="truncate text-xs text-muted">{subtitle}</span>
          )}
        </button>

        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Move up"
          isDisabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Move down"
          isDisabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Remove"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {is_open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {children}
        </div>
      )}
    </div>
  );
}
