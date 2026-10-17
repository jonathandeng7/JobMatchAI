import base64
import io
import os
import unittest
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

try:
    import httpx2 as httpx
except ImportError:
    import httpx
from docx import Document
from backend.main import app
from backend.apply import TailoredResume


class ApplyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_apply_and_extension_download(self):
        response = await self.client.get('/apply')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Your next application', response.text)
        response = await self.client.get('/extension.zip')
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            self.assertEqual(set(z.namelist()), {'manifest.json','popup.html','popup.js','fill.js','README.md'})

    async def test_document_round_trip(self):
        response = await self.client.post('/resume-document', json={'resume':'Jonathan Deng\nExperience\nBuilt APIs'})
        self.assertEqual(response.status_code, 200)
        doc = Document(io.BytesIO(base64.b64decode(response.json()['base64'])))
        self.assertEqual([p.text for p in doc.paragraphs], ['Jonathan Deng','Experience','Built APIs'])
        response = await self.client.post('/resume-document', json={'resume':' '})
        self.assertEqual(response.status_code, 400)

    async def test_tailor_missing_key_and_validation(self):
        with patch.dict(os.environ, {}, clear=True):
            response = await self.client.post('/tailor', json={'resume':'Resume','job_description':'Job'})
            self.assertEqual(response.status_code, 503)
            response = await self.client.post('/tailor', json={'resume':' ','job_description':'Job'})
            self.assertEqual(response.status_code, 400)
            response = await self.client.post('/tailor', json={'resume':'x'*40001,'job_description':'Job'})
            self.assertEqual(response.status_code, 422)

    async def test_tailor_structured_result_and_incomplete_response(self):
        parsed = TailoredResume(resume='Reviewed draft', changes=[], questions=['Confirm availability'])
        for completed in (True, False):
            with self.subTest(completed=completed):
                client = AsyncMock()
                client.__aenter__.return_value = client
                client.responses.parse.return_value = SimpleNamespace(status='completed' if completed else 'incomplete',output_parsed=parsed)
                with patch.dict(os.environ, {'JOBMATCH_OPENAI_API_KEY':'test-only'}, clear=True), patch('backend.apply.openai.AsyncOpenAI', return_value=client):
                    response = await self.client.post('/tailor', json={'resume':'Original resume','job_description':'Backend job'})
                self.assertEqual(response.status_code, 200 if completed else 502)
                args = client.responses.parse.call_args.kwargs
                self.assertIs(args['text_format'], TailoredResume)
                self.assertIn('Original resume', args['input'])
                self.assertIn('Backend job', args['input'])
                self.assertIn('Never invent', args['instructions'])
                if completed:self.assertEqual(response.json()['questions'], ['Confirm availability'])
