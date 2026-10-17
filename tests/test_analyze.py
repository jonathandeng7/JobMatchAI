import json
import os
import unittest
from unittest.mock import patch

import openai
try:
    import httpx2 as httpx
except ImportError:
    import httpx
from fastapi import HTTPException
from backend.main import AnalyzeRequest, SYSTEM_PROMPT, analyze


class AnalyzeTests(unittest.IsolatedAsyncioTestCase):
    async def run_analysis(self, events=None, status=200, variables=None):
        captured = []

        def handler(request):
            captured.append(json.loads(request.content))
            self.assertEqual(request.url.path, '/v1/responses')
            if status != 200:
                return httpx.Response(status, json={'error': {'message': 'upstream detail', 'type': 'test_error'}})
            body = ''.join('event: ' + event['type'] + '\ndata: ' + json.dumps(event) + '\n\n' for event in events)
            return httpx.Response(200, text=body, headers={'content-type': 'text/event-stream'})

        client = openai.AsyncOpenAI(api_key='test-only', max_retries=0,
                                    http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        with patch.dict(os.environ, variables or {'OPENAI_API_KEY': 'test-only'}, clear=True), \
                patch('backend.main.openai.AsyncOpenAI', return_value=client) as constructor:
            response = await analyze(AnalyzeRequest(resume='Python engineer', job_description='Backend role', application_questions='Why us?'))
            body = ''.join([chunk async for chunk in response.body_iterator])
            self.assertEqual(constructor.call_args.kwargs['api_key'], 'test-only')
        self.assertTrue(client.is_closed())
        return body, captured

    async def test_stream_and_prompt(self):
        body, calls = await self.run_analysis([{'type': 'response.output_text.delta', 'delta': 'Strong fit', 'item_id': 'msg_1', 'output_index': 0, 'content_index': 0, 'sequence_number': 1}])
        self.assertIn('"text": "Strong fit"', body)
        self.assertTrue(body.endswith('data: [DONE]\n\n'))
        self.assertEqual(calls[0]['instructions'], SYSTEM_PROMPT)
        self.assertEqual(calls[0]['model'], 'gpt-5')
        for text in ('Python engineer', 'Backend role', 'Why us?'):
            self.assertIn(text, calls[0]['input'])

    async def test_cloud_key_and_model_override(self):
        _, calls = await self.run_analysis([], variables={'JOBMATCH_OPENAI_API_KEY': 'test-only', 'JOBMATCH_OPENAI_MODEL': 'custom-model'})
        self.assertEqual(calls[0]['model'], 'custom-model')

    async def test_upstream_errors(self):
        for status, message in [(401, 'Invalid OpenAI API key'), (429, 'quota exceeded'), (400, 'rejected the request'), (500, 'Unable to complete')]:
            with self.subTest(status=status):
                body, _ = await self.run_analysis(status=status)
                self.assertIn(message, body)
                self.assertNotIn('[DONE]', body)
                self.assertNotIn('upstream detail', body)

    async def test_stream_failures(self):
        for event_type in ('error', 'response.failed', 'response.incomplete'):
            with self.subTest(event=event_type):
                body, _ = await self.run_analysis([{'type': event_type, 'sequence_number': 1}])
                self.assertIn('"error":', body)
                self.assertNotIn('[DONE]', body)

    async def test_missing_key_and_empty_inputs(self):
        with patch.dict(os.environ, {}, clear=True):
            for resume, job, status in [(' ', 'job', 400), ('resume', ' ', 400), ('resume', 'job', 500)]:
                with self.subTest(status=status):
                    with self.assertRaises(HTTPException) as error:
                        await analyze(AnalyzeRequest(resume=resume, job_description=job))
                    self.assertEqual(error.exception.status_code, status)
