import { Button, Card, Spinner } from "@heroui/react";
import { FileText, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import instance, { error_message } from "../lib/api";
import { format_bytes, format_date } from "../lib/resume";
import type { BuildFile, DashboardData } from "../types/resume";

function Dashboard() {
  const [data, set_data] = useState<DashboardData | null>(null);
  const [error, set_error] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    instance
      .get("/dashboard")
      .then((response) => set_data(response.data))
      .catch((caught) =>
        set_error(error_message(caught, "Could not reach the API.")),
      );
  }, []);

  if (error) {
    return (
      <Card className="mx-auto mt-12 max-w-lg">
        <Card.Header>
          <Card.Title>Backend unavailable</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">{error}</p>
          <p className="mt-2 text-sm text-muted">
            Start it with <code className="font-mono">uvicorn app:app</code>{" "}
            inside <code className="font-mono">cover_letter/</code>.
          </p>
        </Card.Content>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted">
        <Spinner size="sm" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {data.profile.name || "AI JAM"}
        </h1>
        <p className="text-sm text-muted">{data.profile.email}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              Resume
            </Card.Title>
            <Card.Description>
              Edit resume.json and preview the compiled PDF before saving.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {data.presets.map((preset) => (
                <span
                  key={preset}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                >
                  {preset}
                </span>
              ))}
            </div>
            <Button fullWidth onClick={() => navigate("/resume")}>
              Open editor
            </Button>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <PenLine className="size-4" />
              Cover Letter
            </Card.Title>
            <Card.Description>
              Turn a job description into a tailored cover letter PDF.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Button fullWidth variant="secondary" onClick={() => navigate("/cover")}>
              Start a letter
            </Button>
          </Card.Content>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BuildList title="Recent resumes" builds={data.resume_builds} />
        <BuildList
          title="Recent cover letters"
          builds={data.cover_letter_builds}
        />
      </div>
    </div>
  );
}

function BuildList({ title, builds }: { title: string; builds: BuildFile[] }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title className="text-base">{title}</Card.Title>
      </Card.Header>
      <Card.Content>
        {builds.length === 0 ? (
          <p className="text-sm text-muted italic">Nothing built yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {builds.map((build) => (
              <li
                key={build.name}
                className="flex items-center justify-between gap-4 py-2"
              >
                <span className="truncate text-sm">{build.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {format_date(build.modified)} · {format_bytes(build.size)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}

export default Dashboard;
