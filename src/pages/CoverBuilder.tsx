import {
  Button,
  Card,
  Input,
  Label,
  Spinner,
  TextArea,
  toast,
} from "@heroui/react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileDown,
  FilePlus2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import CoverHeader from "../components/CoverHeader";
import { CopyButton } from "../components/ui/CopyButton";
import instance, { error_message } from "../lib/api";
import {
  EMPTY_LETTER,
  EMPTY_TEMPLATE,
  format_time,
  letter_title,
  move_by,
  remove_at,
  replace_at,
} from "../lib/cover";
import type { CoverTemplate, Letter, LetterSummary } from "../types/cover";

/** Claude can take a few minutes; match the backend's own timeout. */
const GENERATE_TIMEOUT = 300 * 1000;

/** The column the list view's bar and rows share, so the two line up. */
const LIST_WIDTH = "mx-auto w-full max-w-4xl";

function CoverBuilder() {
  const { letter_id } = useParams();

  return letter_id ? (
    <LetterEditor key={letter_id} letter_id={letter_id} />
  ) : (
    <LetterList />
  );
}

/* ------------------------------------------------------------------ list */

function LetterList() {
  const [letters, set_letters] = useState<LetterSummary[]>([]);
  const [is_loading, set_is_loading] = useState(true);
  const [load_error, set_load_error] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    instance
      .get("/cover/letters")
      .then((response) => set_letters(response.data.letters))
      .catch((caught) =>
        set_load_error(error_message(caught, "Could not load the letters.")),
      )
      .finally(() => set_is_loading(false));
  }, []);

  async function remove(id: string) {
    try {
      await instance.delete(`/cover/letters/${id}`);
      set_letters(letters.filter((entry) => entry.id !== id));
      toast.success("Letter deleted");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not delete the letter."));
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <CoverHeader
        title="Builder"
        width={LIST_WIDTH}
        actions={
          <Button onClick={() => navigate("/cover")}>
            <FilePlus2 className="size-4" />
            New letter
          </Button>
        }
      />

      <div className={`flex flex-col gap-4 ${LIST_WIDTH}`}>
        <p className="text-sm text-muted">
          Every letter is saved as JSON, so you can reopen one, rewrite any
          paragraph and build the PDF again.
        </p>

        <TemplateCard />

        {is_loading && (
          <div className="flex h-32 items-center justify-center gap-2 text-muted">
            <Spinner size="sm" />
            Loading letters...
          </div>
        )}

        {load_error && (
          <Card>
            <Card.Content className="py-6 text-sm text-danger">
              {load_error}
            </Card.Content>
          </Card>
        )}

        {!is_loading && !load_error && letters.length === 0 && (
          <Card>
            <Card.Content className="py-8 text-center text-sm text-muted">
              No letters yet. Fill in the job details on the New letter page to
              start one.
            </Card.Content>
          </Card>
        )}

        <div className="flex flex-col gap-2">
          {letters.map((letter) => (
            <div
              key={letter.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <button
                type="button"
                className="flex flex-1 flex-col items-start overflow-hidden text-left"
                onClick={() => navigate(`/cover/builder/${letter.id}`)}
              >
                <span className="truncate text-sm font-medium">
                  {letter_title(letter)}
                </span>
                <span className="truncate text-xs text-muted">
                  {[letter.position, format_time(letter.updated_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>

              {!letter.has_body && (
                <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-foreground">
                  No body yet
                </span>
              )}

              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Delete the ${letter_title(letter)} letter`}
                onClick={() => remove(letter.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The header and footer new letters start from, with their placeholders. */
function TemplateCard() {
  const [template, set_template] = useState<CoverTemplate>(EMPTY_TEMPLATE);
  const [saved, set_saved] = useState<CoverTemplate>(EMPTY_TEMPLATE);
  const [is_open, set_is_open] = useState(false);
  const [is_saving, set_is_saving] = useState(false);

  const is_dirty = JSON.stringify(template) !== JSON.stringify(saved);

  useEffect(() => {
    instance
      .get("/cover/template")
      .then((response) => {
        set_template(response.data.data);
        set_saved(response.data.data);
      })
      .catch((caught) =>
        toast.danger(error_message(caught, "Could not load template.json.")),
      );
  }, []);

  const update = (changes: Partial<CoverTemplate>) =>
    set_template({ ...template, ...changes });

  async function save() {
    set_is_saving(true);

    try {
      const response = await instance.put("/cover/template", {
        data: template,
      });

      set_template(response.data.data);
      set_saved(response.data.data);
      toast.success("Saved to template.json");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not save template.json."));
    } finally {
      set_is_saving(false);
    }
  }

  return (
    <Card>
      <Card.Content className="flex flex-col gap-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex flex-1 items-center gap-2 text-left"
            onClick={() => set_is_open(!is_open)}
            aria-expanded={is_open}
          >
            {is_open ? (
              <ChevronUp className="size-4 text-muted" />
            ) : (
              <ChevronDown className="size-4 text-muted" />
            )}
            <span className="text-sm font-medium">Template</span>
            <span className="text-xs text-muted">
              the header and footer every new letter starts from
            </span>
          </button>

          {is_dirty && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-foreground">
              Unsaved
            </span>
          )}
        </div>

        {is_open && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <p className="text-xs text-muted">
              <code className="font-mono">{"{NAME}"}</code>,{" "}
              <code className="font-mono">{"{DATE}"}</code>,{" "}
              <code className="font-mono">{"{COMPANY}"}</code> and{" "}
              <code className="font-mono">{"{POSITION}"}</code> are filled in
              when a letter is started.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted">Name</Label>
                <Input
                  type="text"
                  value={template.name}
                  aria-label="Name"
                  onChange={(event) => update({ name: event.target.value })}
                  variant="secondary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted">
                  PDF file name
                </Label>
                <Input
                  type="text"
                  value={template.filename}
                  placeholder="Cover Letter_{NAME}_{COMPANY}"
                  aria-label="PDF file name"
                  onChange={(event) => update({ filename: event.target.value })}
                  variant="secondary"
                />
              </div>
            </div>

            <ParagraphList
              label="Header"
              values={template.header}
              onChange={(header) => update({ header })}
              placeholder="Dear Hiring Manager,"
            />

            <ParagraphList
              label="Footer"
              values={template.footer}
              onChange={(footer) => update({ footer })}
              placeholder="Sincerely,"
              rows={2}
            />

            <div className="flex items-center gap-2 self-end">
              <Button
                variant="ghost"
                size="sm"
                isDisabled={!is_dirty}
                onClick={() => set_template(saved)}
              >
                <RotateCcw className="size-4" />
                Revert
              </Button>
              <Button
                size="sm"
                isPending={is_saving}
                isDisabled={!is_dirty}
                onClick={save}
              >
                <Save className="size-4" />
                Save template
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

/* ---------------------------------------------------------------- editor */

function LetterEditor({ letter_id }: { letter_id: string }) {
  const [letter, set_letter] = useState<Letter>(EMPTY_LETTER);
  const [saved, set_saved] = useState<Letter>(EMPTY_LETTER);

  const [is_loading, set_is_loading] = useState(true);
  const [load_error, set_load_error] = useState("");
  const [is_saving, set_is_saving] = useState(false);
  const [is_writing, set_is_writing] = useState(false);
  const [is_building, set_is_building] = useState(false);
  const [is_rebuilding_prompt, set_is_rebuilding_prompt] = useState(false);

  const navigate = useNavigate();

  const is_dirty = JSON.stringify(letter) !== JSON.stringify(saved);

  useEffect(() => {
    instance
      .get(`/cover/letters/${letter_id}`)
      .then((response) => {
        set_letter(response.data.letter);
        set_saved(response.data.letter);
      })
      .catch((caught) =>
        set_load_error(error_message(caught, "Could not load the letter.")),
      )
      .finally(() => set_is_loading(false));
  }, [letter_id]);

  const update = (changes: Partial<Letter>) =>
    set_letter({ ...letter, ...changes });

  /** Take what the backend returns as both the current and the saved state. */
  const accept = (next: Letter) => {
    set_letter(next);
    set_saved(next);
  };

  async function save() {
    set_is_saving(true);

    try {
      const response = await instance.put(
        `/cover/letters/${letter_id}`,
        letter,
      );

      accept(response.data.letter);
      toast.success("Letter saved");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not save the letter."));
    } finally {
      set_is_saving(false);
    }
  }

  /** Save first, so Claude answers the job details currently on screen. */
  async function write_with_claude() {
    set_is_writing(true);

    try {
      await instance.put(`/cover/letters/${letter_id}`, letter);

      const response = await instance.post(
        `/cover/letters/${letter_id}/generate`,
        {},
        { timeout: GENERATE_TIMEOUT },
      );

      accept(response.data.letter);
      toast.success("Claude wrote the body");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not write the letter."));
    } finally {
      set_is_writing(false);
    }
  }

  async function rebuild_prompt() {
    set_is_rebuilding_prompt(true);

    try {
      await instance.put(`/cover/letters/${letter_id}`, letter);

      const response = await instance.post(
        `/cover/letters/${letter_id}/prompt`,
      );

      accept(response.data.letter);
      toast.success("Prompt rebuilt");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not rebuild the prompt."));
    } finally {
      set_is_rebuilding_prompt(false);
    }
  }

  async function build_pdf() {
    set_is_building(true);

    try {
      await instance.put(`/cover/letters/${letter_id}`, letter);

      const response = await instance.post(`/cover/letters/${letter_id}/pdf`);

      accept(response.data.letter);
      toast.success(`Built ${response.data.name}`);
    } catch (caught) {
      toast.danger(error_message(caught, "Could not build the PDF."));
    } finally {
      set_is_building(false);
    }
  }

  if (is_loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted">
        <Spinner size="sm" />
        Loading the letter...
      </div>
    );
  }

  if (load_error) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <Card.Header>
          <Card.Title>Could not load the letter</Card.Title>
          <Card.Description>{load_error}</Card.Description>
        </Card.Header>
        <Card.Content>
          <Button fullWidth onClick={() => navigate("/cover/builder")}>
            <ArrowLeft className="size-4" />
            Back to the letters
          </Button>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <CoverHeader
        title={letter_title(letter)}
        subtitle={[letter.position, format_time(letter.updated_at)]
          .filter(Boolean)
          .join(" · ")}
        leading={
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label="Back to the letters"
            onClick={() => navigate("/cover/builder")}
          >
            <ArrowLeft className="size-4" />
          </Button>
        }
        badge={
          is_dirty && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-foreground">
              Unsaved changes
            </span>
          )
        }
        actions={
          <>
            <Button
              variant="ghost"
              isDisabled={!is_dirty}
              onClick={() => set_letter(saved)}
            >
              <RotateCcw className="size-4" />
              Revert
            </Button>
            <Button
              variant="ghost"
              isPending={is_building}
              isDisabled={letter.body.length === 0}
              onClick={build_pdf}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <FileDown className="size-4" />
                  )}
                  Build PDF
                </>
              )}
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
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <Card.Header>
              <Card.Title className="text-base">The job</Card.Title>
              <Card.Description>
                Changing any of this and rebuilding the prompt sends the model
                the new details.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Company"
                  value={letter.company}
                  onChange={(company) => update({ company })}
                />
                <TextField
                  label="Position"
                  value={letter.position}
                  onChange={(position) => update({ position })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted">
                  Job description
                </Label>
                <TextArea
                  value={letter.job_description}
                  rows={8}
                  aria-label="Job description"
                  onChange={(event) =>
                    update({ job_description: event.target.value })
                  }
                  variant="secondary"
                />
              </div>

              <TextField
                label="Prompt request note"
                value={letter.request_note}
                onChange={(request_note) => update({ request_note })}
                placeholder="Make it sarcastic..."
              />

              <TextField
                label="PDF file name"
                value={letter.filename}
                onChange={(filename) => update({ filename })}
                hint=".pdf is added when the file is written."
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header className="flex-row items-start justify-between gap-2">
              <div>
                <Card.Title className="text-base">Prompt</Card.Title>
                <Card.Description>
                  Paste this into your model of choice, or let Claude answer it
                  here.
                </Card.Description>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  isPending={is_rebuilding_prompt}
                  onClick={rebuild_prompt}
                >
                  <RefreshCw className="size-4" />
                  Rebuild
                </Button>
                <CopyButton value={letter.prompt} label="the prompt" />
              </div>
            </Card.Header>
            <Card.Content>
              <TextArea
                value={letter.prompt}
                rows={18}
                aria-label="Prompt"
                onChange={(event) => update({ prompt: event.target.value })}
                variant="secondary"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted">
                Write with Claude sends this box as it stands, so edits here
                reach the model. Rebuild throws them away and reads the prompt
                header, the template and the references again.
              </p>
            </Card.Content>
          </Card>
        </div>

        <Card className="self-start">
          <Card.Header className="flex-row items-start justify-between gap-2">
            <div>
              <Card.Title className="text-base">Letter</Card.Title>
              <Card.Description>
                One box per paragraph, exactly as the PDF lays them out.
                Nothing is written until you save.
              </Card.Description>
            </div>

            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              isPending={is_writing}
              onClick={write_with_claude}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Write with Claude
                </>
              )}
            </Button>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <ParagraphList
              label="Header"
              values={letter.header}
              onChange={(header) => update({ header })}
              rows={5}
            />

            <ParagraphList
              label="Body"
              values={letter.body}
              onChange={(body) => update({ body })}
              placeholder="Paste or write a paragraph..."
              rows={6}
              empty_hint="Nothing written yet. Use Write with Claude, or add a paragraph and type it yourself."
            />

            <ParagraphList
              label="Footer"
              values={letter.footer}
              onChange={(footer) => update({ footer })}
              rows={2}
            />

            {letter.pdf_path && (
              <p className="text-xs text-muted">
                Last built to{" "}
                <code className="font-mono">{letter.pdf_path}</code>
              </p>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- shared bits */

interface ParagraphListProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  rows?: number;
  empty_hint?: string;
}

/** An editable list of paragraphs, which is how the JSON stores a block. */
function ParagraphList({
  label,
  values,
  onChange,
  placeholder,
  rows = 4,
  empty_hint = "Nothing here yet.",
}: ParagraphListProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted">{label}</Label>
        <span className="text-xs text-muted">
          {values.length} {values.length === 1 ? "paragraph" : "paragraphs"}
        </span>
      </div>

      {values.length === 0 && (
        <p className="text-xs italic text-muted">{empty_hint}</p>
      )}

      {values.map((value, index) => (
        <div key={index} className="flex items-start gap-1.5">
          <TextArea
            value={value}
            rows={rows}
            placeholder={placeholder}
            aria-label={`${label} paragraph ${index + 1}`}
            onChange={(event) =>
              onChange(replace_at(values, index, event.target.value))
            }
            variant="secondary"
            className="flex-1"
          />

          <div className="flex flex-col">
            <button
              type="button"
              aria-label={`Move ${label} paragraph ${index + 1} up`}
              disabled={index === 0}
              onClick={() => onChange(move_by(values, index, -1))}
              className="rounded p-1 text-muted transition-colors hover:bg-surface-secondary disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${label} paragraph ${index + 1} down`}
              disabled={index === values.length - 1}
              onClick={() => onChange(move_by(values, index, 1))}
              className="rounded p-1 text-muted transition-colors hover:bg-surface-secondary disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${label} paragraph ${index + 1}`}
              onClick={() => onChange(remove_at(values, index))}
              className="rounded p-1 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 self-start"
        onClick={() => onChange([...values, ""])}
      >
        <Plus className="size-4" />
        Add paragraph
      </Button>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-muted">{label}</Label>
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        variant="secondary"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export default CoverBuilder;
