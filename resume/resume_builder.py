"""Pure functions for reading, writing and rendering the resume.

Kept free of any prompting or CLI concerns so it can be imported by both
`resume.py` (interactive) and the FastAPI app (`cover_letter/app.py`).
"""

import copy
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent

RESUME_PATH = CURRENT_DIR / "resume.json"
PRESET_PATH = CURRENT_DIR / "preset.json"
DOC_SETTINGS_PATH = CURRENT_DIR / "doc_settings"
# The output directory is a setting, so it is read per call rather than frozen
# at import. `settings` lives at the repo root, one level up from here.
sys.path.insert(0, str(CURRENT_DIR.parent))

import settings as app_settings  # noqa: E402


def build_dir():
    return app_settings.resume_dir()

# Every section the template knows how to render, in the order used when
# resume.json says nothing about sections.
SECTION_KEYS = ("summary", "education", "projects", "experience", "skills")

SECTION_TITLES = {
    "summary": "Summary",
    "education": "Education",
    "projects": "Projects",
    "experience": "Experience",
    "skills": "Skills",
}


def load_resume():
    with open(RESUME_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def save_resume(data):
    """Write resume.json atomically so a failed write cannot truncate it."""
    RESUME_PATH.parent.mkdir(parents=True, exist_ok=True)

    handle, tmp_path = tempfile.mkstemp(
        dir=str(RESUME_PATH.parent), suffix=".json.tmp"
    )

    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
            file.write("\n")

        os.replace(tmp_path, RESUME_PATH)
    except Exception:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def load_presets():
    if not PRESET_PATH.exists():
        return {}

    with open(PRESET_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def apply_preset(data, preset_name):
    """Return (projects, experience) filtered by a named preset.

    An unknown or empty preset name means 'everything'.
    """
    projects = data.get("projects", [])
    experience = data.get("experience", [])

    if not preset_name:
        return projects, experience

    presets = load_presets()
    config = presets.get(preset_name)

    if config is None:
        return projects, experience

    selected_projects = [
        project for project in projects if project.get("name") in config["projects"]
    ]

    selected_experience = [
        job for job in experience if job.get("position") in config["experience"]
    ]

    return selected_projects, selected_experience


# The field that identifies an entry when a preset names the ones to keep.
PRESET_ITEM_FIELDS = {
    "education": "university",
    "projects": "name",
    "experience": "position",
    "skills": "category",
}


def normalise_sections(data):
    """`data["sections"]` as a full ordered list of {key, enabled}.

    Unknown and repeated keys are dropped; known keys the config never mentions
    are appended enabled, matching `resolve_sections`.
    """
    ordered = []
    mentioned = set()

    for entry in data.get("sections") or []:
        if isinstance(entry, dict):
            key = entry.get("key")
            enabled = bool(entry.get("enabled", True))
        else:
            key, enabled = entry, True

        if key not in SECTION_KEYS or key in mentioned:
            continue

        mentioned.add(key)
        ordered.append({"key": key, "enabled": enabled})

    for key in SECTION_KEYS:
        if key not in mentioned:
            ordered.append({"key": key, "enabled": True})

    return ordered


def set_item_enabled(item, enabled):
    """Mirror the editor: only an excluded entry carries the flag."""
    if enabled:
        item.pop("enabled", None)
    else:
        item["enabled"] = False


def preset_sections(data, config):
    """The section list a preset asks for, falling back to everything on.

    A preset that lists `sections` decides both which ones render and their
    order; anything it leaves out is switched off. A preset that says nothing
    turns every section on without disturbing the order already in the file.
    """
    wanted = (config or {}).get("sections")
    current = normalise_sections(data)

    if wanted is None:
        return [{"key": entry["key"], "enabled": True} for entry in current]

    ordered = []
    seen = set()

    for key in wanted:
        if key in SECTION_KEYS and key not in seen:
            seen.add(key)
            ordered.append({"key": key, "enabled": True})

    for entry in current:
        if entry["key"] not in seen:
            ordered.append({"key": entry["key"], "enabled": False})

    return ordered


def apply_preset_layout(data, preset_name):
    """Return a copy of `data` with its layout switched to match a preset.

    A preset lists what to keep, so every section it names has the unlisted
    entries switched off, while a section it says nothing about keeps all of
    its entries. An empty or unknown preset name turns everything back on.
    """
    result = copy.deepcopy(data)

    config = load_presets().get(preset_name) if preset_name else None

    for key, field in PRESET_ITEM_FIELDS.items():
        wanted = config.get(key) if config else None

        for item in result.get(key) or []:
            set_item_enabled(item, True if wanted is None else item.get(field) in wanted)

    result["sections"] = preset_sections(data, config)

    return result


def default_sections():
    """Every section, enabled, in the template's own order."""
    return [{"key": key, "enabled": True} for key in SECTION_KEYS]


def resolve_sections(data):
    """The section keys to render, in order, honouring `data["sections"]`.

    Entries naming an unknown section are ignored, and any known section the
    config never mentions is appended so a resume.json written before a new
    section existed still renders it.
    """
    config = data.get("sections") or []

    ordered = []
    mentioned = set()

    for entry in config:
        if isinstance(entry, dict):
            key = entry.get("key")
            enabled = entry.get("enabled", True)
        else:
            key, enabled = entry, True

        if key not in SECTION_KEYS or key in mentioned:
            continue

        mentioned.add(key)

        if enabled:
            ordered.append(key)

    for key in SECTION_KEYS:
        if key not in mentioned:
            ordered.append(key)

    return ordered


def latex_escape(text):
    """Escape characters that have special meaning in LaTeX."""
    if text is None:
        return ""

    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


# Inline markup the editor writes into resume.json, innermost-first so that
# **bold** is never mistaken for a pair of *italic* markers.
MARKUP_PATTERN = re.compile(
    r"\*\*(?P<bold>.+?)\*\*|__(?P<underline>.+?)__|\*(?P<italic>.+?)\*",
    re.DOTALL,
)

MARKUP_COMMANDS = {
    "bold": "textbf",
    "underline": "uline",
    "italic": "textit",
}


def latex_text(text):
    """Escape for LaTeX, turning **bold**, *italic* and __underline__ into commands.

    Only the literal runs are escaped, so the markers themselves never end up
    in the output and nesting such as `**__both__**` still works.
    """
    if text is None:
        return ""

    parts = []
    index = 0

    for match in MARKUP_PATTERN.finditer(text):
        parts.append(latex_escape(text[index : match.start()]))

        for group, command in MARKUP_COMMANDS.items():
            inner = match.group(group)

            if inner is not None:
                parts.append(rf"\{command}{{{latex_text(inner)}}}")
                break

        index = match.end()

    parts.append(latex_escape(text[index:]))

    return "".join(parts)


def enabled_items(items):
    """The entries a section renders: an entry counts unless it opts out.

    Entries written before per-entry toggles existed have no `enabled` key, so
    the default has to be True.
    """
    return [item for item in items or [] if item.get("enabled", True)]


def generate_summary(summary):
    return latex_text((summary or "").strip())


def generate_coursework(coursework):
    if not coursework:
        return ""

    items = " · ".join(latex_text(item) for item in coursework)

    return rf"""
    \resumeItem{{\textbf{{Coursework:}} {items}}}
"""


def generate_education(education):
    education = enabled_items(education)

    if not education:
        return ""

    output = []

    for edu in education:
        university = latex_text(edu.get("university"))
        location = latex_text(edu.get("location"))
        degree = latex_text(edu.get("degree"))
        gpa = latex_text(edu.get("gpa"))
        date_range = latex_text(edu.get("date"))

        coursework = generate_coursework(edu.get("coursework", []))

        output.append(
            rf"""
\resumeSubheading
    {{{university}}}{{{location}}}
    {{{degree} | GPA: {gpa}}}{{{date_range}}}
\resumeItemListStart
{coursework}
\resumeItemListEnd
"""
        )

    return "\n".join(output)


def generate_projects(projects):
    projects = enabled_items(projects)

    if not projects:
        return ""

    output = []

    for project in projects:
        name = latex_text(project.get("name"))
        stack = ", ".join(latex_text(x) for x in project.get("stack", []))
        date_range = latex_text(project.get("date"))

        descriptions = "\n".join(
            rf"    \resumeItem{{{latex_text(description)}}}"
            for description in project.get("description", [])
        )

        output.append(
            rf"""
\resumeProjectHeading
    {{\textbf{{{name}}} $|$ \emph{{{stack}}}}}{{{date_range}}}
\resumeItemListStart
{descriptions}
\resumeItemListEnd
"""
        )

    return "\n".join(output)


def generate_experience(experience):
    experience = enabled_items(experience)

    if not experience:
        return ""

    output = []

    for job in experience:
        company = latex_text(job.get("company"))
        position = latex_text(job.get("position"))
        date_range = latex_text(job.get("date"))
        location = latex_text(job.get("location"))

        descriptions = "\n".join(
            rf"    \resumeItem{{{latex_text(description)}}}"
            for description in job.get("description", [])
        )

        output.append(
            rf"""
\resumeSubheading
    {{{position}}}{{{date_range}}}
    {{{company}}}{{{location}}}
\resumeItemListStart
{descriptions}
\resumeItemListEnd
"""
        )

    return "\n".join(output)


def generate_skills(skills):
    skills = enabled_items(skills)

    if not skills:
        return ""

    output = []

    for skill in skills:
        category = latex_text(skill.get("category"))
        description = latex_text(skill.get("description"))

        output.append(
            rf"""
     \textbf{{{category}}}: {description} \\
"""
        )

    return "\n".join(output)


def wrap_subheading_list(body):
    """The itemize environment used by the entry-style sections."""
    if not body.strip():
        return ""

    return rf"""\resumeSubHeadingListStart
{body}
\resumeSubHeadingListEnd"""


def wrap_plain_list(body):
    """The label-less itemize used by the prose-style sections."""
    if not body.strip():
        return ""

    return rf"""\begin{{itemize}}[leftmargin=0.15in, label={{}}]
    \small{{\item{{
{body}
    }}}}
\end{{itemize}}"""


def generate_sections(data, projects, experience):
    """Render the enabled sections, in the order resume.json asks for."""
    bodies = {
        "summary": wrap_plain_list(generate_summary(data.get("summary", ""))),
        "education": wrap_subheading_list(
            generate_education(data.get("education", []))
        ),
        "projects": wrap_subheading_list(generate_projects(projects)),
        "experience": wrap_subheading_list(generate_experience(experience)),
        "skills": wrap_plain_list(generate_skills(data.get("skills", []))),
    }

    output = []

    for key in resolve_sections(data):
        body = bodies[key]

        if not body:
            continue

        title = SECTION_TITLES[key]

        output.append(
            rf"""
%-----------{title.upper()}-----------
\section{{{title}}}

{body}
"""
        )

    return "\n".join(output)


def render_latex(data, projects=None, experience=None):
    """Build the full LaTeX source for a resume."""
    profile = data.get("profile", {})

    name = latex_text(profile.get("name"))
    website = latex_escape(profile.get("website", ""))
    email = latex_escape(profile.get("email", ""))
    linkedin = latex_escape(profile.get("linkedin", ""))
    github = latex_escape(profile.get("github", ""))

    website_display = website.removeprefix("https://").removeprefix("http://")
    linkedin_display = linkedin.removeprefix("https://").removeprefix("http://")
    github_display = github.removeprefix("https://").removeprefix("http://")

    if projects is None:
        projects = data.get("projects", [])

    if experience is None:
        experience = data.get("experience", [])

    sections_tex = generate_sections(data, projects, experience)

    main = rf"""
\begin{{document}}

%----------HEADING----------

\begin{{center}}
    \textbf{{\Huge \scshape {name}}} \\ \vspace{{1pt}}

    \small
    \href{{{website}}}
    {{\underline{{{website_display}}}}} $|$
    \href{{mailto:{email}}}
    {{\underline{{{email}}}}} $|$
    \href{{{linkedin}}}
    {{\underline{{{linkedin_display}}}}} $|$
    \href{{{github}}}
    {{\underline{{{github_display}}}}}
\end{{center}}

{sections_tex}

\end{{document}}
"""

    with open(DOC_SETTINGS_PATH, "r", encoding="utf-8") as file:
        doc_settings = file.read()

    return doc_settings + "\n" + main


class LatexError(RuntimeError):
    """pdflatex refused to compile the generated source."""


def compile_pdf(latex):
    """Run pdflatex on `latex` and return the resulting PDF bytes."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        tex_file = tmp / "doc.tex"
        tex_file.write_text(latex, encoding="utf-8")

        result = subprocess.run(
            [
                "pdflatex",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-output-directory",
                str(tmp),
                str(tex_file),
            ],
            capture_output=True,
            text=True,
        )

        pdf_file = tmp / "doc.pdf"

        if result.returncode != 0 or not pdf_file.exists():
            raise LatexError(_latex_error_summary(result.stdout))

        return pdf_file.read_bytes()


def _latex_error_summary(log):
    """Pull the interesting lines out of a pdflatex log."""
    lines = [line for line in log.splitlines() if line.startswith("!")]

    if not lines:
        return "pdflatex failed with no reported error."

    return "\n".join(lines[:5])


def build_filename(data, preset_name=""):
    name = data.get("profile", {}).get("name", "resume")
    today = date.today().strftime("%Y_%m_%d")

    stem = f"resume_{name}_{today}"

    if preset_name:
        stem = f"{stem}_{preset_name}"

    return f"{stem}.pdf"


def safe_pdf_name(name):
    """Turn a typed file name into one plain PDF file name.

    The editor sends whatever the user typed, and it is about to become a real
    path, so directory separators are folded away and the `.pdf` suffix is
    applied here rather than trusted from the caller.
    """
    stem = (name or "").strip()

    if stem.lower().endswith(".pdf"):
        stem = stem[: -len(".pdf")]

    for bad in ("/", "\\", "\0"):
        stem = stem.replace(bad, "_")

    stem = stem.strip(". ")

    if not stem:
        raise ValueError("The file name cannot be empty.")

    return f"{stem[:200]}.pdf"


def preview_pdf(data, preset_name=""):
    """Compile a PDF without writing anything to disk."""
    projects, experience = apply_preset(data, preset_name)

    return compile_pdf(render_latex(data, projects, experience))


def build_pdf(data, preset_name="", filename=None, label=None):
    """Compile a PDF and store it under resume_builds/.

    `label` names the file when the caller has already applied the preset to
    `data` and so passes no `preset_name` to filter by.
    """
    pdf_bytes = preview_pdf(data, preset_name)

    target = build_dir()

    filename = (
        safe_pdf_name(filename)
        if filename
        else build_filename(data, preset_name if label is None else label)
    )

    pdf_path = target / filename

    # Nothing should be able to write outside the build directory.
    if pdf_path.resolve().parent != target.resolve():
        raise ValueError("The file name must not point outside the output folder.")

    pdf_path.write_bytes(pdf_bytes)

    return pdf_path


def list_builds(limit=10):
    """Most recently built resume PDFs, newest first."""
    folder = build_dir()

    if not folder.exists():
        return []

    pdfs = sorted(
        folder.glob("*.pdf"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )

    return [
        {
            "name": path.name,
            "size": path.stat().st_size,
            "modified": path.stat().st_mtime,
        }
        for path in pdfs[:limit]
    ]
