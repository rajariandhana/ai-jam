import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";

import type { MarkupKind } from "../../lib/markup";
import { MARKERS, SHORTCUTS, toggle_markup } from "../../lib/markup";

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * Wire B/I/U toggling onto the field matched by `selector` inside the returned
 * container ref. HeroUI owns the input elements, so they are located by query
 * rather than by a forwarded ref. A null selector disables the toolbar.
 */
export function useMarkup(
  value: string,
  onChange: (value: string) => void,
  selector: string | null = "input, textarea",
) {
  const container = useRef<HTMLDivElement>(null);
  const pending_selection = useRef<[number, number] | null>(null);

  // Restore the caret only once React has committed the rewritten value.
  useEffect(() => {
    const selection = pending_selection.current;

    if (!selection || !selector) return;

    pending_selection.current = null;

    const field = container.current?.querySelector<Field>(selector);

    if (!field) return;

    field.focus();
    field.setSelectionRange(selection[0], selection[1]);
  }, [value, selector]);

  const apply = (kind: MarkupKind) => {
    if (!selector) return;

    const field = container.current?.querySelector<Field>(selector);

    if (!field) return;

    const result = toggle_markup(
      value,
      field.selectionStart ?? value.length,
      field.selectionEnd ?? value.length,
      MARKERS[kind],
    );

    pending_selection.current = [result.start, result.end];
    onChange(result.value);
  };

  const on_key_down = (event: KeyboardEvent<Field>) => {
    if (!event.metaKey && !event.ctrlKey) return;

    const kind = SHORTCUTS[event.key.toLowerCase()];

    if (!kind) return;

    event.preventDefault();
    apply(kind);
  };

  return { container, apply, on_key_down };
}
