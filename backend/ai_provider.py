"""Persist a provider preference, never authentication credentials."""
import json
import os
import tempfile
from typing import Literal

from fastapi import HTTPException
from backend.candidate import candidate_path
from backend import codex_provider

Provider = Literal['codex', 'openai']


def selected():
    path = candidate_path().parent / 'ai-provider.json'
    if path.exists():
        try:
            provider = json.loads(path.read_text())['provider']
        except (ValueError, OSError, KeyError, TypeError):
            raise HTTPException(503, 'Could not read your local AI provider setting.') from None
    else:
        provider = os.getenv('JOBMATCH_AI_PROVIDER', 'openai')
    if provider not in {'codex', 'openai'}:
        raise HTTPException(503, 'Choose codex or openai as the local AI provider.')
    return provider


def save(provider: Provider):
    path = candidate_path().parent / 'ai-provider.json'
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False, encoding='utf-8') as stream:
            temporary = stream.name
            json.dump({'provider': provider}, stream)
        os.replace(temporary, path)
    except OSError:
        raise HTTPException(503, 'Could not save the local AI provider setting.') from None
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


async def status():
    provider = selected()
    if provider == 'codex':
        ready, message = await codex_provider.status()
    else:
        ready = bool(os.getenv('OPENAI_API_KEY') or os.getenv('JOBMATCH_OPENAI_API_KEY'))
        message = 'OpenAI API tailoring uses separately billed API credits.' if ready else 'Add an OpenAI API key, or choose Codex with your ChatGPT subscription in Connection settings.'
    return {'aiProvider': provider, 'aiConfigured': ready, 'aiSetupMessage': message}
