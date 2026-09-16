import type {
  CoverTemplate,
  InputKey,
  Letter,
  PromptHeader,
  PromptInput,
  Reference,
} from "../types/cover";

/** Mirrors `INPUT_KEYS` in `cover_letter/documents.py`. */
const INPUT_KEYS: InputKey[] = [
  "resume",
  "job_description",
  "template",
  "references",
  "request",
];

/** What each prompt section fills in, so the editor can say what it carries. */
export const INPUT_HINTS: Record<InputKey, string> = {
  resume: "resume.json, exactly as the Resume editor saves it",
  job_description: "the posting typed into the cover letter form",
  template: "the header and footer below, placeholders filled in",
  references: "every enabled entry from the References page",
  request: "the request note typed into the cover letter form",
};

export const EMPTY_PROMPT_HEADER: PromptHeader = {
  role: "",
  about: "",
  inputs_intro: "",
  inputs: [],
  instructions: [],
};

export const EMPTY_TEMPLATE: CoverTemplate = {
  name: "",
  filename: "",
  header: [],
  footer: [],
};

export const EMPTY_LETTER: Letter = {
  id: "",
  company: "",
  position: "",
  job_description: "",
  request_note: "",
  prompt: "",
  header: [],
  body: [],
  footer: [],
  filename: "",
  pdf_path: "",
  created_at: "",
  updated_at: "",
};

export function empty_reference(): Reference {
  return {
    // Only has to be unique in this list; the backend renumbers on save.
    id: `ref_${Date.now().toString(36)}`,
    title: "",
    content: "",
    enabled: true,
  };
}

export function move_by<T>(items: T[], index: number, offset: number): T[] {
  const target = index + offset;

  if (target < 0 || target >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];

  return next;
}

export function replace_at<T>(items: T[], index: number, item: T): T[] {
  return items.map((existing, i) => (i === index ? item : existing));
}

export function remove_at<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** The instruction block the backend renders, previewed without a round trip. */
export function render_prompt_header(header: PromptHeader): string {
  const lines = [header.role, header.about].filter(Boolean);
  const sections = header.inputs.filter((entry) => entry.enabled);

  if (sections.length > 0) {
    if (header.inputs_intro) {
      lines.push(header.inputs_intro);
    }

    sections.forEach((entry, index) => {
      const label = entry.label || entry.key;

      lines.push(
        entry.description
          ? `${index + 1}. ${label}: ${entry.description}`
          : `${index + 1}. ${label}`,
      );
    });
  }

  const intro = lines.join("\n");
  const instructions = header.instructions.filter(Boolean).join(" ");

  if (!instructions) return intro;

  return intro ? `${intro}\n\n${instructions}` : instructions;
}

/** A missing section can still be added back, so the editor offers it. */
export function missing_inputs(inputs: PromptInput[]): InputKey[] {
  const present = new Set(inputs.map((entry) => entry.key));

  return INPUT_KEYS.filter((key) => !present.has(key));
}

export function letter_title(letter: { company: string; position: string }) {
  return letter.company || "Untitled letter";
}

/** An ISO timestamp as something short enough for a list row. */
export function format_time(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
