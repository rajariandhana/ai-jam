import type { ReactNode } from "react";

import { MarkupEditor } from "./MarkupEditor";

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  className,
}: FieldProps) {
  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <MarkupEditor
        label={label}
        aria_label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      {hint && <span className="mt-1 text-xs text-muted">{hint}</span>}
    </div>
  );
}

interface LongFieldProps extends Omit<FieldProps, "hint"> {
  rows?: number;
}

export function LongField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: LongFieldProps) {
  return (
    <MarkupEditor
      label={label}
      aria_label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      multiline
      rows={rows}
      className={className}
    />
  );
}
