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
  ChevronUp,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import CoverNav from "../components/CoverNav";
import instance, { error_message } from "../lib/api";
import {
  EMPTY_PROMPT_HEADER,
  INPUT_HINTS,
  missing_inputs,
  move_by,
  remove_at,
  render_prompt_header,
  replace_at,
} from "../lib/cover";
import type { InputKey, PromptHeader, PromptInput } from "../types/cover";

/** Editor for prompt_header.json, the instructions that open every prompt. */
function PromptHeaderPage() {
  const [header, set_header] = useState<PromptHeader>(EMPTY_PROMPT_HEADER);
  const [saved, set_saved] = useState<PromptHeader>(EMPTY_PROMPT_HEADER);

  const [is_loading, set_is_loading] = useState(true);
  const [is_saving, set_is_saving] = useState(false);
  const [load_error, set_load_error] = useState("");

  const is_dirty = JSON.stringify(header) !== JSON.stringify(saved);

  useEffect(() => {
    instance
      .get("/cover/prompt-header")
      .then((response) => {
        set_header(response.data.data);
        set_saved(response.data.data);
      })
      .catch((caught) =>
        set_load_error(
          error_message(caught, "Could not load prompt_header.json."),
        ),
      )
      .finally(() => set_is_loading(false));
  }, []);

  const update = (changes: Partial<PromptHeader>) =>
    set_header({ ...header, ...changes });

  const set_input = (index: number, changes: Partial<PromptInput>) =>
    update({
      inputs: replace_at(header.inputs, index, {
        ...header.inputs[index],
        ...changes,
      }),
    });

  async function save() {
    set_is_saving(true);

    try {
      const response = await instance.put("/cover/prompt-header", {
        data: header,
      });

      set_header(response.data.data);
      set_saved(response.data.data);
      toast.success("Saved to prompt_header.json");
    } catch (caught) {
      toast.danger(
        error_message(caught, "Could not save prompt_header.json."),
      );
    } finally {
      set_is_saving(false);
    }
  }

  if (is_loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted">
        <Spinner size="sm" />
        Loading prompt_header.json...
      </div>
    );
  }

  if (load_error) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <Card.Header>
          <Card.Title>Could not load the prompt header</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">{load_error}</p>
        </Card.Content>
      </Card>
    );
  }

  const missing = missing_inputs(header.inputs);

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Prompt header</h1>
          {is_dirty && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-foreground">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            isDisabled={!is_dirty}
            onClick={() => set_header(saved)}
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
        </div>
      </div>

      <CoverNav />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <Card.Header>
              <Card.Title className="text-base">Opening</Card.Title>
              <Card.Description>
                The first lines of every prompt, before the numbered list.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <TextField
                label="Role"
                value={header.role}
                onChange={(role) => update({ role })}
                placeholder="You are an AI tool to help me..."
              />
              <TextField
                label="About me"
                value={header.about}
                onChange={(about) => update({ about })}
                placeholder="I am a Computer Science fresh graduate."
              />
              <TextField
                label="Intro to the list"
                value={header.inputs_intro}
                onChange={(inputs_intro) => update({ inputs_intro })}
                placeholder="Below I provide:"
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">Sections</Card.Title>
              <Card.Description>
                These are numbered in the header and filled in below it in the
                same order, so section 3 of the list is section 3 of the
                content. Switching one off leaves it out of both.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
              {header.inputs.map((entry, index) => (
                <div
                  key={entry.key}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center font-mono text-xs text-muted">
                      {header.inputs
                        .filter((other) => other.enabled)
                        .indexOf(entry) + 1 || "-"}
                    </span>

                    <Input
                      type="text"
                      aria-label={`Section ${index + 1} label`}
                      value={entry.label}
                      placeholder="What this section is called"
                      onChange={(event) =>
                        set_input(index, { label: event.target.value })
                      }
                      variant="secondary"
                      className="flex-1"
                    />

                    <Switch
                      isSelected={entry.enabled}
                      onChange={(enabled) => set_input(index, { enabled })}
                    >
                      <Switch.Content
                        aria-label={`Include ${entry.label || entry.key} in the prompt`}
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
                      onClick={() =>
                        update({ inputs: move_by(header.inputs, index, -1) })
                      }
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label="Move down"
                      isDisabled={index === header.inputs.length - 1}
                      onClick={() =>
                        update({ inputs: move_by(header.inputs, index, 1) })
                      }
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label={`Remove ${entry.label || entry.key}`}
                      onClick={() =>
                        update({ inputs: remove_at(header.inputs, index) })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <Input
                    type="text"
                    aria-label={`Section ${index + 1} description`}
                    value={entry.description}
                    placeholder="How to read it (optional)"
                    onChange={(event) =>
                      set_input(index, { description: event.target.value })
                    }
                    variant="secondary"
                  />

                  <p className="text-xs text-muted">
                    Carries {INPUT_HINTS[entry.key]}.
                  </p>
                </div>
              ))}

              {missing.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-muted">Add back:</span>
                  {missing.map((key) => (
                    <Button
                      key={key}
                      size="sm"
                      variant="ghost"
                      onClick={() => update({ inputs: [...header.inputs, blank_input(key)] })}
                    >
                      <Plus className="size-4" />
                      {key}
                    </Button>
                  ))}
                </div>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">Instructions</Card.Title>
              <Card.Description>
                One rule per line. They are joined into the paragraph that
                closes the header.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
              {header.instructions.length === 0 && (
                <p className="text-xs italic text-muted">Nothing here yet.</p>
              )}

              {header.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-1.5">
                  <TextArea
                    value={instruction}
                    rows={2}
                    aria-label={`Instruction ${index + 1}`}
                    placeholder="Mention why I am interested in the role."
                    onChange={(event) =>
                      update({
                        instructions: replace_at(
                          header.instructions,
                          index,
                          event.target.value,
                        ),
                      })
                    }
                    variant="secondary"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    aria-label={`Remove instruction ${index + 1}`}
                    onClick={() =>
                      update({
                        instructions: remove_at(header.instructions, index),
                      })
                    }
                    className="mt-1.5 rounded p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="mt-1 self-start"
                onClick={() =>
                  update({ instructions: [...header.instructions, ""] })
                }
              >
                <Plus className="size-4" />
                Add instruction
              </Button>
            </Card.Content>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-18 xl:self-start">
          <Card.Header>
            <Card.Title className="text-base">Preview</Card.Title>
            <Card.Description>
              What the model is told before it sees any of your content.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface-secondary p-3 font-mono text-xs">
              {render_prompt_header(header)}
            </pre>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

function blank_input(key: InputKey): PromptInput {
  return { key, label: key, description: "", enabled: true };
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TextField({ label, value, onChange, placeholder }: TextFieldProps) {
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
    </div>
  );
}

export default PromptHeaderPage;
