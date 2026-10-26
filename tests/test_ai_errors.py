import unittest
from unittest.mock import AsyncMock, patch

import openai
try:
    import httpx2 as httpx
except ImportError:
    import httpx
from backend.ai_errors import classify_limit, retry_temporary_limit


def limited(body, retry=None):
    response = httpx.Response(429, request=httpx.Request('POST','https://api.openai.com/v1/responses'),
                              headers={'Retry-After':retry} if retry is not None else {})
    return openai.RateLimitError('Limited', response=response, body=body)


class LimitTests(unittest.IsolatedAsyncioTestCase):
    async def test_flat_nested_and_message_only_quota_are_not_retried(self):
        for body in ({'code':'insufficient_quota'}, {'error':{'type':'insufficient_quota'}},
                     {'message':'You exceeded your current quota, please check your plan and billing details.'}):
            with self.subTest(body=body):
                error = limited(body, '1')
                self.assertEqual(classify_limit(error).kind,'quota')
                operation = AsyncMock(side_effect=error)
                with patch('backend.ai_errors.asyncio.sleep', new=AsyncMock()) as sleep:
                    with self.assertRaises(openai.RateLimitError):
                        await retry_temporary_limit(operation)
                operation.assert_awaited_once()
                sleep.assert_not_awaited()

    async def test_temporary_limit_retries_once_and_can_succeed(self):
        operation = AsyncMock(side_effect=[limited({'error':{'code':'rate_limit_exceeded'}},'1.5'),'completed'])
        with patch('backend.ai_errors.asyncio.sleep', new=AsyncMock()) as sleep:
            self.assertEqual(await retry_temporary_limit(operation),'completed')
        self.assertEqual(operation.await_count,2)
        sleep.assert_awaited_once_with(2)

    async def test_repeated_rate_limit_stops_after_one_retry(self):
        error = limited({'code':'rate_limit_exceeded'})
        operation = AsyncMock(side_effect=error)
        with patch('backend.ai_errors.asyncio.sleep', new=AsyncMock()) as sleep:
            with self.assertRaises(openai.RateLimitError):
                await retry_temporary_limit(operation)
        self.assertEqual(operation.await_count,2)
        sleep.assert_awaited_once_with(2)

    async def test_long_delay_and_unknown_429_are_not_retried(self):
        for error in (limited({'code':'rate_limit_exceeded'},'60'), limited({'message':'Limited'})):
            operation = AsyncMock(side_effect=error)
            with patch('backend.ai_errors.asyncio.sleep', new=AsyncMock()) as sleep:
                with self.assertRaises(openai.RateLimitError):
                    await retry_temporary_limit(operation)
            operation.assert_awaited_once()
            sleep.assert_not_awaited()

    def test_invalid_retry_headers_do_not_crash(self):
        for value in ('invalid','nan','-20','1e100'):
            info = classify_limit(limited({'code':'rate_limit_exceeded'},value))
            self.assertIsNone(info.retry_after)
        self.assertEqual(classify_limit(limited({'code':'rate_limit_exceeded'},'60')).retry_after,60)
