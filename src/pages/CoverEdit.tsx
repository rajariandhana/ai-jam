import { Button, Card, Label, Spinner, TextArea, toast } from "@heroui/react";
import { ArrowLeft, Check, Copy, FileDown, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { Field } from "../components/ui/Field";
import instance, { error_message } from "../lib/api";

interface CoverState {
  company?: string;
  position?: string;
  prompt?: string;
}

function CoverEdit() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = (location.state ?? {}) as CoverState;

  const [company, set_company] = useState(state.company ?? "");
  const [position, set_position] = useState(state.position ?? "");
  const [prompt, set_prompt] = useState(state.prompt ?? "");

  const [header, set_header] = useState("");
  const [prompt_response, set_prompt_response] = useState("");
  const [footer, set_footer] = useState("");

  const [is_saving, set_is_saving] = useState(false);
  const [is_generating, set_is_generating] = useState(false);
  const [is_copied, set_is_copied] = useState(false);

  useEffect(() => {
    if (!state.company) return;

    instance
      .post("/generate-template", {
        company: state.company,
        position: state.position,
      })
      .then((response) => {
        set_header(response.data.header);
        set_footer(response.data.footer);
      })
      .catch((caught) =>
        toast.danger(error_message(caught, "Could not load the template.")),
      );
  }, [state.company, state.position]);

  async function copy_prompt() {
    await navigator.clipboard.writeText(prompt);
    set_is_copied(true);
    setTimeout(() => set_is_copied(false), 1500);
  }

  async function generate_body() {
    set_is_generating(true);

    try {
      // Claude can take a few minutes; match the backend's own timeout.
      const response = await instance.post(
        "/generate-body",
        { prompt },
        { timeout: 300 * 1000 },
      );
      set_prompt_response(response.data.prompt_response);
      toast.success("Letter written, review it before saving");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not write the letter."));
    } finally {
      set_is_generating(false);
    }
  }

  async function save_as_pdf() {
    set_is_saving(true);

    try {
      await instance.post("/generate-pdf", {
        header,
        prompt_response,
        footer,
        filename: `Cover Letter_Ralfazza Rajariandhana_${company}.pdf`,
      });
      toast.success("Cover letter PDF generated");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not generate the PDF."));
    } finally {
      set_is_saving(false);
    }
  }

  if (!state.prompt) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <Card.Header>
          <Card.Title>No prompt yet</Card.Title>
          <Card.Description>
            Fill in the job details first to generate a prompt.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Button fullWidth onClick={() => navigate("/cover")}>
            <ArrowLeft className="size-4" />
            Back to the form
          </Button>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" isIconOnly onClick={() => navigate("/cover")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {company || "Cover Letter"}
          </h1>
          <p className="text-sm text-muted">{position}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title className="text-base">Prompt</Card.Title>
            <Card.Description>
              Generate the letter with Claude, or copy this into another model
              and bring the reply back.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company" value={company} onChange={set_company} />
              <Field label="Position" value={position} onChange={set_position} />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted">Prompt</Label>
                <Button size="sm" variant="ghost" onClick={copy_prompt}>
                  {is_copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {is_copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <TextArea
                value={prompt}
                onChange={(event) => set_prompt(event.target.value)}
                rows={24}
                aria-label="Prompt"
                variant="secondary"
                className="font-mono text-xs"
              />
            </div>

            <Button
              fullWidth
              isPending={is_generating}
              isDisabled={prompt.trim() === ""}
              onClick={generate_body}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Generate
                </>
              )}
            </Button>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="text-base">Letter</Card.Title>
            <Card.Description>
              Header and footer come from your templates.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted">Header</Label>
              <TextArea
                value={header}
                onChange={(event) => set_header(event.target.value)}
                rows={4}
                aria-label="Header"
                variant="secondary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted">
                Model response
              </Label>
              <TextArea
                value={prompt_response}
                placeholder="Generate the letter, or paste one here..."
                onChange={(event) => set_prompt_response(event.target.value)}
                rows={18}
                aria-label="Model response"
                variant="secondary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted">Footer</Label>
              <TextArea
                value={footer}
                onChange={(event) => set_footer(event.target.value)}
                rows={2}
                aria-label="Footer"
                variant="secondary"
              />
            </div>

            <Button
              fullWidth
              isPending={is_saving}
              isDisabled={prompt_response.trim() === ""}
              onClick={save_as_pdf}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <FileDown className="size-4" />
                  )}
                  Save as PDF
                </>
              )}
            </Button>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

export default CoverEdit;
