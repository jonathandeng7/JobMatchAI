import io
import json
import os
import pathlib

import anthropic
import pdfplumber
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="JobMatch AI")

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

[Draft answers for 2-3 likely application questions based on the role and the candidate's resume. Format as:]

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


@app.get("/", response_class=HTMLResponse)
async def root():
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

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    user_message = (
        f"Here is my resume:\n\n{request.resume}\n\n"
        f"Here is the job description I am targeting:\n\n{request.job_description}"
    )

    async def generate():
        try:
            async with client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=8000,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except anthropic.AuthenticationError:
            yield f"data: {json.dumps({'error': 'Invalid API key. Check your ANTHROPIC_API_KEY.'})}\n\n"
        except anthropic.RateLimitError:
            yield f"data: {json.dumps({'error': 'Rate limited. Please try again in a moment.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Error: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
