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

import CoverNav from "../components/CoverNav";
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

  /** Save the job details as a letter and open it in the builder. */
  async function start_letter() {
    if (!is_valid) return;

    set_is_prompting(true);

    try {
      const response = await instance.post("/cover/letters", payload());

      navigate(`/cover/builder/${response.data.letter.id}`);
    } catch (caught) {
      toast.danger(error_message(caught, "Could not start the letter."));
    } finally {
      set_is_prompting(false);
    }
  }

  /** Let Claude write the body straight away, then open what it wrote. */
  async function generate() {
    if (!is_valid) return;

    set_is_generating(true);

    try {
      // Claude can take a few minutes; match the backend's own timeout.
      const response = await instance.post("/generate", payload(), {
        timeout: 300 * 1000,
      });

      toast.success("Cover letter generated");
      navigate(`/cover/builder/${response.data.id}`);
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
          Describe the role, then either let Claude write it or build the
          prompt and paste a reply back in the builder.
        </p>
      </div>

      <CoverNav />

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
              onClick={start_letter}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  Next
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
