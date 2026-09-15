from fpdf import FPDF
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from dotenv import load_dotenv

import documents

CURRENT_DIR = Path(__file__).resolve().parent
ENV_PATH = CURRENT_DIR.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# Letters are written by the Claude Code CLI on this machine, so they run on the
# logged-in Claude subscription rather than an API key.
CLAUDE_MODEL = "opus"
CLAUDE_TIMEOUT = 300

RESUME_PATH = CURRENT_DIR / "../resume/resume.json"

# The output directory is a setting, so it is read per call rather than frozen
# at import. `settings` lives at the repo root, one level up from here.
sys.path.insert(0, str(CURRENT_DIR.parent))

import settings as app_settings  # noqa: E402


def cover_letter_build_path():
    return app_settings.cover_letter_dir()


POSITION_MAP = {
    "1": "Software Engineer",
    "": "Software Engineer",
    "2": "Graduate Software Engineer",
    "3": "Software Developer",
    "4": "Graduate Software Developer",
    "5": "Game Developer",
}


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def resolve_position(position: str) -> str:
    """Accepts either a menu number ('1'-'5') or a raw position title."""
    return POSITION_MAP.get(position, position) or "Software Engineer"


def generate_template(company: str, position: str) -> tuple[str, str]:
    """Returns (header, footer) with {NAME}/{DATE}/{COMPANY}/{POSITION} filled in."""
    header, footer = template_blocks(company, position)

    return documents.render_block(header), documents.render_block(footer)


def template_blocks(company: str, position: str) -> tuple[list[str], list[str]]:
    """The same header and footer, kept as the paragraphs a letter stores."""
    if not company:
        raise ValueError("Company name is required")

    position = resolve_position(position)
    template = documents.load_template()
    name = template["name"]

    return (
        documents.resolve_block(template["header"], name, company, position),
        documents.resolve_block(template["footer"], name, company, position),
    )


def letter_filename(company: str, position: str) -> str:
    """The PDF name the template asks for, without the extension."""
    template = documents.load_template()

    filename = documents.apply_placeholders(
        template["filename"],
        template["name"],
        company,
        resolve_position(position),
    ).strip()

    # A path separator in the name would write outside the build folder.
    return filename.replace("/", "-").replace("\\", "-") or "Cover Letter"


def _build_pdf(pdf_content: str, pdf_filename: str) -> str:
    folder = cover_letter_build_path()

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    margin_mm = 12.7  # 0.5 inches
    pdf.set_margins(left=margin_mm, top=margin_mm, right=margin_mm)
    pdf.set_auto_page_break(auto=True, margin=margin_mm)
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(w=0, h=6, text=pdf_content, align="J")

    if not pdf_filename.lower().endswith(".pdf"):
        pdf_filename = f"{pdf_filename}.pdf"

    pdf_filepath = os.path.join(folder, pdf_filename)
    pdf.output(pdf_filepath)
    return pdf_filepath


def build_letter_pdf(letter: dict) -> str:
    """Render a saved letter's header, body and footer into one PDF."""
    letter = documents.normalise_letter(letter)

    header = letter["header"]
    body = letter["body"]
    footer = letter["footer"]

    if not header:
        raise ValueError("Header is required")
    if not body:
        raise ValueError("Body is required")
    if not footer:
        raise ValueError("Footer is required")

    filename = letter["filename"] or letter_filename(
        letter["company"], letter["position"]
    )

    return _build_pdf("\n\n".join(header + body + footer), filename)


def generate_pdf_from_texts(
    header: str, prompt_response: str, footer: str, filename: str
) -> str:
    """Builds the cover letter PDF from already-finalized header/body/footer text
    (no {PLACEHOLDER} replacement is performed here)."""
    if not header:
        raise ValueError("Header is required")
    if not prompt_response:
        raise ValueError("Prompt response is required")
    if not footer:
        raise ValueError("Footer is required")

    pdf_content = f"""{header}

{prompt_response}

{footer}"""

    return _build_pdf(pdf_content, filename or "Cover Letter")


def _find_claude():
    found = shutil.which("claude")
    if found:
        return found

    # The backend may be started with a PATH that misses the default install.
    fallback = Path.home() / ".local" / "bin" / "claude"
    if fallback.exists():
        return str(fallback)

    raise RuntimeError(
        "Claude Code CLI not found. Install it and run `claude auth login`."
    )


def _ask_claude(system_prompt: str, prompt: str) -> str:
    """One stateless Claude call. Nothing from other runs can reach it: it runs
    in a throwaway directory with no tools, MCP servers, settings, memory or
    saved session, so the prompt is the only context it has."""
    command = [
        _find_claude(),
        "-p",
        "--no-session-persistence",
        "--tools", "",
        "--strict-mcp-config",
        "--setting-sources", "",
        "--system-prompt", system_prompt,
        "--model", CLAUDE_MODEL,
        "--output-format", "json",
    ]
    env = {**os.environ, "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1"}

    with tempfile.TemporaryDirectory(prefix="ai-jam-cover-") as workdir:
        try:
            completed = subprocess.run(
                command,
                input=prompt,
                capture_output=True,
                text=True,
                timeout=CLAUDE_TIMEOUT,
                cwd=workdir,
                env=env,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Claude did not answer within {CLAUDE_TIMEOUT} seconds")

    try:
        output = json.loads(completed.stdout)
    except json.JSONDecodeError:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"Claude failed: {detail or 'no output'}")

    result = (output.get("result") or "").strip()
    if output.get("is_error") or completed.returncode != 0:
        raise RuntimeError(f"Claude failed: {result or completed.stderr.strip()}")
    if not result:
        raise RuntimeError("Claude returned an empty letter")

    return result


def _prompt_contents(company: str, position: str, job_description: str, request_note: str):
    """What each numbered section of the prompt carries, keyed by section."""
    header, footer = template_blocks(company, position)

    template_text = "\n\n".join(
        [
            "Header",
            documents.render_block(header),
            "Footer",
            documents.render_block(footer),
        ]
    )

    return {
        "resume": _read(RESUME_PATH),
        "job_description": job_description,
        "template": template_text,
        "references": documents.render_references(),
        "request": request_note,
    }


def _prompt_parts(company: str, position: str, job_description: str, request_note: str):
    """The instruction block and the content block, which are sent separately:
    the instructions become Claude's system prompt and the contents the message."""
    prompt_header = documents.load_prompt_header()
    contents = _prompt_contents(company, position, job_description, request_note)

    return (
        documents.render_prompt_header(prompt_header),
        documents.render_prompt_body(contents, prompt_header),
    )


def generate_prompt(
    company: str, position: str, job_description: str, request_note: str = ""
) -> str:
    if not company:
        raise ValueError("Company name is required")
    if not job_description:
        raise ValueError("Job description is required")

    instructions, body = _prompt_parts(company, position, job_description, request_note)

    return f"""{instructions}

{body}"""


# The prompt carries its own instructions when it has been edited by hand, so
# Claude is told only to follow them.
EDITED_PROMPT_SYSTEM = (
    "Follow the instructions in the message and return only the text asked for."
)


def generate_body(prompt: str) -> list[str]:
    """Run a prompt the builder may have edited and hand the text back as the
    paragraphs a letter stores, so it can be reviewed before any PDF is built.

    The whole prompt is the message here, rather than the instruction block
    plus the data sections, because the point is to send exactly what is on
    the page. The letter JSON keeps both the prompt and the answer.
    """
    if not prompt.strip():
        raise ValueError("Prompt is required")

    return documents.split_paragraphs(_ask_claude(EDITED_PROMPT_SYSTEM, prompt))


def write_body(
    company: str, position: str, job_description: str, request_note: str = ""
) -> list[str]:
    """Ask Claude for the body text, built fresh from the job details."""
    if not company:
        raise ValueError("Company name is required")
    if not job_description:
        raise ValueError("Job description is required")

    instructions, body = _prompt_parts(company, position, job_description, request_note)

    return documents.split_paragraphs(_ask_claude(instructions, body))


def generate_cover_letter(
    company: str, position: str, job_description: str, request_note: str = ""
) -> dict:
    """Write the letter with Claude, save it as JSON and build its PDF."""
    position = resolve_position(position)

    body = write_body(company, position, job_description, request_note)
    header, footer = template_blocks(company, position)

    letter = documents.save_letter(
        {
            "company": company,
            "position": position,
            "job_description": job_description,
            "request_note": request_note,
            "prompt": generate_prompt(company, position, job_description, request_note),
            "header": header,
            "body": body,
            "footer": footer,
            "filename": letter_filename(company, position),
        }
    )

    letter["pdf_path"] = str(build_letter_pdf(letter))

    return documents.save_letter(letter)
