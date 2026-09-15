import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  /** The text placed on the clipboard; an empty value disables the button. */
  value: string;
  label: string;
}

/** Copy through a throwaway textarea, for browsers that refuse the clipboard API.
 *
 * The async API needs a secure context and a granted permission, neither of
 * which holds when the app is opened over plain http from another machine.
 */
function copy_by_selection(value: string) {
  const focused = document.activeElement;
  const scratch = document.createElement("textarea");

  scratch.value = value;
  scratch.setAttribute("readonly", "");
  scratch.className = "pointer-events-none fixed top-0 left-0 opacity-0";

  document.body.append(scratch);
  scratch.select();

  const copied = document.execCommand("copy");

  scratch.remove();

  // Selecting the scratch field took focus off whatever the user was editing.
  if (focused instanceof HTMLElement) focused.focus();

  return copied;
}

/** Copies a field's text, confirming with a tick that fades back to the icon. */
export function CopyButton({ value, label }: CopyButtonProps) {
  const [is_copied, set_is_copied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The tick is on a timer, so drop it if the field unmounts first.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (event: { stopPropagation: () => void }) => {
    // Fields wrapped in an InputGroup focus themselves on any click inside.
    event.stopPropagation();

    let copied: boolean;

    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      copied = copy_by_selection(value);
    }

    if (!copied) return;

    set_is_copied(true);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set_is_copied(false), 1200);
  };

  const title = is_copied ? "Copied" : `Copy ${label}`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={value === ""}
      // Keep the caret where it is instead of stealing focus from the field.
      onMouseDown={(event) => event.preventDefault()}
      onClick={copy}
      className="rounded p-1 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {is_copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
