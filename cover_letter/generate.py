from fpdf import FPDF
from datetime import datetime
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from google import genai

CURRENT_DIR = Path(__file__).resolve().parent
ENV_PATH = CURRENT_DIR.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.5-flash-lite"
NAME = "Ralfazza Rajariandhana"

PROMPT_HEADER_PATH = CURRENT_DIR / "prompt_header.md"
RESUME_PATH = CURRENT_DIR / "../resume/resume.json"
PARAGRAPH_REFERENCE_PATH = CURRENT_DIR / "paragraph_reference.md"
HEADER_PATH = CURRENT_DIR / "header.md"
FOOTER_PATH = CURRENT_DIR / "footer.md"

# The output directory is a setting, so it is read per call rather than frozen
# at import. `settings` lives at the repo root, one level up from here.
sys.path.insert(0, str(CURRENT_DIR.parent))

import settings as app_settings  # noqa: E402


def cover_letter_build_path():
    return app_settings.cover_letter_dir()
PROMPTS_FOLDER_PATH = CURRENT_DIR / "prompts"
PROMPTS_RESPONSE_FOLDER_PATH = CURRENT_DIR / "response"

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


def _ensure_folders():
    for folder in (
        cover_letter_build_path(),
        PROMPTS_FOLDER_PATH,
        PROMPTS_RESPONSE_FOLDER_PATH,
    ):
        os.makedirs(folder, exist_ok=True)


def _next_filename(folder, ext="md"):
    date_str = datetime.now().strftime("%Y_%m_%d")
    counter = 1
    while True:
        filename = f"{date_str}_{counter:02d}.{ext}"
        filepath = os.path.join(folder, filename)
        if not os.path.exists(filepath):
            return filename, filepath
        counter += 1


def resolve_position(position: str) -> str:
    """Accepts either a menu number ('1'-'5') or a raw position title."""
    return POSITION_MAP.get(position, position) or "Software Engineer"


def _apply_replacements(text: str, company: str, position: str) -> str:
    date_str = datetime.now().strftime("%B %d, %Y")
    replacements = {
        "{NAME}": NAME,
        "{DATE}": date_str,
        "{COMPANY}": company,
        "{POSITION}": position,
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def generate_template(company: str, position: str) -> tuple[str, str]:
    """Returns (header, footer) with {NAME}/{DATE}/{COMPANY}/{POSITION} filled in."""
    if not company:
        raise ValueError("Company name is required")

    position = resolve_position(position)

    header = _apply_replacements(_read(HEADER_PATH), company, position)
    footer = _apply_replacements(_read(FOOTER_PATH), company, position)
    return header, footer


def _build_pdf(pdf_content: str, pdf_filename: str) -> str:
    _ensure_folders()

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    margin_mm = 12.7  # 0.5 inches
    pdf.set_margins(left=margin_mm, top=margin_mm, right=margin_mm)
    pdf.set_auto_page_break(auto=True, margin=margin_mm)
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(w=0, h=6, text=pdf_content, align="J")

    pdf_filepath = os.path.join(cover_letter_build_path(), pdf_filename)
    pdf.output(pdf_filepath)
    return pdf_filepath


def generate_pdf_from_texts(header: str, prompt_response: str, footer: str, filename: str) -> str:
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
    pdf_filename = ""
    if filename:
      pdf_filename = filename
    else:
      pdf_filename, _ = _next_filename(cover_letter_build_path(), ext="pdf")
    return _build_pdf(pdf_content, pdf_filename)


def generate_prompt(company: str, position: str, job_description: str, request_note: str = "") -> str:
    if not company:
        raise ValueError("Company name is required")
    if not job_description:
        raise ValueError("Job description is required")

    # Make sure every folder we'll need later actually exists.
    _ensure_folders()

    prompt_header = _read(PROMPT_HEADER_PATH)
    resume = _read(RESUME_PATH)
    paragraph_reference = _read(PARAGRAPH_REFERENCE_PATH)
    header = _read(HEADER_PATH)
    footer = _read(FOOTER_PATH)

    prompt = f"""{prompt_header}

1. My full resume in JSON
```
{resume}
```

2. Job description
```
{job_description}
```

3. Cover letter template
Header
```
{header}
```

Footer
```
{footer}
```

4. Paragraphs to reference of
```
{paragraph_reference}
```

5. Request
```
{request_note}
```"""
    return prompt


def generate_cover_letter(company: str, position: str, job_description: str, request_note: str = "") -> str:
    if not company:
        raise ValueError("Company name is required")
    if not job_description:
        raise ValueError("Job description is required")

    position = resolve_position(position)
    # generate_prompt() returns a plain string, not a dict — don't index it.
    prompt = generate_prompt(company, position, job_description, request_note)

    filename, prompt_filepath = _next_filename(PROMPTS_FOLDER_PATH)
    with open(prompt_filepath, "w", encoding="utf-8") as f:
        f.write(prompt)

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    prompt_response = response.text

    response_path = os.path.join(PROMPTS_RESPONSE_FOLDER_PATH, filename)
    with open(response_path, "w", encoding="utf-8") as f:
        f.write(prompt_response)

    header, footer = generate_template(company, position)
    pdf_content = f"""{header}

{prompt_response}

{footer}"""

    pdf_filename = filename.replace(".md", ".pdf")
    return _build_pdf(pdf_content, pdf_filename)