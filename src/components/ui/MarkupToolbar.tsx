import { Bold, Italic, Underline } from "lucide-react";

import type { MarkupKind } from "../../lib/markup";

const TOOLS: { kind: MarkupKind; icon: typeof Bold; title: string }[] = [
  { kind: "bold", icon: Bold, title: "Bold (Cmd+B)" },
  { kind: "italic", icon: Italic, title: "Italic (Cmd+I)" },
  { kind: "underline", icon: Underline, title: "Underline (Cmd+U)" },
];

export function MarkupToolbar({
  apply,
}: {
  apply: (kind: MarkupKind) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map(({ kind, icon: Icon, title }) => (
        <button
          key={kind}
          type="button"
          title={title}
          aria-label={title}
          // Keep the caret where it is instead of losing focus on click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply(kind)}
          className="rounded p-1 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
