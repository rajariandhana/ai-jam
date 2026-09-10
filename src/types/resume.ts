export interface Profile {
  name: string;
  website: string;
  email: string;
  linkedin: string;
  github: string;
}

/** Entries opt out of the PDF with `enabled: false`; absent means included. */
export interface Includable {
  enabled?: boolean;
}

export interface Education extends Includable {
  university: string;
  location: string;
  degree: string;
  gpa: string;
  date: string;
  coursework: string[];
}

export interface Project extends Includable {
  name: string;
  slug: string;
  stack: string[];
  date: string;
  description: string[];
}

export interface Experience extends Includable {
  company: string;
  position: string;
  date: string;
  location: string;
  description: string[];
}

export interface Skill extends Includable {
  category: string;
  description: string;
}

/** The parts of the PDF below the header, in the order they are rendered. */
export type SectionKey =
  | "summary"
  | "education"
  | "projects"
  | "experience"
  | "skills";

export interface SectionConfig {
  key: SectionKey;
  enabled: boolean;
}

export interface Resume {
  profile: Profile;
  summary: string;
  education: Education[];
  projects: Project[];
  experience: Experience[];
  skills: Skill[];
  sections: SectionConfig[];
}

export interface PresetConfig {
  projects: string[];
  experience: string[];
}

export type Presets = Record<string, PresetConfig>;

export interface BuildFile {
  name: string;
  size: number;
  modified: number;
}

export interface DashboardData {
  profile: Profile;
  presets: string[];
  resume_builds: BuildFile[];
  cover_letter_builds: BuildFile[];
}
