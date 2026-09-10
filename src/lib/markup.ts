export const MARKERS = {
  bold: "**",
  italic: "*",
  underline: "__",
} as const;

export type MarkupKind = keyof typeof MARKERS;
export type Marker = (typeof MARKERS)[MarkupKind];

export interface MarkupResult {
  value: string;
  start: number;
  end: number;
}

/** A lone asterisk must never be read as half of a bold marker. */
function starts_with_marker(text: string, marker: Marker) {
  if (!text.startsWith(marker)) return false;

  return !(marker === "*" && text.startsWith("**"));
}

function ends_with_marker(text: string, marker: Marker) {
  if (!text.endsWith(marker)) return false;

  return !(marker === "*" && text.endsWith("**"));
}

/**
 * Wrap the selected range in `marker`, or strip the marker when the selection
 * already carries it. An empty selection leaves the caret between the markers.
 */
export function toggle_markup(
  value: string,
  start: number,
  end: number,
  marker: Marker,
): MarkupResult {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  const is_wrapped_inside =
    selected.length >= marker.length * 2 &&
    starts_with_marker(selected, marker) &&
    ends_with_marker(selected, marker);

  if (is_wrapped_inside) {
    const inner = selected.slice(marker.length, -marker.length);

    return { value: before + inner + after, start, end: start + inner.length };
  }

  if (ends_with_marker(before, marker) && starts_with_marker(after, marker)) {
    return {
      value:
        before.slice(0, -marker.length) + selected + after.slice(marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }

  return {
    value: before + marker + selected + marker + after,
    start: start + marker.length,
    end: end + marker.length,
  };
}

export const SHORTCUTS: Record<string, MarkupKind> = {
  b: "bold",
  i: "italic",
  u: "underline",
};
