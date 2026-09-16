import {
  Button,
  Card,
  Input,
  Label,
  Spinner,
  Switch,
  TextArea,
  toast,
} from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import CoverNav from "../components/CoverNav";
import instance, { error_message } from "../lib/api";
import {
  empty_reference,
  move_by,
  remove_at,
  replace_at,
} from "../lib/cover";
import type { Reference, References } from "../types/cover";

/** The list's column, kept to a readable width at the left edge. */
const CONTENT_WIDTH = "w-full max-w-4xl";

const EMPTY: References = { references: [] };

/** Editor for references.json: the paragraphs the prompt offers as material. */
function ReferencesPage() {
  const [document, set_document] = useState<References>(EMPTY);
  const [saved, set_saved] = useState<References>(EMPTY);

  const [is_loading, set_is_loading] = useState(true);
  const [is_saving, set_is_saving] = useState(false);
  const [load_error, set_load_error] = useState("");
  const [preview, set_preview] = useState("");
  const [is_previewing, set_is_previewing] = useState(false);

  const references = document.references;
  const is_dirty = JSON.stringify(document) !== JSON.stringify(saved);
  const enabled_count = references.filter((entry) => entry.enabled).length;

  useEffect(() => {
    instance
      .get("/cover/references")
      .then((response) => {
        set_document(response.data.data);
        set_saved(response.data.data);
      })
      .catch((caught) =>
        set_load_error(error_message(caught, "Could not load references.json.")),
      )
      .finally(() => set_is_loading(false));
  }, []);

  const set_references = (next: Reference[]) =>
    set_document({ ...document, references: next });

  const update = (index: number, changes: Partial<Reference>) =>
    set_references(
      replace_at(references, index, { ...references[index], ...changes }),
    );

  async function save() {
    set_is_saving(true);

    try {
      const response = await instance.put("/cover/references", {
        data: document,
      });

      set_document(response.data.data);
      set_saved(response.data.data);
      set_preview(response.data.preview);
      toast.success("Saved to references.json");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not save references.json."));
    } finally {
      set_is_saving(false);
    }
  }

  /** Ask the backend how these references read inside the prompt. */
  async function show_preview() {
    set_is_previewing(true);

    try {
      const response = await instance.post("/cover/references/preview", {
        data: document,
      });

      set_preview(response.data.preview);
    } catch (caught) {
      toast.danger(error_message(caught, "Could not build the preview."));
    } finally {
      set_is_previewing(false);
    }
  }

  if (is_loading) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <CoverNav />
        <div className="flex h-64 items-center justify-center gap-2 text-muted">
          <Spinner size="sm" />
          Loading references.json...
        </div>
      </div>
    );
  }

  if (load_error) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <CoverNav />
        <Card className="mx-auto mt-12 max-w-lg">
          <Card.Header>
            <Card.Title>Could not load the references</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-sm text-muted">{load_error}</p>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <CoverNav
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
              isPending={is_previewing}
              onClick={show_preview}
            >
              <Eye className="size-4" />
              Preview
            </Button>
            <Button
              variant="ghost"
              isDisabled={!is_dirty}
              onClick={() => set_document(saved)}
            >
              <RotateCcw className="size-4" />
              Revert
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

      <div className={`flex flex-col gap-4 ${CONTENT_WIDTH}`}>
        <p className="text-sm text-muted">
          Paragraphs you have already written, handed to the model as material it
          may reuse. {enabled_count} of {references.length}{" "}
          {references.length === 1 ? "entry is" : "entries are"} in the prompt;
          switching one off keeps it here but leaves it out.
        </p>

        {references.length === 0 && (
          <Card>
            <Card.Content className="py-8 text-center text-sm text-muted">
              No references yet. Add one to give the model something of your own
              to work from.
            </Card.Content>
          </Card>
        )}

        <div className="flex flex-col gap-2">
          {references.map((reference, index) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              index={index}
              total={references.length}
              onChange={(changes) => update(index, changes)}
              onMove={(offset) =>
                set_references(move_by(references, index, offset))
              }
              onRemove={() => set_references(remove_at(references, index))}
            />
          ))}
        </div>

        <Button
          variant="secondary"
          className="self-start"
          onClick={() => set_references([...references, empty_reference()])}
        >
          <Plus className="size-4" />
          Add reference
        </Button>

        {preview && (
          <Card>
            <Card.Header>
              <Card.Title className="text-base">In the prompt</Card.Title>
              <Card.Description>
                How the enabled references reach the model.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-surface-secondary p-3 font-mono text-xs">
                {preview || "Nothing enabled."}
              </pre>
            </Card.Content>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ReferenceCardProps {
  reference: Reference;
  index: number;
  total: number;
  onChange: (changes: Partial<Reference>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}

/** One reference: collapsed to its title until it is opened for editing. */
function ReferenceCard({
  reference,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: ReferenceCardProps) {
  const [is_open, set_is_open] = useState(reference.content === "");

  const words = reference.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 overflow-hidden text-left"
          onClick={() => set_is_open(!is_open)}
          aria-expanded={is_open}
        >
          {is_open ? (
            <ChevronDown className="size-4 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted" />
          )}
          <span
            className={`truncate text-sm font-medium ${
              reference.enabled ? "" : "text-muted line-through"
            }`}
          >
            {reference.title || "Untitled reference"}
          </span>
        </button>

        {/* Fixed width, so the counts line up down the list. */}
        <span className="w-16 shrink-0 text-right text-xs text-muted">
          {words === 0 ? "empty" : `${words} words`}
        </span>

        <Switch
          isSelected={reference.enabled}
          onChange={(enabled) => onChange({ enabled })}
        >
          <Switch.Content
            aria-label={`Include ${reference.title || "this reference"} in the prompt`}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>

        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Move up"
          isDisabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Move down"
          isDisabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Remove reference"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {is_open && (
        <div className="flex flex-col gap-3 border-t border-border p-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted">Title</Label>
            <Input
              type="text"
              value={reference.title}
              placeholder="Why this kind of work"
              aria-label="Reference title"
              onChange={(event) => onChange({ title: event.target.value })}
              variant="secondary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted">Paragraph</Label>
            <TextArea
              value={reference.content}
              rows={6}
              placeholder="Write the paragraph you want the model to draw on..."
              aria-label="Reference paragraph"
              onChange={(event) => onChange({ content: event.target.value })}
              variant="secondary"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ReferencesPage;
