"""Classify upstream 429s without exposing response text or credentials."""
import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import math

import openai


@dataclass(frozen=True)
class LimitInfo:
    kind: str
    retry_after: int | None = None

    @property
    def message(self):
        fallback = ' You can still fill saved information without AI.'
        if self.kind == 'quota':
            return ('OpenAI API credits or quota are exhausted. Add API credits or check the API key’s project and billing limits; waiting alone will not fix this. ChatGPT/Codex subscription payments are separate.' + fallback)
        if self.kind == 'rate':
            wait = f' Wait {self.retry_after} seconds before retrying.' if self.retry_after else ' Wait briefly before retrying.'
            return 'OpenAI temporarily rate-limited this project.' + wait + fallback
        return ('OpenAI returned HTTP 429 without a recognized quota or rate-limit code. Check this key’s project usage and request limits to identify the cause.' + fallback)


def classify_limit(error):
    body = error.body if isinstance(getattr(error, 'body', None), dict) else {}
    nested = body.get('error') if isinstance(body.get('error'), dict) else {}
    codes = {value for value in (getattr(error, 'code', None), body.get('code'), body.get('type'), nested.get('code'), nested.get('type')) if isinstance(value, str)}
    message = str(nested.get('message') or body.get('message') or '')[:2048].lower()
    if codes & {'insufficient_quota', 'billing_hard_limit_reached'} or 'exceeded your current quota' in message:
        return LimitInfo('quota')
    if 'rate_limit_exceeded' not in codes and 'rate limit reached' not in message:
        return LimitInfo('unknown')
    headers = getattr(getattr(error, 'response', None), 'headers', {})
    raw = headers.get('retry-after')
    seconds = None
    if raw:
        try:
            delay = float(raw)
        except (TypeError, ValueError):
            try:
                delay = (parsedate_to_datetime(raw) - datetime.now(timezone.utc)).total_seconds()
            except (TypeError, ValueError, OverflowError):
                delay = float('nan')
        if math.isfinite(delay) and 0 <= delay <= 86400:
            seconds = math.ceil(delay)
    return LimitInfo('rate', seconds)


async def retry_temporary_limit(operation):
    """One bounded retry, only before a response and for a known rate limit."""
    try:
        return await operation()
    except openai.RateLimitError as error:
        info = classify_limit(error)
        delay = info.retry_after if info.retry_after is not None else 2
        if info.kind != 'rate' or delay > 5:
            raise
        await asyncio.sleep(delay)
        return await operation()
