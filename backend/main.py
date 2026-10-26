import io
import json
import os
import pathlib

import openai
import pdfplumber
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="JobMatch AI")


@app.get("/health")
async def health():
    return {"service": "jobmatch-ai", "apiVersion": 2,
            "features": ["apply-workspace", "saved-profile", "tailored-autofill", "saved-autofill", "subscription-tailoring", "draft-history"]}


FRONTEND_PATH = pathlib.Path(__file__).parent.parent / "frontend" / "index.html"

SYSTEM_PROMPT = """You are an expert resume consultant specializing in software engineering internship applications. You help candidates tailor their resumes to specific job descriptions with precision and honesty.

You ALWAYS follow these rules when suggesting edits:
- Only suggest edits where they genuinely improve fit with the job description
- Preserve the candidate's technical detail and project substance
- Never rewrite bullets into generic recruiter language
- Never make bullets shorter unless absolutely necessary for clarity
- Preserve the candidate's original wording and style whenever possible
- Be honest — do not suggest inventing or exaggerating skills

When given a resume and job description, produce a complete analysis in the following format using clean markdown. Be specific and role-focused throughout. Do not give broad resume theory unless directly relevant.

---

## 1. Fit Assessment

- **Fit Score**: X/10
- **Level**: Weak / Moderate / Strong
- **Why**: [2-3 sentences explaining the score based on concrete alignment or gaps]

---

## 2. What This Company Values

[Extract the top 6-8 priorities from the job description as a bullet list. Include things like:]
- Frontend/backend/full-stack emphasis
- Specific languages and frameworks they mention
- Whether they want product ownership or IC work
- Performance, scalability, or systems focus
- Startup vs enterprise mindset signals
- Collaboration, customer focus, or team dynamics
- Domain-specific alignment (e.g., fintech, ML, infra)

---

## 3. Resume vs. Requirements

| Requirement | Evidence from Resume | Strength |
|---|---|---|
| [each key requirement] | [matching resume content, or "none found"] | Strong / Medium / Weak / Missing |

---

## 4. Suggested Edits

[Only include edits that meaningfully improve fit. For each:]

**ORIGINAL:** [exact original text from the resume]
**REVISED:** [the revised version]
**WHY:** [one sentence tied directly to the job description]

[If no edit is needed for a section, omit it. Do not pad with trivial suggestions.]

---

## 5. What to Keep Unchanged

[Explicitly list the bullets, sections, or phrases that already align well and should not be touched. Be specific — quote or reference the content.]

---

## 6. Technical Skills Optimization

**Recommended ordering for this role:** [explain priority ordering]

**Full revised skills section:**
[complete rewritten skills section]

**1-line version:**
[condensed single-line format]

**Shortest ATS-safe version:**
[minimal keywords for ATS parsing only]

---

## 7. Application Support

[If the user provided specific application questions, answer those first. Then optionally add 1-2 likely extra questions if useful. If no questions were provided, draft answers for 2-3 likely application questions based on the role and candidate's resume. Format as:]

**Q: [likely question]**
A: [draft answer drawing directly from resume content]

---

## 8. Final Recommendation

- **Ready to submit?** Yes / No / Minor edits needed
- **Confidence**: X/10
- **Top 3 highest-impact edits:**
  1. [most important change]
  2. [second most important]
  3. [third most important]"""


class AnalyzeRequest(BaseModel):
    resume: str
    job_description: str
    application_questions: str | None = None


@app.get("/analysis", response_class=HTMLResponse)
async def analysis_page():
    if not FRONTEND_PATH.exists():
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FRONTEND_PATH.read_text()


SUPPORTED_TYPES = {".pdf", ".docx", ".txt"}


@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    ext = pathlib.Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a PDF, DOCX, or TXT file.",
        )

    content = await file.read()

    if ext == ".pdf":
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n\n".join(p for p in pages if p.strip())
    elif ext == ".docx":
        doc = Document(io.BytesIO(content))
        text = "\n".join(para.text for para in doc.paragraphs)
    else:  # .txt
        text = content.decode("utf-8", errors="replace")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Could not extract any text from the file.")

    return {"text": text}


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    if not request.resume.strip():
        raise HTTPException(status_code=400, detail="Resume cannot be empty")
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty")

    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("JOBMATCH_OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set (or JOBMATCH_OPENAI_API_KEY in cloud settings)")

    user_message = (
        f"Here is my resume:\n\n{request.resume}\n\n"
        f"Here is the job description I am targeting:\n\n{request.job_description}"
    )

    if request.application_questions and request.application_questions.strip():
        user_message += (
            "\n\nHere are specific application questions I need help answering. "
            "Please answer these first in Section 7 before adding any additional likely questions:\n\n"
            f"{request.application_questions.strip()}"
        )

    async def generate():
        try:
            async with openai.AsyncOpenAI(api_key=api_key) as client:
                stream = await client.responses.create(
                    model=os.environ.get("JOBMATCH_OPENAI_MODEL", "gpt-5"),
                    stream=True,
                    max_output_tokens=8000,
                    instructions=SYSTEM_PROMPT,
                    input=user_message,
                )
                async with stream:
                    async for event in stream:
                        if event.type == "response.output_text.delta":
                            yield f"data: {json.dumps({'text': event.delta})}\n\n"
                        elif event.type in {"error", "response.failed", "response.incomplete"}:
                            yield f"data: {json.dumps({'error': 'OpenAI could not complete the analysis. Please try again.'})}\n\n"
                            return
            yield "data: [DONE]\n\n"
        except openai.AuthenticationError:
            yield f"data: {json.dumps({'error': 'Invalid OpenAI API key. Check your API key in environment settings.'})}\n\n"
        except openai.RateLimitError:
            yield f"data: {json.dumps({'error': 'OpenAI rate limit or quota exceeded. Check API billing and limits, then try again.'})}\n\n"
        except openai.BadRequestError:
            yield f"data: {json.dumps({'error': 'OpenAI rejected the request. Check the configured model and input.'})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': 'Unable to complete the OpenAI request. Please try again.'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


from backend.apply import router as apply_router

app.include_router(apply_router)

from fastapi.staticfiles import StaticFiles

app.mount("/assets", StaticFiles(directory=FRONTEND_PATH.parent / "assets"), name="assets")
