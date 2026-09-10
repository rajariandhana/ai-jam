import {
  Button,
  Card,
  Label,
  Radio,
  RadioGroup,
  Spinner,
  TextArea,
  toast,
} from "@heroui/react";
import { Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Field } from "../components/ui/Field";
import instance, { error_message } from "../lib/api";

const DEFAULT_POSITION = "Software Engineer";

const POSITION_OPTIONS = [
  "Software Engineer",
  "Software Developer",
  "Game Developer",
  "Other",
];

function Cover() {
  const [company, set_company] = useState("");
  const [position, set_position] = useState(DEFAULT_POSITION);
  const [other_position, set_other_position] = useState("");
  const [description, set_description] = useState("");
  const [request_note, set_request_note] = useState("");

  const [is_generating, set_is_generating] = useState(false);
  const [is_prompting, set_is_prompting] = useState(false);

  const navigate = useNavigate();

  const chosen_position = position === "Other" ? other_position : position;

  const is_valid =
    company.trim() !== "" &&
    description.trim() !== "" &&
    chosen_position.trim() !== "";

  const payload = () => ({
    company,
    position: chosen_position,
    job_description: description,
    request_note,
  });

  async function generate_prompt() {
    if (!is_valid) return;

    set_is_prompting(true);

    try {
      const response = await instance.post("/generate-prompt", payload());

      navigate("/cover/edit", {
        state: { ...payload(), prompt: response.data.prompt },
      });
    } catch (caught) {
      toast.danger(error_message(caught, "Could not generate the prompt."));
    } finally {
      set_is_prompting(false);
    }
  }

  async function generate() {
    if (!is_valid) return;

    set_is_generating(true);

    try {
      await instance.post("/generate", payload());
      toast.success("Cover letter generated");
      set_company("");
      set_position(DEFAULT_POSITION);
      set_description("");
      set_request_note("");
    } catch (caught) {
      toast.danger(error_message(caught, "Could not generate the letter."));
    } finally {
      set_is_generating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cover Letter</h1>
        <p className="text-sm text-muted">
          Describe the role, then either let the model write it or copy the
          prompt out and paste the reply back.
        </p>
      </div>

      <Card>
        <Card.Content className="flex flex-col gap-4 py-4">
          <Field
            label="Company"
            value={company}
            onChange={set_company}
            placeholder="Facebook/Apple/Amazon/Netflix/Google/..."
          />

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted">Position</Label>
            <RadioGroup
              value={position}
              onChange={set_position}
              aria-label="Position"
            >
              {POSITION_OPTIONS.map((option) => (
                <Radio key={option} value={option}>
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    {option}
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>

            {position === "Other" && (
              <Field
                label="Custom position"
                value={other_position}
                onChange={set_other_position}
                placeholder="Enter your position"
                className="mt-2"
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted">
              Job description
            </Label>
            <TextArea
              value={description}
              placeholder="Paste the posting here..."
              onChange={(event) => set_description(event.target.value)}
              rows={10}
              aria-label="Job description"
              variant="secondary"
            />
          </div>

          <Field
            label="Prompt request note"
            value={request_note}
            onChange={set_request_note}
            placeholder="Make it sarcastic..."
          />

          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              isPending={is_prompting}
              isDisabled={!is_valid}
              onClick={generate_prompt}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  Generate prompt
                </>
              )}
            </Button>

            <Button
              className="flex-1"
              variant="secondary"
              isPending={is_generating}
              isDisabled={!is_valid}
              onClick={generate}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Auto process
                </>
              )}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

export default Cover;
