import { InputGroup, Label, TextArea } from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { MarkupToolbar } from "./MarkupToolbar";
import { useMarkup } from "./use-markup";

interface MarkupEditorProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  aria_label: string;
  className?: string;
}

/**
 * A labelled text field whose selection can be wrapped in the inline markup the
 * LaTeX builder understands: **bold**, *italic* and __underline__.
 */
export function MarkupEditor({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  aria_label,
  className,
}: MarkupEditorProps) {
  const [is_focused, set_is_focused] = useState(false);

  const { container, apply, on_key_down } = useMarkup(value, onChange);

  const shared = {
    value,
    placeholder,
    onChange: (event: { target: { value: string } }) =>
      onChange(event.target.value),
    onKeyDown: on_key_down,
    onFocus: () => set_is_focused(true),
    onBlur: () => set_is_focused(false),
    "aria-label": aria_label,
  };

  return (
    <div ref={container} className={`flex flex-col ${className ?? ""}`}>
      <div className="flex h-7 items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted">{label}</Label>
        {is_focused && <MarkupToolbar apply={apply} />}
      </div>

      {multiline ? (
        <TextArea {...shared} variant="secondary" rows={rows} />
      ) : (
        // A group rather than a bare input, so the copy button sits inside the
        // field's right edge instead of stealing width from it.
        <InputGroup variant="secondary">
          <InputGroup.Input {...shared} type="text" />
          <InputGroup.Suffix>
            <CopyButton value={value} label={aria_label} />
          </InputGroup.Suffix>
        </InputGroup>
      )}
    </div>
  );
}
