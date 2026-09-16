/** The sections the prompt can carry, in the order the header numbers them. */
export type InputKey =
  | "resume"
  | "job_description"
  | "template"
  | "references"
  | "request";

export interface PromptInput {
  key: InputKey;
  label: string;
  description: string;
  enabled: boolean;
}

export interface PromptHeader {
  role: string;
  about: string;
  inputs_intro: string;
  inputs: PromptInput[];
  instructions: string[];
}

/** Header and footer paragraphs, still holding their {PLACEHOLDER}s. */
export interface CoverTemplate {
  name: string;
  filename: string;
  header: string[];
  footer: string[];
}

export interface Reference {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface References {
  references: Reference[];
}

/** One saved letter: the job it answers and the three blocks of its text. */
export interface Letter {
  id: string;
  company: string;
  position: string;
  job_description: string;
  request_note: string;
  prompt: string;
  header: string[];
  body: string[];
  footer: string[];
  filename: string;
  pdf_path: string;
  created_at: string;
  updated_at: string;
}

export interface LetterSummary {
  id: string;
  company: string;
  position: string;
  has_body: boolean;
  pdf_path: string;
  created_at: string;
  updated_at: string;
  modified: number;
}
