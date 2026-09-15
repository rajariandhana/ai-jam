import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent / "resume"))

import resume_builder  # noqa: E402  (also puts the repo root on sys.path)

import settings as app_settings  # noqa: E402

import documents  # noqa: E402

from generate import (  # noqa: E402
    build_letter_pdf,
    cover_letter_build_path,
    generate_body,
    generate_cover_letter,
    generate_pdf_from_texts,
    generate_prompt,
    generate_template,
    letter_filename,
    resolve_position,
    template_blocks,
    write_body,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:41743",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


@app.get("/")
def home():
    return {"message": "hello world"}


class JobRequest(BaseModel):
    company: Optional[str] = ""
    position: Optional[str] = ""
    job_description: Optional[str] = ""
    request_note: Optional[str] = ""


class BodyRequest(BaseModel):
    prompt: Optional[str] = ""


class TemplateRequest(BaseModel):
    company: Optional[str] = ""
    position: Optional[str] = ""


class PdfRequest(BaseModel):
    header: Optional[str] = ""
    prompt_response: Optional[str] = ""
    footer: Optional[str] = ""
    filename: Optional[str] = ""


class ResumeRequest(BaseModel):
    data: dict[str, Any]
    preset: Optional[str] = ""
    label: Optional[str] = None
    filename: Optional[str] = None


@api_router.get("/ping")
def ping():
    return {"message": "PING"}


# ---------------------------------------------------------------- cover letter


@api_router.post("/generate-prompt")
async def generate_prompt_endpoint(job: JobRequest):
    company = (job.company or "").strip()
    position = (job.position or "").strip()
    job_description = (job.job_description or "").strip()
    request_note = (job.request_note or "").strip()

    try:
        prompt = generate_prompt(company, position, job_description, request_note)
        return {"status": "ok", "prompt": prompt}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Plain `def` so the Claude subprocess runs in the threadpool and parallel
# generations don't block the API.
@api_router.post("/generate")
def generate_endpoint(job: JobRequest):
    company = (job.company or "").strip()
    position = (job.position or "").strip()
    job_description = (job.job_description or "").strip()
    request_note = (job.request_note or "").strip()

    try:
        letter = generate_cover_letter(
            company, position, job_description, request_note
        )
        return {
            "status": "ok",
            "letter": letter,
            "id": letter["id"],
            "pdf_path": letter["pdf_path"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Plain `def` for the same reason as /generate: the Claude call blocks.
@api_router.post("/generate-body")
def generate_body_endpoint(job: BodyRequest):
    prompt = (job.prompt or "").strip()

    try:
        body = generate_body(prompt)
        return {
            "status": "ok",
            "prompt_response": documents.render_block(body),
            "body": body,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/generate-template")
async def generate_template_endpoint(job: TemplateRequest):
    company = (job.company or "").strip()
    position = (job.position or "").strip()

    try:
        header, footer = generate_template(company, position)
        return {"status": "ok", "header": header, "footer": footer}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/generate-pdf")
async def generate_pdf_endpoint(job: PdfRequest):
    header = job.header or ""
    prompt_response = job.prompt_response or ""
    footer = job.footer or ""
    filename = job.filename

    try:
        pdf_path = generate_pdf_from_texts(header, prompt_response, footer, filename)
        return {"status": "ok", "pdf_path": str(pdf_path)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------- cover letter documents
#
# The prompt header, the letter template and the reference paragraphs are JSON
# documents the editors under /cover read and write. Letters are JSON too, so a
# generated one can be reopened and changed instead of being rebuilt from
# scratch.


class DocumentRequest(BaseModel):
    data: dict[str, Any]


class LetterRequest(BaseModel):
    # Every field defaults to None rather than "", so an edit that leaves one
    # out keeps what is stored instead of blanking it.
    company: Optional[str] = None
    position: Optional[str] = None
    job_description: Optional[str] = None
    request_note: Optional[str] = None
    prompt: Optional[str] = None
    header: Optional[list[str]] = None
    body: Optional[list[str]] = None
    footer: Optional[list[str]] = None
    filename: Optional[str] = None


@api_router.get("/cover/prompt-header")
async def get_prompt_header():
    try:
        return {"status": "ok", "data": documents.load_prompt_header()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/cover/prompt-header")
async def put_prompt_header(request: DocumentRequest):
    try:
        data = documents.save_prompt_header(request.data)
        return {
            "status": "ok",
            "data": data,
            "preview": documents.render_prompt_header(data),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/cover/prompt-header/preview")
async def preview_prompt_header(request: DocumentRequest):
    """What the submitted, still unsaved header would send to the model."""
    try:
        return {
            "status": "ok",
            "preview": documents.render_prompt_header(request.data),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/cover/template")
async def get_template():
    try:
        return {"status": "ok", "data": documents.load_template()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/cover/template")
async def put_template(request: DocumentRequest):
    try:
        return {"status": "ok", "data": documents.save_template(request.data)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/cover/references")
async def get_references():
    try:
        return {"status": "ok", "data": documents.load_references()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/cover/references")
async def put_references(request: DocumentRequest):
    try:
        data = documents.save_references(request.data)
        return {
            "status": "ok",
            "data": data,
            "preview": documents.render_references(data),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/cover/references/preview")
async def preview_references(request: DocumentRequest):
    try:
        return {
            "status": "ok",
            "preview": documents.render_references(request.data),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----------------------------------------------------------- saved letters


def _letter_or_404(letter_id: str):
    try:
        return documents.load_letter(letter_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _letter_changes(request: LetterRequest) -> dict[str, Any]:
    """Only the fields the caller actually sent, so a partial edit is safe."""
    return request.model_dump(exclude_none=True)


@api_router.get("/cover/letters")
async def list_letters():
    try:
        return {"status": "ok", "letters": documents.list_letters()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/cover/letters")
async def create_letter(request: LetterRequest):
    """Start a letter: the template fills the header and footer, and the prompt
    is built from the current prompt header and references."""
    company = (request.company or "").strip()
    position = resolve_position((request.position or "").strip())
    job_description = request.job_description or ""
    request_note = request.request_note or ""

    try:
        header, footer = template_blocks(company, position)

        letter = documents.save_letter(
            {
                **_letter_changes(request),
                "company": company,
                "position": position,
                "job_description": job_description,
                "request_note": request_note,
                "prompt": request.prompt
                if request.prompt is not None
                else generate_prompt(company, position, job_description, request_note),
                "header": request.header if request.header is not None else header,
                "body": request.body or [],
                "footer": request.footer if request.footer is not None else footer,
                "filename": request.filename or letter_filename(company, position),
            }
        )

        return {"status": "ok", "letter": letter}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/cover/letters/{letter_id}")
async def get_letter(letter_id: str):
    return {"status": "ok", "letter": _letter_or_404(letter_id)}


@api_router.put("/cover/letters/{letter_id}")
async def put_letter(letter_id: str, request: LetterRequest):
    letter = _letter_or_404(letter_id)

    try:
        saved = documents.save_letter({**letter, **_letter_changes(request)})
        return {"status": "ok", "letter": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/cover/letters/{letter_id}")
async def remove_letter(letter_id: str):
    _letter_or_404(letter_id)

    try:
        documents.delete_letter(letter_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/cover/letters/{letter_id}/prompt")
async def rebuild_letter_prompt(letter_id: str):
    """Rebuild the stored prompt from the letter and the current documents."""
    letter = _letter_or_404(letter_id)

    try:
        letter["prompt"] = generate_prompt(
            letter["company"],
            letter["position"],
            letter["job_description"],
            letter["request_note"],
        )
        return {"status": "ok", "letter": documents.save_letter(letter)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Plain `def` so the Claude subprocess runs in the threadpool and parallel
# generations don't block the API.
@api_router.post("/cover/letters/{letter_id}/generate")
def generate_letter_body(letter_id: str):
    letter = _letter_or_404(letter_id)

    try:
        # The prompt on the page is the one that runs, edits and all. Only a
        # letter with no prompt at all falls back to building one.
        letter["body"] = (
            generate_body(letter["prompt"])
            if letter["prompt"].strip()
            else write_body(
                letter["company"],
                letter["position"],
                letter["job_description"],
                letter["request_note"],
            )
        )
        return {"status": "ok", "letter": documents.save_letter(letter)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/cover/letters/{letter_id}/pdf")
async def build_letter(letter_id: str):
    letter = _letter_or_404(letter_id)

    try:
        letter["pdf_path"] = str(build_letter_pdf(letter))
        saved = documents.save_letter(letter)
        return {
            "status": "ok",
            "letter": saved,
            "name": Path(saved["pdf_path"]).name,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------- resume


@api_router.get("/resume")
async def get_resume():
    try:
        return {"status": "ok", "data": resume_builder.load_resume()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/resume")
async def put_resume(request: ResumeRequest):
    try:
        resume_builder.save_resume(request.data)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/resume/presets")
async def get_resume_presets():
    try:
        return {"status": "ok", "presets": resume_builder.load_presets()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/resume/apply-preset")
async def apply_resume_preset(request: ResumeRequest):
    """Switch the submitted resume's layout to match a preset, without saving."""
    try:
        data = resume_builder.apply_preset_layout(request.data, request.preset or "")
        return {"status": "ok", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/resume/preview")
async def preview_resume(request: ResumeRequest):
    """Compile the submitted (possibly unsaved) resume and stream the PDF back."""
    try:
        pdf_bytes = resume_builder.preview_pdf(request.data, request.preset or "")
    except resume_builder.LatexError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return Response(content=pdf_bytes, media_type="application/pdf")


@api_router.post("/resume/build")
async def build_resume(request: ResumeRequest):
    try:
        pdf_path = resume_builder.build_pdf(
            request.data,
            request.preset or "",
            filename=request.filename,
            label=request.label,
        )
        return {"status": "ok", "pdf_path": str(pdf_path), "name": pdf_path.name}
    except resume_builder.LatexError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------- dashboard


def _list_cover_letters(limit=10):
    folder = cover_letter_build_path()

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


class SettingsRequest(BaseModel):
    resume_dir: Optional[str] = None
    cover_letter_dir: Optional[str] = None


class BrowseRequest(BaseModel):
    path: Optional[str] = None


@api_router.get("/settings")
async def get_settings():
    return {
        "status": "ok",
        "settings": app_settings.load_settings(),
        "defaults": app_settings.DEFAULTS,
    }


@api_router.put("/settings")
async def put_settings(request: SettingsRequest):
    try:
        saved = app_settings.save_settings(request.model_dump(exclude_none=True))
        return {"status": "ok", "settings": saved}
    except app_settings.DirectoryError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/settings/check-dir")
async def check_dir(request: BrowseRequest):
    """Report whether a typed path could be used, without creating it."""
    try:
        path, exists = app_settings.check_dir(request.path or "")
        return {"status": "ok", "path": str(path), "exists": exists}
    except app_settings.DirectoryError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/settings/browse")
async def browse(request: BrowseRequest):
    """Immediate subdirectories, for picking a folder without typing a path."""
    target = request.path or str(Path.home())

    try:
        path, entries = app_settings.list_subdirectories(target)
    except app_settings.DirectoryError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"{target} is not readable.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "ok",
        "path": str(path),
        "parent": None if path.parent == path else str(path.parent),
        "home": str(Path.home()),
        "entries": entries,
    }


@api_router.get("/dashboard")
async def dashboard():
    try:
        data = resume_builder.load_resume()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": "ok",
        "profile": data.get("profile", {}),
        "presets": list(resume_builder.load_presets()),
        "resume_builds": resume_builder.list_builds(5),
        "cover_letter_builds": _list_cover_letters(5),
    }


app.include_router(api_router)
