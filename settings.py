"""Where the app writes its output, stored in settings.json at the repo root.

Both `resume/resume_builder.py` and `cover_letter/generate.py` read this, so
the directories can be changed from the Settings page without restarting.
"""

import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SETTINGS_PATH = ROOT / "settings.json"

DEFAULTS = {
    "resume_dir": str(ROOT / "resume" / "resume_builds"),
    "cover_letter_dir": str(ROOT / "cover_letter" / "cover_letter_builds"),
}


def load_settings():
    """Stored settings on top of the defaults, so a partial file still works."""
    settings = dict(DEFAULTS)

    if not SETTINGS_PATH.exists():
        return settings

    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as file:
            stored = json.load(file)
    except (OSError, json.JSONDecodeError):
        return settings

    for key in DEFAULTS:
        value = stored.get(key)

        if isinstance(value, str) and value.strip():
            settings[key] = value.strip()

    return settings


def save_settings(settings):
    """Write settings.json atomically after checking each directory is usable."""
    merged = dict(DEFAULTS)

    for key in DEFAULTS:
        value = settings.get(key)

        if isinstance(value, str) and value.strip():
            merged[key] = str(resolve_dir(value))

    handle, tmp_path = tempfile.mkstemp(dir=str(ROOT), suffix=".json.tmp")

    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            json.dump(merged, file, indent=2)
            file.write("\n")

        os.replace(tmp_path, SETTINGS_PATH)
    except Exception:
        Path(tmp_path).unlink(missing_ok=True)
        raise

    return merged


def resolve_dir(value):
    """An absolute path for `value`, expanding `~` and relative entries."""
    path = Path(value.strip()).expanduser()

    if not path.is_absolute():
        path = ROOT / path

    return path.resolve()


class DirectoryError(ValueError):
    """The chosen directory cannot be written to."""


def check_dir(value, create=False):
    """Report whether `value` is a directory this app could write into."""
    path = resolve_dir(value)

    if path.exists() and not path.is_dir():
        raise DirectoryError(f"{path} exists but is not a directory.")

    if not path.exists():
        if not create:
            return path, False

        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise DirectoryError(f"Could not create {path}: {error}") from error

    if not os.access(path, os.W_OK):
        raise DirectoryError(f"{path} is not writable.")

    return path, True


def ensure_dir(value):
    """The directory for `value`, created if it is missing."""
    path, _ = check_dir(value, create=True)

    return path


def resume_dir():
    return ensure_dir(load_settings()["resume_dir"])


def cover_letter_dir():
    return ensure_dir(load_settings()["cover_letter_dir"])


def list_subdirectories(value, limit=500):
    """Immediate subdirectories of `value`, for the directory picker."""
    path = resolve_dir(value)

    if not path.is_dir():
        raise DirectoryError(f"{path} is not a directory.")

    entries = []

    with os.scandir(path) as scan:
        for entry in scan:
            if entry.name.startswith("."):
                continue

            try:
                if entry.is_dir():
                    entries.append(entry.name)
            except OSError:
                continue

    entries.sort(key=str.lower)

    return path, entries[:limit]
