import { Button, Card, InputGroup, Label, Spinner, toast } from "@heroui/react";
import {
  Check,
  ChevronRight,
  CornerLeftUp,
  FileText,
  FolderOpen,
  Home,
  PenLine,
  RotateCcw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";

import { CopyButton } from "../components/ui/CopyButton";
import instance, { error_message } from "../lib/api";

interface Settings {
  resume_dir: string;
  cover_letter_dir: string;
}

type SettingKey = keyof Settings;

const FIELDS: {
  key: SettingKey;
  label: string;
  hint: string;
  icon: typeof FileText;
}[] = [
  {
    key: "resume_dir",
    label: "Resume folder",
    hint: "Where Build PDF writes resumes.",
    icon: FileText,
  },
  {
    key: "cover_letter_dir",
    label: "Cover letter folder",
    hint: "Where generated cover letters are saved.",
    icon: PenLine,
  },
];

const EMPTY: Settings = { resume_dir: "", cover_letter_dir: "" };

function SettingsPage() {
  const [settings, set_settings] = useState<Settings>(EMPTY);
  const [saved, set_saved] = useState<Settings>(EMPTY);
  const [defaults, set_defaults] = useState<Settings>(EMPTY);

  const [is_loading, set_is_loading] = useState(true);
  const [is_saving, set_is_saving] = useState(false);
  const [load_error, set_load_error] = useState("");

  const [browsing, set_browsing] = useState<SettingKey | null>(null);

  const is_dirty = FIELDS.some(({ key }) => settings[key] !== saved[key]);

  useEffect(() => {
    instance
      .get("/settings")
      .then((response) => {
        set_settings(response.data.settings);
        set_saved(response.data.settings);
        set_defaults(response.data.defaults);
      })
      .catch((caught) =>
        set_load_error(error_message(caught, "Could not load settings.")),
      )
      .finally(() => set_is_loading(false));
  }, []);

  async function save() {
    set_is_saving(true);

    try {
      const response = await instance.put("/settings", settings);
      set_settings(response.data.settings);
      set_saved(response.data.settings);
      toast.success("Settings saved");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not save settings."));
    } finally {
      set_is_saving(false);
    }
  }

  if (is_loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted">
        <Spinner size="sm" />
        Loading settings...
      </div>
    );
  }

  if (load_error) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <Card.Header>
          <Card.Title>Could not load settings</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">{load_error}</p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          {is_dirty && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-foreground">
              Unsaved changes
            </span>
          )}
        </div>

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

      {FIELDS.map(({ key, label, hint, icon: Icon }) => (
        <Card key={key}>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <Icon className="size-4" />
              {label}
            </Card.Title>
            <Card.Description>{hint}</Card.Description>
          </Card.Header>

          <Card.Content className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted">Folder</Label>
              <InputGroup variant="secondary">
                <InputGroup.Input
                  type="text"
                  aria-label={label}
                  value={settings[key]}
                  placeholder={defaults[key]}
                  onChange={(event) =>
                    set_settings((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="font-mono text-xs"
                />
                <InputGroup.Suffix>
                  <CopyButton value={settings[key]} label={label} />
                </InputGroup.Suffix>
              </InputGroup>
            </div>

            <PathStatus path={settings[key]} />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => set_browsing(browsing === key ? null : key)}
              >
                <FolderOpen className="size-4" />
                {browsing === key ? "Close browser" : "Browse"}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                isDisabled={settings[key] === defaults[key]}
                onClick={() =>
                  set_settings((current) => ({ ...current, [key]: defaults[key] }))
                }
              >
                <RotateCcw className="size-4" />
                Reset to default
              </Button>
            </div>

            {browsing === key && (
              <DirectoryBrowser
                start={settings[key]}
                on_pick={(path) => {
                  set_settings((current) => ({ ...current, [key]: path }));
                  set_browsing(null);
                }}
              />
            )}
          </Card.Content>
        </Card>
      ))}

      <p className="text-xs text-muted">
        Folders are created when they are first written to. Paths are stored in
        settings.json at the project root, which is not committed.
      </p>
    </div>
  );
}

/** Live feedback on whether a typed path can actually be written to. */
function PathStatus({ path }: { path: string }) {
  const trimmed = path.trim();

  // The queried path is kept alongside the answer so a stale result is never
  // shown against a path the user has since changed.
  const [state, set_state] = useState<{
    for_path: string;
    resolved: string;
    exists: boolean;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (trimmed === "") {
      return;
    }

    let cancelled = false;

    // Wait for typing to settle before asking the backend about the path.
    const timer = setTimeout(() => {
      instance
        .post("/settings/check-dir", { path: trimmed })
        .then((response) => {
          if (cancelled) return;

          set_state({
            for_path: trimmed,
            resolved: response.data.path,
            exists: response.data.exists,
            error: "",
          });
        })
        .catch((caught) => {
          if (cancelled) return;

          set_state({
            for_path: trimmed,
            resolved: "",
            exists: false,
            error: error_message(caught, "Could not check that folder."),
          });
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  if (trimmed === "" || state?.for_path !== trimmed) {
    return null;
  }

  if (state.error) {
    return <p className="text-xs text-danger">{state.error}</p>;
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      {state.exists ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <FolderOpen className="size-3.5" />
      )}
      <span className="font-mono">{state.resolved}</span>
      <span>{state.exists ? "· ready" : "· will be created"}</span>
    </p>
  );
}

interface BrowseState {
  path: string;
  parent: string | null;
  home: string;
  entries: string[];
}

function DirectoryBrowser({
  start,
  on_pick,
}: {
  start: string;
  on_pick: (path: string) => void;
}) {
  const [state, set_state] = useState<BrowseState | null>(null);
  const [error, set_error] = useState("");
  const [target, set_target] = useState(start);

  useEffect(() => {
    let cancelled = false;

    instance
      .post("/settings/browse", { path: target })
      .then((response) => {
        if (!cancelled) {
          set_state(response.data);
          set_error("");
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          set_error(error_message(caught, "Could not open that folder."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  const join = (name: string) =>
    `${state?.path.replace(/\/$/, "") ?? ""}/${name}`;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="Home folder"
          onClick={() => state && set_target(state.home)}
        >
          <Home className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="Parent folder"
          isDisabled={!state?.parent}
          onClick={() => state?.parent && set_target(state.parent)}
        >
          <CornerLeftUp className="size-4" />
        </Button>

        <span className="flex-1 truncate font-mono text-xs text-muted">
          {state?.path ?? target}
        </span>

        <Button
          size="sm"
          isDisabled={!state}
          onClick={() => state && on_pick(state.path)}
        >
          Use this folder
        </Button>
      </div>

      {error && <p className="p-3 text-xs text-danger">{error}</p>}

      <div className="max-h-64 overflow-y-auto">
        {state?.entries.length === 0 && !error && (
          <p className="p-3 text-xs italic text-muted">No subfolders here.</p>
        )}

        {state?.entries.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => set_target(join(name))}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-surface-secondary"
          >
            <FolderOpen className="size-4 shrink-0 text-muted" />
            <span className="flex-1 truncate">{name}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default SettingsPage;
