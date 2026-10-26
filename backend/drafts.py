"""Private generated-resume history, retained outside Git tracking."""
from datetime import datetime, timezone
import json
import re
import tempfile
import os
import unicodedata
from uuid import UUID, uuid4

from fastapi import HTTPException
from backend.candidate import candidate_path


def folder():
    return candidate_path().parent / 'drafts'


def filename(profile, title):
    def slug(value):
        value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
        return re.sub(r'[^A-Za-z0-9]+', '-', value).strip('-')[:70] or 'resume'
    name = ' '.join(profile.get(k, '') for k in ('firstName','lastName')).strip()
    return f'{slug(name or "resume")}-{slug(title or "tailored")}.docx'


def save(bundle, title):
    identifier = str(uuid4())
    record = {key: bundle[key] for key in ('resume','document','changes','questions','generatedForJob','jobUrl')}
    record.update(id=identifier, jobTitle=title or 'Tailored resume', createdAt=datetime.now(timezone.utc).isoformat())
    directory = folder()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=directory, delete=False, encoding='utf-8') as stream:
            temporary = stream.name
            json.dump(record, stream, ensure_ascii=False, default=lambda item:item.model_dump())
        os.replace(temporary, directory / f'{identifier}.json')
    finally:
        if temporary and os.path.exists(temporary): os.unlink(temporary)
    return identifier


def load(identifier):
    try:
        identifier = str(UUID(identifier))
    except ValueError:
        raise HTTPException(404, 'Saved resume not found.') from None
    try:
        return json.loads((folder() / f'{identifier}.json').read_text(encoding='utf-8'))
    except FileNotFoundError:
        raise HTTPException(404, 'Saved resume not found.') from None
    except (OSError, ValueError):
        raise HTTPException(503, 'Could not read this saved resume.') from None


def recent():
    directory = folder()
    if not directory.exists(): return []
    result = []
    for path in directory.glob('*.json'):
        try:
            item = json.loads(path.read_text(encoding='utf-8'))
            result.append({key:item[key] for key in ('id','jobTitle','jobUrl','createdAt')})
        except (OSError, ValueError, KeyError):
            continue
    return sorted(result, key=lambda item:item['createdAt'], reverse=True)[:20]
