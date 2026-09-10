import { Button, Card, Input, Spinner, Switch, toast } from "@heroui/react";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Eye,
  FileDown,
  FolderGit2,
  GraduationCap,
  LayoutList,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  User,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Field, LongField } from "../components/ui/Field";
import { ItemCard } from "../components/ui/ItemCard";
import { StringList } from "../components/ui/StringList";
import instance, { error_message } from "../lib/api";
import {
  build_stem,
  EMPTY_RESUME,
  empty_education,
  empty_experience,
  empty_project,
  empty_skill,
  included_count,
  is_full_layout,
  is_included,
  is_list_section,
  item_hint,
  item_label,
  layout_signature,
  move_by,
  normalise_sections,
  remove_at,
  replace_at,
  set_included,
  slugify,
} from "../lib/resume";
import type { ListSectionKey } from "../lib/resume";
import type { Resume, SectionConfig, SectionKey } from "../types/resume";

/** Label and icon for each section the PDF can render. */
const SECTION_META: Record<SectionKey, { label: string; icon: typeof User }> = {
  summary: { label: "Summary", icon: ScrollText },
  education: { label: "Education", icon: GraduationCap },
  projects: { label: "Projects", icon: FolderGit2 },
  experience: { label: "Experience", icon: Briefcase },
  skills: { label: "Skills", icon: Wrench },
};

/** The two tabs that are not themselves resume sections. */
const PROFILE_TAB = "profile";
const LAYOUT_TAB = "layout";

type Tab = typeof PROFILE_TAB | typeof LAYOUT_TAB | SectionKey;

const ALL_PRESETS = "ALL";

/** Shown once the layout has been hand-edited away from any template. */
const CUSTOM_PRESET = "CUSTOM";

function ResumeEditor() {
  const [resume, set_resume] = useState<Resume>(EMPTY_RESUME);
  const [saved_resume, set_saved_resume] = useState<Resume>(EMPTY_RESUME);
  const [presets, set_presets] = useState<string[]>([]);
  const [preset, set_preset] = useState(ALL_PRESETS);
  const [is_applying_preset, set_is_applying_preset] = useState(false);
  // Null until the field is edited, so it follows the profile name and preset.
  const [typed_name, set_typed_name] = useState<string | null>(null);
  const [tab, set_tab] = useState<Tab>(PROFILE_TAB);

  const [is_loading, set_is_loading] = useState(true);
  const [is_saving, set_is_saving] = useState(false);
  const [load_error, set_load_error] = useState("");

  const [preview_url, set_preview_url] = useState("");
  const [preview_error, set_preview_error] = useState("");
  const [is_previewing, set_is_previewing] = useState(false);
  const [is_preview_stale, set_is_preview_stale] = useState(false);

  const preview_url_ref = useRef("");
  const did_initial_preview = useRef(false);

  const is_dirty = JSON.stringify(resume) !== JSON.stringify(saved_resume);

  const auto_build_name = build_stem(
    resume.profile.name,
    preset === ALL_PRESETS ? "" : preset,
  );

  const build_name = typed_name ?? auto_build_name;

  useEffect(() => {
    Promise.all([instance.get("/resume"), instance.get("/resume/presets")])
      .then(([resume_response, presets_response]) => {
        // resume.json may predate the section config, or list it partially.
        const loaded: Resume = {
          ...resume_response.data.data,
          sections: normalise_sections(resume_response.data.data.sections),
        };

        set_resume(loaded);
        set_saved_resume(loaded);
        set_preset(is_full_layout(loaded) ? ALL_PRESETS : CUSTOM_PRESET);
        set_presets(Object.keys(presets_response.data.presets));
      })
      .catch((caught) =>
        set_load_error(error_message(caught, "Could not load resume.json.")),
      )
      .finally(() => set_is_loading(false));
  }, []);

  /** Revoke the last blob URL so repeated previews do not leak memory. */
  const swap_preview_url = useCallback((url: string) => {
    if (preview_url_ref.current) {
      URL.revokeObjectURL(preview_url_ref.current);
    }

    preview_url_ref.current = url;
    set_preview_url(url);
  }, []);

  useEffect(() => {
    return () => {
      if (preview_url_ref.current) {
        URL.revokeObjectURL(preview_url_ref.current);
      }
    };
  }, []);

  const refresh_preview = useCallback(
    async (data: Resume) => {
      set_is_previewing(true);
      set_preview_error("");

      try {
        const response = await instance.post(
          "/resume/preview",
          { data },
          { responseType: "blob" },
        );

        swap_preview_url(URL.createObjectURL(response.data));
        set_is_preview_stale(false);
      } catch (caught) {
        // A blob-typed error body has to be read back as text before it is useful.
        let detail = "";

        if (caught instanceof Object && "response" in caught) {
          const body = (caught as { response?: { data?: Blob } }).response?.data;

          if (body instanceof Blob) {
            try {
              detail = JSON.parse(await body.text()).detail ?? "";
            } catch {
              detail = "";
            }
          }
        }

        set_preview_error(
          detail || error_message(caught, "Could not compile the PDF."),
        );
      } finally {
        set_is_previewing(false);
      }
    },
    [swap_preview_url],
  );

  // Compile once as soon as the resume is on screen.
  useEffect(() => {
    if (is_loading || load_error || did_initial_preview.current) {
      return;
    }

    did_initial_preview.current = true;
    refresh_preview(resume);
  }, [is_loading, load_error, resume, refresh_preview]);

  const update = (changes: Partial<Resume>) => {
    const next = { ...resume, ...changes };

    if (layout_signature(next) !== layout_signature(resume)) {
      set_preset(is_full_layout(next) ? ALL_PRESETS : CUSTOM_PRESET);
    }

    set_resume(next);
    set_is_preview_stale(true);
  };

  /** Switch every section and entry to what the chosen template asks for. */
  async function choose_preset(next: string) {
    if (next === preset || next === CUSTOM_PRESET) {
      return;
    }

    set_is_applying_preset(true);

    try {
      const response = await instance.post("/resume/apply-preset", {
        data: resume,
        preset: next === ALL_PRESETS ? "" : next,
      });

      const switched: Resume = {
        ...response.data.data,
        sections: normalise_sections(response.data.data.sections),
      };

      set_resume(switched);
      set_preset(next);
      refresh_preview(switched);
    } catch (caught) {
      toast.danger(error_message(caught, "Could not apply the preset."));
    } finally {
      set_is_applying_preset(false);
    }
  }

  async function save() {
    set_is_saving(true);

    try {
      await instance.put("/resume", { data: resume });
      set_saved_resume(resume);
      toast.success("Saved to resume.json");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not save resume.json."));
    } finally {
      set_is_saving(false);
    }
  }

  async function build() {
    try {
      const response = await instance.post("/resume/build", {
        data: resume,
        label: preset === ALL_PRESETS ? "" : preset,
        // An emptied field falls back to the name the placeholder shows.
        filename: build_name.trim() || auto_build_name,
      });
      toast.success(`Built ${response.data.name}`);
    } catch (caught) {
      toast.danger(error_message(caught, "Could not build the PDF."));
    }
  }

  if (is_loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted">
        <Spinner size="sm" />
        Loading resume.json...
      </div>
    );
  }

  if (load_error) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <Card.Header>
          <Card.Title>Could not load the resume</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">{load_error}</p>
        </Card.Content>
      </Card>
    );
  }

  return (
    // --editor-bar is the sticky bar's height: py-3 plus a 36px title row, a
    // 12px gap and a 32px tab row. Rounded up so the preview never slides
    // under it. The tab strip only wraps below `xl`, where nothing is sticky.
    <div className="flex flex-col gap-4 pb-4 [--editor-bar:6.75rem]">
      <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-3 border-b border-border bg-background-secondary/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Resume</h1>
            {is_dirty && (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-foreground">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                aria-label="PDF file name"
                value={build_name}
                placeholder={auto_build_name}
                onChange={(event) => set_typed_name(event.target.value)}
                variant="secondary"
                className="w-120 border-2 border-gray-400"
              />
              <span className="font-mono text-xs text-muted">.pdf</span>
            </div>

            <Button variant="ghost" onClick={build}>
              <FileDown className="size-4" />
              Build PDF
            </Button>
            <Button isPending={is_saving} isDisabled={!is_dirty} onClick={save}>
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        <TabStrip tab={tab} sections={resume.sections} on_tab={set_tab} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            Select any text and press Cmd/Ctrl+B, I or U, or use the toolbar
            that appears. Markup is stored as{" "}
            <code className="font-mono">**bold**</code>,{" "}
            <code className="font-mono">*italic*</code> and{" "}
            <code className="font-mono">__underline__</code>.
          </p>

          <Card>
            <Card.Content className="flex flex-col gap-4 py-4">
              <ExcludedNotice
                tab={tab}
                sections={resume.sections}
                on_include={(key) =>
                  update({ sections: set_enabled(resume.sections, key, true) })
                }
              />

              {tab === PROFILE_TAB && (
                <ProfileSection resume={resume} update={update} />
              )}
              {tab === LAYOUT_TAB && (
                <LayoutSection resume={resume} update={update} />
              )}
              {tab === "summary" && (
                <SummarySection resume={resume} update={update} />
              )}
              {tab === "education" && (
                <EducationSection resume={resume} update={update} />
              )}
              {tab === "projects" && (
                <ProjectsSection resume={resume} update={update} />
              )}
              {tab === "experience" && (
                <ExperienceSection resume={resume} update={update} />
              )}
              {tab === "skills" && (
                <SkillsSection resume={resume} update={update} />
              )}
            </Card.Content>
          </Card>
        </div>

        <PreviewPane
          presets={presets}
          preset={preset}
          on_preset={choose_preset}
          is_applying_preset={is_applying_preset}
          url={preview_url}
          error={preview_error}
          is_pending={is_previewing}
          is_stale={is_preview_stale}
          on_refresh={() => refresh_preview(resume)}
        />
      </div>
    </div>
  );
}

/** Flip one section on or off, leaving the order untouched. */
function set_enabled(
  sections: SectionConfig[],
  key: SectionKey,
  enabled: boolean,
): SectionConfig[] {
  return sections.map((entry) =>
    entry.key === key ? { ...entry, enabled } : entry,
  );
}

interface TabStripProps {
  tab: Tab;
  sections: SectionConfig[];
  on_tab: (tab: Tab) => void;
}

/** Profile, then the sections in the order the PDF renders them, then Layout. */
function TabStrip({ tab, sections, on_tab }: TabStripProps) {
  const tabs = [
    { key: PROFILE_TAB, label: "Profile", icon: User, is_muted: false },
    ...sections.map(({ key, enabled }) => ({
      key,
      label: SECTION_META[key].label,
      icon: SECTION_META[key].icon,
      is_muted: !enabled,
    })),
    { key: LAYOUT_TAB, label: "Layout", icon: LayoutList, is_muted: false },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map(({ key, label, icon: Icon, is_muted }) => (
        <button
          key={key}
          type="button"
          onClick={() => on_tab(key as Tab)}
          title={is_muted ? `${label} is excluded from the PDF` : undefined}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === key
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted hover:bg-surface-secondary"
          } ${is_muted && tab !== key ? "opacity-50" : ""}`}
        >
          <Icon className="size-4" />
          <span className={is_muted ? "line-through" : ""}>{label}</span>
        </button>
      ))}
    </div>
  );
}

interface ExcludedNoticeProps {
  tab: Tab;
  sections: SectionConfig[];
  on_include: (key: SectionKey) => void;
}

/** Warn when the section being edited will not reach the PDF. */
function ExcludedNotice({ tab, sections, on_include }: ExcludedNoticeProps) {
  const entry = sections.find((section) => section.key === tab);

  if (!entry || entry.enabled) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2">
      <p className="text-sm text-warning-soft-foreground">
        {SECTION_META[entry.key].label} is excluded from the PDF.
      </p>
      <Button size="sm" variant="secondary" onClick={() => on_include(entry.key)}>
        <Eye className="size-4" />
        Include
      </Button>
    </div>
  );
}

/** How much content a section contributes to the PDF, for the Layout list. */
function section_hint(resume: Resume, key: SectionKey) {
  if (key === "summary") {
    const words = resume.summary.trim().split(/\s+/).filter(Boolean).length;

    return words === 0 ? "no text yet" : `${words} words`;
  }

  const items = resume[key];

  if (items.length === 0) {
    return "no entries";
  }

  const included = included_count(items);

  if (included === items.length) {
    return `${items.length} ${items.length === 1 ? "entry" : "entries"}`;
  }

  return `${included} of ${items.length} entries`;
}

function LayoutSection({ resume, update }: SectionProps) {
  const sections = resume.sections;
  const set_sections = (next: SectionConfig[]) => update({ sections: next });

  const [expanded, set_expanded] = useState<SectionKey | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Sections appear in the PDF top to bottom in this order. Expand one to
        choose which entries it contributes. Anything excluded here stays in
        resume.json, and a section with nothing left to show is skipped.
      </p>

      {sections.map((entry, index) => {
        const { label, icon: Icon } = SECTION_META[entry.key];
        const has_items = is_list_section(entry.key);
        const is_open = expanded === entry.key;

        return (
          <div
            key={entry.key}
            className="rounded-lg border border-border bg-surface"
          >
            <div className="flex items-center gap-2 p-2">
              <span className="w-5 shrink-0 text-center font-mono text-xs text-muted">
                {index + 1}
              </span>

              <Icon
                className={`size-4 shrink-0 text-muted ${entry.enabled ? "" : "opacity-50"}`}
              />

              {has_items ? (
                <button
                  type="button"
                  onClick={() => set_expanded(is_open ? null : entry.key)}
                  className="flex flex-1 items-baseline gap-2 overflow-hidden text-left"
                  aria-expanded={is_open}
                >
                  <SectionLabel
                    label={label}
                    enabled={entry.enabled}
                    hint={section_hint(resume, entry.key)}
                  />
                  <ChevronDown
                    className={`size-3.5 shrink-0 self-center text-muted transition-transform ${
                      is_open ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                <div className="flex flex-1 items-baseline gap-2 overflow-hidden">
                  <SectionLabel
                    label={label}
                    enabled={entry.enabled}
                    hint={section_hint(resume, entry.key)}
                  />
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Move ${label} up`}
                isDisabled={index === 0}
                onClick={() => set_sections(move_by(sections, index, -1))}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Move ${label} down`}
                isDisabled={index === sections.length - 1}
                onClick={() => set_sections(move_by(sections, index, 1))}
              >
                <ChevronDown className="size-4" />
              </Button>

              <Switch
                isSelected={entry.enabled}
                onChange={(enabled) =>
                  set_sections(set_enabled(sections, entry.key, enabled))
                }
              >
                <Switch.Content aria-label={`Include ${label} in the PDF`}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>

            {is_open && is_list_section(entry.key) && (
              <ItemPicker
                section={entry.key}
                label={label}
                is_section_enabled={entry.enabled}
                resume={resume}
                update={update}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({
  label,
  enabled,
  hint,
}: {
  label: string;
  enabled: boolean;
  hint: string;
}) {
  return (
    <>
      <span
        className={`truncate text-sm font-medium ${enabled ? "" : "text-muted line-through"}`}
      >
        {label}
      </span>
      <span className="truncate text-xs text-muted">{hint}</span>
    </>
  );
}

interface ItemPickerProps {
  section: ListSectionKey;
  label: string;
  is_section_enabled: boolean;
  resume: Resume;
  update: (changes: Partial<Resume>) => void;
}

/** Per-entry include switches for one section. */
function ItemPicker({
  section,
  label,
  is_section_enabled,
  resume,
  update,
}: ItemPickerProps) {
  const items = resume[section];

  const set_items = (next: typeof items) =>
    update({ [section]: next } as Partial<Resume>);

  const set_all = (included: boolean) =>
    set_items(items.map((item) => set_included(item, included)) as typeof items);

  if (items.length === 0) {
    return (
      <p className="border-t border-border p-3 text-xs italic text-muted">
        No entries yet. Add some from the {label} tab.
      </p>
    );
  }

  return (
    <div className="flex flex-col border-t border-border">
      <div className="flex items-center justify-end gap-1 px-3 py-1.5">
        <Button size="sm" variant="ghost" onClick={() => set_all(true)}>
          Include all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => set_all(false)}>
          Exclude all
        </Button>
      </div>

      {items.map((item, index) => {
        const included = is_included(item);
        const hint = item_hint(section, item);

        return (
          <label
            key={index}
            className="flex cursor-pointer items-center gap-3 border-t border-border px-3 py-2 hover:bg-surface-secondary"
          >
            <div className="flex flex-1 items-baseline gap-2 overflow-hidden">
              <span
                className={`truncate text-sm ${
                  included && is_section_enabled
                    ? ""
                    : "text-muted line-through"
                }`}
              >
                {item_label(section, item)}
              </span>
              {hint && (
                <span className="truncate text-xs text-muted">{hint}</span>
              )}
            </div>

            <Switch
              isSelected={included}
              onChange={(next) =>
                set_items(
                  replace_at(items, index, set_included(item, next)) as typeof items,
                )
              }
            >
              <Switch.Content
                aria-label={`Include ${item_label(section, item)} in the PDF`}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </label>
        );
      })}
    </div>
  );
}

interface SectionProps {
  resume: Resume;
  update: (changes: Partial<Resume>) => void;
}

function ProfileSection({ resume, update }: SectionProps) {
  const set_profile = (key: keyof Resume["profile"], value: string) =>
    update({ profile: { ...resume.profile, [key]: value } });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Name"
        value={resume.profile.name}
        onChange={(value) => set_profile("name", value)}
      />
      <Field
        label="Email"
        value={resume.profile.email}
        onChange={(value) => set_profile("email", value)}
      />
      <Field
        label="Website"
        value={resume.profile.website}
        onChange={(value) => set_profile("website", value)}
      />
      <Field
        label="LinkedIn"
        value={resume.profile.linkedin}
        onChange={(value) => set_profile("linkedin", value)}
      />
      <Field
        label="GitHub"
        value={resume.profile.github}
        onChange={(value) => set_profile("github", value)}
        className="sm:col-span-2"
      />
    </div>
  );
}

function SummarySection({ resume, update }: SectionProps) {
  return (
    <>
      <LongField
        label="Summary"
        value={resume.summary}
        onChange={(value) => update({ summary: value })}
        rows={6}
      />
      <p className="text-xs text-muted">
        Rendered as a short paragraph under a Summary heading. Leave it empty to
        drop the heading from the PDF.
      </p>
    </>
  );
}

function EducationSection({ resume, update }: SectionProps) {
  const items = resume.education;
  const set_items = (next: typeof items) => update({ education: next });

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <ItemCard
          key={index}
          index={index}
          total={items.length}
          included={is_included(item)}
          title={item.university}
          subtitle={item.degree}
          onMove={(offset) => set_items(move_by(items, index, offset))}
          onRemove={() => set_items(remove_at(items, index))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="University"
              value={item.university}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, university: value }))
              }
            />
            <Field
              label="Location"
              value={item.location}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, location: value }))
              }
            />
            <Field
              label="Degree"
              value={item.degree}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, degree: value }))
              }
            />
            <Field
              label="GPA"
              value={item.gpa}
              placeholder="3.44/4.0"
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, gpa: value }))
              }
            />
            <Field
              label="Dates"
              value={item.date}
              placeholder="August 2022 - October 2026"
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, date: value }))
              }
              className="sm:col-span-2"
            />
          </div>

          <StringList
            label="Coursework"
            values={item.coursework}
            placeholder="Data Structures"
            add_label="Add course"
            onChange={(values) =>
              set_items(replace_at(items, index, { ...item, coursework: values }))
            }
          />
        </ItemCard>
      ))}

      <AddButton
        label="Add education"
        onClick={() => set_items([...items, empty_education()])}
      />
    </div>
  );
}

function ProjectsSection({ resume, update }: SectionProps) {
  const items = resume.projects;
  const set_items = (next: typeof items) => update({ projects: next });

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <ItemCard
          key={index}
          index={index}
          total={items.length}
          included={is_included(item)}
          title={item.name}
          subtitle={item.stack.join(", ")}
          onMove={(offset) => set_items(move_by(items, index, offset))}
          onRemove={() => set_items(remove_at(items, index))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              value={item.name}
              onChange={(value) =>
                set_items(
                  replace_at(items, index, {
                    ...item,
                    name: value,
                    // Keep the slug in step until someone edits it by hand.
                    slug:
                      item.slug === "" || item.slug === slugify(item.name)
                        ? slugify(value)
                        : item.slug,
                  }),
                )
              }
            />
            <Field
              label="Dates"
              value={item.date}
              placeholder="May 2026"
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, date: value }))
              }
            />
            <Field
              label="Slug"
              value={item.slug}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, slug: value }))
              }
              className="sm:col-span-2"
            />
          </div>

          <StringList
            label="Stack"
            values={item.stack}
            placeholder="React"
            add_label="Add technology"
            onChange={(values) =>
              set_items(replace_at(items, index, { ...item, stack: values }))
            }
          />

          <StringList
            label="Bullet points"
            values={item.description}
            placeholder="Built ... by ... resulting in ..."
            multiline
            add_label="Add bullet"
            onChange={(values) =>
              set_items(replace_at(items, index, { ...item, description: values }))
            }
          />
        </ItemCard>
      ))}

      <AddButton
        label="Add project"
        onClick={() => set_items([...items, empty_project()])}
      />
    </div>
  );
}

function ExperienceSection({ resume, update }: SectionProps) {
  const items = resume.experience;
  const set_items = (next: typeof items) => update({ experience: next });

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <ItemCard
          key={index}
          index={index}
          total={items.length}
          included={is_included(item)}
          title={item.position}
          subtitle={item.company}
          onMove={(offset) => set_items(move_by(items, index, offset))}
          onRemove={() => set_items(remove_at(items, index))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Position"
              value={item.position}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, position: value }))
              }
            />
            <Field
              label="Company"
              value={item.company}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, company: value }))
              }
            />
            <Field
              label="Dates"
              value={item.date}
              placeholder="January 2024 - June 2026"
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, date: value }))
              }
            />
            <Field
              label="Location"
              value={item.location}
              onChange={(value) =>
                set_items(replace_at(items, index, { ...item, location: value }))
              }
            />
          </div>

          <StringList
            label="Bullet points"
            values={item.description}
            placeholder="Managed ... by ... resulting in ..."
            multiline
            add_label="Add bullet"
            onChange={(values) =>
              set_items(replace_at(items, index, { ...item, description: values }))
            }
          />
        </ItemCard>
      ))}

      <AddButton
        label="Add experience"
        onClick={() => set_items([...items, empty_experience()])}
      />
    </div>
  );
}

function SkillsSection({ resume, update }: SectionProps) {
  const items = resume.skills;
  const set_items = (next: typeof items) => update({ skills: next });

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <ItemCard
          key={index}
          index={index}
          total={items.length}
          included={is_included(item)}
          title={item.category}
          subtitle={item.description}
          onMove={(offset) => set_items(move_by(items, index, offset))}
          onRemove={() => set_items(remove_at(items, index))}
        >
          <Field
            label="Category"
            value={item.category}
            placeholder="Programming Languages"
            onChange={(value) =>
              set_items(replace_at(items, index, { ...item, category: value }))
            }
          />
          <LongField
            label="Description"
            value={item.description}
            placeholder="C, C++, Go, Python"
            rows={2}
            onChange={(value) =>
              set_items(replace_at(items, index, { ...item, description: value }))
            }
          />
        </ItemCard>
      ))}

      <AddButton
        label="Add skill"
        onClick={() => set_items([...items, empty_skill()])}
      />
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" fullWidth onClick={onClick}>
      <Plus className="size-4" />
      {label}
    </Button>
  );
}

interface PreviewPaneProps {
  presets: string[];
  preset: string;
  on_preset: (preset: string) => void;
  is_applying_preset: boolean;
  url: string;
  error: string;
  is_pending: boolean;
  is_stale: boolean;
  on_refresh: () => void;
}

function PreviewPane({
  presets,
  preset,
  on_preset,
  is_applying_preset,
  url,
  error,
  is_pending,
  is_stale,
  on_refresh,
}: PreviewPaneProps) {
  // CUSTOM is a state to land in, not a template to pick, so it only appears
  // once the layout has been edited by hand.
  const options = [
    ALL_PRESETS,
    ...presets,
    ...(preset === CUSTOM_PRESET ? [CUSTOM_PRESET] : []),
  ];

  return (
    <div className="flex flex-col gap-2 xl:sticky xl:top-[calc(4rem+var(--editor-bar))] xl:self-start">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {options.map((option) => {
            const is_active = preset === option;
            const is_custom = option === CUSTOM_PRESET;

            return (
              <button
                key={option}
                type="button"
                disabled={is_applying_preset || is_custom}
                title={
                  is_custom
                    ? "The layout no longer matches a template"
                    : `Switch every section and entry to the ${option} template`
                }
                onClick={() => on_preset(option)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${
                  is_active
                    ? "border-accent bg-accent-soft text-accent-soft-foreground font-medium"
                    : "border-border text-muted hover:bg-surface-secondary"
                } ${is_custom ? "cursor-default border-dashed" : ""}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant={is_stale ? "primary" : "secondary"}
          onClick={on_refresh}
        >
          <RefreshCw className={`size-4 ${is_pending ? "animate-spin" : ""}`} />
          {is_stale ? "Update preview" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger bg-danger-soft p-3">
          <p className="text-sm font-medium text-danger-soft-foreground">
            pdflatex could not compile this resume
          </p>
          <pre className="mt-1 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-danger-soft-foreground">
            {error}
          </pre>
        </div>
      )}

      <div className="relative h-[calc(100vh-7.5rem-var(--editor-bar))] min-h-[500px] overflow-hidden rounded-lg border border-border bg-surface-secondary">
        {url ? (
          <iframe
            src={url}
            title="Resume preview"
            className="size-full"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted">
            No preview yet.
          </div>
        )}

        {is_pending && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted backdrop-blur-sm">
            <Spinner size="sm" />
            Compiling...
          </div>
        )}
      </div>
    </div>
  );
}

export default ResumeEditor;
