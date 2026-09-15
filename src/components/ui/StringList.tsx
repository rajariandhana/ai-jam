import { Button, InputGroup, Label, TextArea } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "./CopyButton";
import { MarkupToolbar } from "./MarkupToolbar";
import { useMarkup } from "./use-markup";

interface StringListProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Bullet points need room to breathe; tags fit on one line. */
  multiline?: boolean;
  add_label?: string;
}

/**
 * An editable list of strings sharing one markup toolbar, which acts on
 * whichever row currently holds focus.
 */
export function StringList({
  label,
  values,
  onChange,
  placeholder,
  multiline = false,
  add_label = "Add",
}: StringListProps) {
  const [focused, set_focused] = useState<number | null>(null);

  const update = (index: number, value: string) =>
    onChange(values.map((existing, i) => (i === index ? value : existing)));

  const remove = (index: number) =>
    onChange(values.filter((_, i) => i !== index));

  const { container, apply, on_key_down } = useMarkup(
    focused === null ? "" : (values[focused] ?? ""),
    (value) => focused !== null && update(focused, value),
    focused === null
      ? null
      : `[data-row="${focused}"] input, [data-row="${focused}"] textarea`,
  );

  return (
    <div ref={container} className="flex flex-col gap-1">
      <div className="flex h-7 items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted">{label}</Label>
        {focused !== null && <MarkupToolbar apply={apply} />}
      </div>

      {values.length === 0 && (
        <p className="text-xs italic text-muted">Nothing here yet.</p>
      )}

      {values.map((value, index) => {
        const shared = {
          value,
          placeholder,
          onChange: (event: { target: { value: string } }) =>
            update(index, event.target.value),
          onKeyDown: on_key_down,
          onFocus: () => set_focused(index),
          onBlur: () => set_focused(null),
          "aria-label": `${label} ${index + 1}`,
        };

        return (
          <div
            key={index}
            data-row={index}
            className="flex items-start gap-1.5"
          >
            {multiline ? (
              <TextArea
                {...shared}
                variant="secondary"
                className="flex-1"
                rows={3}
              />
            ) : (
              <InputGroup variant="secondary" className="flex-1">
                <InputGroup.Input {...shared} type="text" />
                <InputGroup.Suffix>
                  <CopyButton value={value} label={`${label} ${index + 1}`} />
                </InputGroup.Suffix>
              </InputGroup>
            )}

            <button
              type="button"
              aria-label={`Remove ${label} ${index + 1}`}
              onClick={() => remove(index)}
              className="mt-1.5 rounded p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 self-start"
        onClick={() => onChange([...values, ""])}
      >
        <Plus className="size-4" />
        {add_label}
      </Button>
    </div>
  );
}
