"""The JSON documents behind a cover letter.

The prompt header, the letter template and the reference paragraphs used to be
markdown files read straight off disk, so the only way to change them was to
open an editor. They are JSON now, which is what the editors under `/cover`
read and write, and generated letters are saved as JSON documents of their own
rather than a loose prompt/response pair of markdown files.

Every write goes through a temporary file and `os.replace`, so a failed write
cannot leave a half-written document behind.
"""

import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent

PROMPT_HEADER_PATH = CURRENT_DIR / "prompt_header.json"
TEMPLATE_PATH = CURRENT_DIR / "template.json"
REFERENCES_PATH = CURRENT_DIR / "references.json"
LETTERS_DIR = CURRENT_DIR / "letters"

# References are personal writing, so they were kept out of git as markdown.
# The first read converts that file instead of starting from nothing.
LEGACY_REFERENCES_PATH = CURRENT_DIR / "paragraph_reference.md"

# What the prompt can carry, in the order the numbered list introduces it. The
# header and the body are rendered from the same list, so section 3 of the
# instructions is always section 3 of the content.
INPUT_KEYS = ("resume", "job_description", "template", "references", "request")

DEFAULT_PROMPT_HEADER = {
    "role": "You are an AI tool to help me to write cover letter.",
    "about": "I am a Computer Science fresh graduate.",
    "inputs_intro": "Below I provide:",
    "inputs": [
        {
            "key": "resume",
            "label": "My full resume in JSON",
            "description": (
                "Contains my profile, education, projects, experience, "
                "and skills."
            ),
            "enabled": True,
        },
        {
            "key": "job_description",
            "label": "Job description",
            "description": "Copied from the job posting board",
            "enabled": True,
        },
        {
            "key": "template",
            "label": "Cover letter template",
            "description": "There is a header and footer with no body text.",
            "enabled": True,
        },
        {
            "key": "references",
            "label": (
                "Several paragraphs I've written that could be "
                "used/referenced for."
            ),
            "description": "",
            "enabled": True,
        },
        {
            "key": "request",
            "label": "Request",
            "description": "Optional prompt that if given must be followed.",
            "enabled": True,
        },
    ],
    "instructions": [
        (
            "I want you to write me the body text for a cover letter according "
            "to my resume tailored with the job description."
        ),
        "The body text could consist of 2-4 paragraphs.",
        "Only return me the body text and nothing else.",
        "Avoid using em dash, colons, and other common AI writing styles.",
        "Mention why I am interested in the role.",
        (
            "Mention how my experiences and learning capabilities could "
            "contribute."
        ),
        "You must mention my visa eligibility.",
    ],
}

DEFAULT_TEMPLATE = {
    "name": "Ralfazza Rajariandhana",
    "filename": "Cover Letter_{NAME}_{COMPANY}",
    "header": [
        "{DATE}",
        "Dear Hiring Manager,",
        (
            "My name is {NAME}, and I am a Computer Science fresh graduate "
            "from a joint program between Institut Teknologi Sepuluh Nopember "
            "(ITS) in Indonesia and The University of Queensland (UQ) in "
            "Australia. I am writing to express my excitement in the "
            "{POSITION} role at {COMPANY}."
        ),
    ],
    "footer": ["Sincerely,\n{NAME}"],
}

DEFAULT_REFERENCES = {"references": []}


# ------------------------------------------------------------------- file i/o


def _read_json(path, fallback):
    """The document at `path`, or a copy of `fallback` when it is unusable."""
    if not path.exists():
        return json.loads(json.dumps(fallback))

    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return json.loads(json.dumps(fallback))


def _write_json(path, data):
    """Write `data` atomically, so a failed write cannot truncate the file."""
    path.parent.mkdir(parents=True, exist_ok=True)

    handle, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".json.tmp")

    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
            file.write("\n")

        os.replace(tmp_path, path)
    except Exception:
        Path(tmp_path).unlink(missing_ok=True)
        raise

    return data


def _text(value, fallback=""):
    return value.strip() if isinstance(value, str) else fallback


def _lines(value):
    """A list of paragraphs out of either a list or one blank-line block."""
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"\n\s*\n", value) if part.strip()]

    if not isinstance(value, list):
        return []

    return [entry.strip() for entry in value if isinstance(entry, str) and entry.strip()]


def split_paragraphs(text):
    """Plain text split into the paragraphs a document stores it as."""
    return _lines(text)


def render_block(paragraphs):
    """Paragraphs back into the plain text the PDF and the prompt carry."""
    return "\n\n".join(_lines(paragraphs))


# ------------------------------------------------------------- prompt header


def normalise_prompt_header(data):
    """A prompt header with every field present, whatever was handed in."""
    data = data if isinstance(data, dict) else {}

    inputs = []
    seen = set()

    for entry in data.get("inputs") or []:
        if not isinstance(entry, dict):
            continue

        key = _text(entry.get("key"))

        # Sections are filled in by key, so an unknown or repeated one has
        # nothing to carry and is dropped rather than rendered empty.
        if key not in INPUT_KEYS or key in seen:
            continue

        seen.add(key)
        inputs.append(
            {
                "key": key,
                "label": _text(entry.get("label")),
                "description": _text(entry.get("description")),
                "enabled": entry.get("enabled", True) is not False,
            }
        )

    # A document written before a section existed still gets to use it.
    for entry in DEFAULT_PROMPT_HEADER["inputs"]:
        if entry["key"] not in seen:
            inputs.append(dict(entry))

    return {
        "role": _text(data.get("role"), DEFAULT_PROMPT_HEADER["role"]),
        "about": _text(data.get("about"), DEFAULT_PROMPT_HEADER["about"]),
        "inputs_intro": _text(
            data.get("inputs_intro"), DEFAULT_PROMPT_HEADER["inputs_intro"]
        ),
        "inputs": inputs,
        "instructions": [
            line
            for line in (
                _text(entry) for entry in data.get("instructions") or [] if entry
            )
            if line
        ],
    }


def load_prompt_header():
    return normalise_prompt_header(_read_json(PROMPT_HEADER_PATH, DEFAULT_PROMPT_HEADER))


def save_prompt_header(data):
    header = normalise_prompt_header(data)
    _write_json(PROMPT_HEADER_PATH, header)
    return header


def enabled_inputs(header):
    return [entry for entry in header["inputs"] if entry["enabled"]]


def render_prompt_header(header=None):
    """The instruction block that opens the prompt, as one piece of text."""
    header = normalise_prompt_header(header) if header else load_prompt_header()

    lines = [line for line in (header["role"], header["about"]) if line]
    sections = enabled_inputs(header)

    if sections:
        if header["inputs_intro"]:
            lines.append(header["inputs_intro"])

        for number, entry in enumerate(sections, start=1):
            label = entry["label"] or entry["key"]
            lines.append(
                f"{number}. {label}: {entry['description']}"
                if entry["description"]
                else f"{number}. {label}"
            )

    instructions = " ".join(header["instructions"])
    intro = "\n".join(lines)

    if not instructions:
        return intro

    return f"{intro}\n\n{instructions}" if intro else instructions


def render_prompt_body(contents, header=None):
    """The numbered content blocks, matching the header's numbered list."""
    header = normalise_prompt_header(header) if header else load_prompt_header()

    blocks = []

    for number, entry in enumerate(enabled_inputs(header), start=1):
        label = entry["label"] or entry["key"]
        content = contents.get(entry["key"], "")
        blocks.append(f"{number}. {label}\n```\n{content}\n```")

    return "\n\n".join(blocks)


# ----------------------------------------------------------------- template


def normalise_template(data):
    data = data if isinstance(data, dict) else {}

    header = _lines(data.get("header"))
    footer = _lines(data.get("footer"))

    return {
        "name": _text(data.get("name"), DEFAULT_TEMPLATE["name"]),
        "filename": _text(data.get("filename"), DEFAULT_TEMPLATE["filename"]),
        "header": header or list(DEFAULT_TEMPLATE["header"]),
        "footer": footer or list(DEFAULT_TEMPLATE["footer"]),
    }


def load_template():
    return normalise_template(_read_json(TEMPLATE_PATH, DEFAULT_TEMPLATE))


def save_template(data):
    template = normalise_template(data)
    _write_json(TEMPLATE_PATH, template)
    return template


def apply_placeholders(text, name, company, position):
    """Fill in {NAME}, {DATE}, {COMPANY} and {POSITION}."""
    replacements = {
        "{NAME}": name,
        "{DATE}": datetime.now().strftime("%B %d, %Y"),
        "{COMPANY}": company,
        "{POSITION}": position,
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


def resolve_block(paragraphs, name, company, position):
    """Paragraphs with their placeholders filled in, still as paragraphs."""
    return [
        apply_placeholders(paragraph, name, company, position)
        for paragraph in _lines(paragraphs)
    ]


# --------------------------------------------------------------- references


def _reference_id(index):
    return f"ref_{index:02d}"


def normalise_references(data):
    """A reference list with stable ids, whatever shape was handed in."""
    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict):
        entries = data.get("references") or []
    else:
        entries = []

    references = []
    seen = set()

    for index, entry in enumerate(entries, start=1):
        if isinstance(entry, str):
            entry = {"content": entry}

        if not isinstance(entry, dict):
            continue

        content = entry.get("content")
        content = content.strip() if isinstance(content, str) else ""

        reference_id = _text(entry.get("id"))

        if not reference_id or reference_id in seen:
            reference_id = _reference_id(index)

        while reference_id in seen:
            reference_id = f"{reference_id}_{index}"

        seen.add(reference_id)

        references.append(
            {
                "id": reference_id,
                "title": _text(entry.get("title")),
                "content": content,
                "enabled": entry.get("enabled", True) is not False,
            }
        )

    return {"references": references}


def _migrate_references():
    """Turn a leftover paragraph_reference.md into reference entries.

    Each blank-line separated block becomes one reference, and a leading
    markdown heading or a line ending in a colon is taken as its title.
    """
    try:
        with open(LEGACY_REFERENCES_PATH, "r", encoding="utf-8") as file:
            text = file.read()
    except OSError:
        return dict(DEFAULT_REFERENCES)

    references = []

    for index, block in enumerate(re.split(r"\n\s*\n", text), start=1):
        block = block.strip()

        if not block:
            continue

        title = ""
        first, _, rest = block.partition("\n")
        heading = first.strip()

        if heading.startswith("#") or (heading.endswith(":") and rest.strip()):
            title = heading.lstrip("#").strip().rstrip(":").strip()
            block = rest.strip()

        references.append(
            {
                "id": _reference_id(index),
                "title": title or f"Reference {index}",
                "content": block,
                "enabled": True,
            }
        )

    return {"references": references}


def load_references():
    if not REFERENCES_PATH.exists() and LEGACY_REFERENCES_PATH.exists():
        # Convert once, so the editor starts on the paragraphs already written.
        return save_references(_migrate_references())

    return normalise_references(_read_json(REFERENCES_PATH, DEFAULT_REFERENCES))


def save_references(data):
    references = normalise_references(data)
    _write_json(REFERENCES_PATH, references)
    return references


def render_references(data=None):
    """The enabled references as the plain text that reaches the prompt."""
    data = normalise_references(data) if data is not None else load_references()

    blocks = []

    for entry in data["references"]:
        if not entry["enabled"] or not entry["content"]:
            continue

        lines = []

        if entry["title"]:
            lines.append(entry["title"])

        lines.append(entry["content"])
        blocks.append("\n".join(lines))

    return "\n\n".join(blocks)


# ------------------------------------------------------------------ letters


def empty_letter():
    return {
        "id": "",
        "company": "",
        "position": "",
        "job_description": "",
        "request_note": "",
        "prompt": "",
        "header": [],
        "body": [],
        "footer": [],
        "filename": "",
        "pdf_path": "",
        "created_at": "",
        "updated_at": "",
    }


def normalise_letter(data):
    data = data if isinstance(data, dict) else {}
    letter = empty_letter()

    for key in ("id", "company", "position", "filename", "pdf_path"):
        letter[key] = _text(data.get(key))

    for key in ("job_description", "request_note", "prompt"):
        value = data.get(key)
        letter[key] = value if isinstance(value, str) else ""

    for key in ("header", "body", "footer"):
        letter[key] = _lines(data.get(key))

    for key in ("created_at", "updated_at"):
        letter[key] = _text(data.get(key))

    return letter


def letter_path(letter_id):
    """The file holding `letter_id`, refusing anything that is not an id.

    Ids reach this from the API, so a path separator or a `..` must not be
    able to send a read or a write outside the letters folder.
    """
    letter_id = _text(letter_id)

    if not letter_id or not re.fullmatch(r"[A-Za-z0-9_-]+", letter_id):
        raise ValueError(f"'{letter_id}' is not a letter id")

    return LETTERS_DIR / f"{letter_id}.json"


def next_letter_id():
    """Today's date plus a counter, matching how builds are named."""
    LETTERS_DIR.mkdir(parents=True, exist_ok=True)

    date_str = datetime.now().strftime("%Y_%m_%d")
    counter = 1

    while (LETTERS_DIR / f"{date_str}_{counter:02d}.json").exists():
        counter += 1

    return f"{date_str}_{counter:02d}"


def load_letter(letter_id):
    path = letter_path(letter_id)

    if not path.exists():
        raise FileNotFoundError(f"No letter named {letter_id}")

    letter = normalise_letter(_read_json(path, {}))
    letter["id"] = letter["id"] or letter_id

    return letter


def save_letter(data):
    """Store a letter, giving it an id and timestamps when it is new."""
    letter = normalise_letter(data)
    now = datetime.now().isoformat(timespec="seconds")

    if not letter["id"]:
        letter["id"] = next_letter_id()

    letter["created_at"] = letter["created_at"] or now
    letter["updated_at"] = now

    _write_json(letter_path(letter["id"]), letter)

    return letter


def delete_letter(letter_id):
    path = letter_path(letter_id)

    if not path.exists():
        raise FileNotFoundError(f"No letter named {letter_id}")

    path.unlink()


def list_letters(limit=None):
    """Summaries of the saved letters, most recently changed first."""
    if not LETTERS_DIR.exists():
        return []

    letters = []

    for path in LETTERS_DIR.glob("*.json"):
        letter = normalise_letter(_read_json(path, {}))
        letter["id"] = letter["id"] or path.stem

        letters.append(
            {
                "id": letter["id"],
                "company": letter["company"],
                "position": letter["position"],
                "has_body": bool(letter["body"]),
                "pdf_path": letter["pdf_path"],
                "created_at": letter["created_at"],
                "updated_at": letter["updated_at"],
                "modified": path.stat().st_mtime,
            }
        )

    letters.sort(key=lambda entry: (entry["updated_at"], entry["modified"]), reverse=True)

    return letters[:limit] if limit else letters
