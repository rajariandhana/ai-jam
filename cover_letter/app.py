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

from generate import (  # noqa: E402
    cover_letter_build_path,
    generate_cover_letter,
    generate_pdf_from_texts,
    generate_prompt,
    generate_template,
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
        pdf_path = generate_cover_letter(
            company, position, job_description, request_note
        )
        return {"status": "ok", "pdf_path": str(pdf_path)}
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
