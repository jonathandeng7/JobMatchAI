"""Private, single-user persistence for the loopback-only development app."""
import json
import os
import pathlib
import re
import tempfile
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints

ROOT = pathlib.Path(__file__).resolve().parent.parent
ShortText = Annotated[str, StringConstraints(max_length=2000)]


class Candidate(BaseModel):
    profile: dict[str, ShortText] = Field(default_factory=dict, max_length=40)
    resume: str = Field(default='', max_length=40000)
    resumeName: str = Field(default='My resume', max_length=200)


def require_local_client(request: Request):
    # A loopback bind alone does not protect against malicious browser origins
    # or DNS rebinding. These endpoints contain private local applicant data.
    if request.url.hostname not in {'127.0.0.1', 'localhost', '::1'}:
        raise HTTPException(403, 'Saved profiles are only available through the local app.')
    origin = request.headers.get('origin')
    if origin and origin != str(request.base_url).rstrip('/') and not re.fullmatch(r'chrome-extension://[a-p]{32}', origin):
        raise HTTPException(403, 'This website cannot access your saved profile.')
    if not origin and request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Cross-site profile access is not allowed.')


def candidate_path():
    return pathlib.Path(os.getenv('JOBMATCH_DATA_DIR', str(ROOT / '.local'))) / 'candidate.json'


def read_candidate():
    path = candidate_path()
    if not path.exists():
        return Candidate()
    try:
        return Candidate.model_validate_json(path.read_text())
    except (ValueError, OSError):
        raise HTTPException(503, 'Your saved profile could not be read. Check the local data folder before replacing it.') from None


def write_candidate(candidate: Candidate):
    path = candidate_path()
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False, encoding='utf-8') as file:
            temporary = pathlib.Path(file.name)
            json.dump(candidate.model_dump(), file, ensure_ascii=False)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def validate_job_url(value: str):
    if not value:
        return
    try:
        url = urlsplit(value)
        port = url.port
    except ValueError:
        raise HTTPException(400, 'Invalid job application URL.') from None
    host = url.hostname or ''
    if url.scheme != 'https' or url.username or url.password or port not in (None, 443) or not (
        host in {'jobs.lever.co', 'jobs.ashbyhq.com', 'jobs.smartrecruiters.com', 'careers.smartrecruiters.com',
                 'greenhouse.io', 'myworkdayjobs.com', 'myworkdaysite.com'}
        or host.endswith(('.greenhouse.io', '.myworkdayjobs.com', '.myworkdaysite.com'))
    ):
        raise HTTPException(400, 'Open a Greenhouse, Lever, Ashby, SmartRecruiters, or Workday job application.')
