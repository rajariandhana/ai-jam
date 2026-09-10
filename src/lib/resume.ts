import type {
  Education,
  Experience,
  Includable,
  Project,
  Resume,
  SectionConfig,
  SectionKey,
  Skill,
} from "../types/resume";

/** Section order used when resume.json has nothing to say about it. */
export const SECTION_KEYS: SectionKey[] = [
  "summary",
  "education",
  "projects",
  "experience",
  "skills",
];

export function default_sections(): SectionConfig[] {
  return SECTION_KEYS.map((key) => ({ key, enabled: true }));
}

/** Drop unknown sections and append known ones the config never mentions.
 *
 * Mirrors `resolve_sections` in resume_builder.py so that what the editor
 * shows always matches what the LaTeX renders.
 */
export function normalise_sections(
  sections: SectionConfig[] | undefined,
): SectionConfig[] {
  const known = (sections ?? []).filter(
    (entry, index, all) =>
      SECTION_KEYS.includes(entry?.key) &&
      all.findIndex((other) => other.key === entry.key) === index,
  );

  const missing = SECTION_KEYS.filter(
    (key) => !known.some((entry) => entry.key === key),
  );

  return [
    ...known.map(({ key, enabled }) => ({ key, enabled: enabled !== false })),
    ...missing.map((key) => ({ key, enabled: true })),
  ];
}

export const EMPTY_RESUME: Resume = {
  profile: { name: "", website: "", email: "", linkedin: "", github: "" },
  summary: "",
  education: [],
  projects: [],
  experience: [],
  skills: [],
  sections: default_sections(),
};

export function empty_education(): Education {
  return {
    university: "",
    location: "",
    degree: "",
    gpa: "",
    date: "",
    coursework: [],
  };
}

export function empty_project(): Project {
  return { name: "", slug: "", stack: [], date: "", description: [""] };
}

export function empty_experience(): Experience {
  return { company: "", position: "", date: "", location: "", description: [""] };
}

export function empty_skill(): Skill {
  return { category: "", description: "" };
}

/** Replace the item at `index`, leaving the rest of the list untouched. */
/** Sections whose entries can be included or excluded one by one. */
export const LIST_SECTION_KEYS = [
  "education",
  "projects",
  "experience",
  "skills",
] as const;

export type ListSectionKey = (typeof LIST_SECTION_KEYS)[number];

export function is_list_section(key: SectionKey): key is ListSectionKey {
  return (LIST_SECTION_KEYS as readonly string[]).includes(key);
}

/** An entry counts unless it opts out, so older resume.json files still render. */
export function is_included(item: Includable) {
  return item.enabled !== false;
}

export function included_count(items: Includable[]) {
  return items.filter(is_included).length;
}

/** Write the flag explicitly only when excluding, to keep resume.json tidy. */
export function set_included<T extends Includable>(item: T, included: boolean) {
  const next = { ...item };

  if (included) {
    delete next.enabled;
  } else {
    next.enabled = false;
  }

  return next;
}

/** The one-line name shown for an entry in the Layout list. */
export function item_label(key: ListSectionKey, item: unknown) {
  const entry = item as Record<string, string>;

  const label = {
    education: entry.university,
    projects: entry.name,
    experience: entry.position,
    skills: entry.category,
  }[key];

  return label?.trim() || "Untitled";
}

export function item_hint(key: ListSectionKey, item: unknown) {
  const entry = item as Record<string, string>;

  const hint = {
    education: entry.degree,
    projects: entry.date,
    experience: entry.company,
    skills: entry.description,
  }[key];

  return hint?.trim() ?? "";
}

/** A fingerprint of what the layout includes, for spotting manual edits. */
export function layout_signature(resume: Resume) {
  const sections = resume.sections
    .map((entry) => `${entry.key}:${entry.enabled ? 1 : 0}`)
    .join(",");

  const items = LIST_SECTION_KEYS.map(
    (key) => `${key}:${resume[key].map((item) => (is_included(item) ? 1 : 0)).join("")}`,
  ).join(",");

  return `${sections}|${items}`;
}

/** True when nothing is being held back, which is what the ALL chip means. */
export function is_full_layout(resume: Resume) {
  return (
    resume.sections.every((entry) => entry.enabled) &&
    LIST_SECTION_KEYS.every((key) => resume[key].every(is_included))
  );
}

export function replace_at<T>(items: T[], index: number, item: T): T[] {
  return items.map((existing, i) => (i === index ? item : existing));
}

export function remove_at<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** Move an item by `offset` positions, clamped to the bounds of the list. */
export function move_by<T>(items: T[], index: number, offset: number): T[] {
  const target = index + offset;

  if (target < 0 || target >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];

  return next;
}

/** The default Build PDF name, without the extension.
 *
 * Mirrors `build_filename` in resume_builder.py so the field starts out
 * showing exactly what the backend would have chosen on its own.
 */
export function build_stem(name: string, preset_suffix: string) {
  const today = new Date();
  const stamp = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("_");

  const stem = `resume_${name.trim() || "resume"}_${stamp}`;

  return preset_suffix ? `${stem}_${preset_suffix}` : stem;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function format_bytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function format_date(epoch_seconds: number) {
  return new Date(epoch_seconds * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
