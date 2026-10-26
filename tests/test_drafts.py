import base64
import io
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

try:
    import httpx2 as httpx
except ImportError:
    import httpx
from docx import Document
from backend.apply import TailoredResume
from backend.main import app
from backend import drafts


class DraftTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{'JOBMATCH_DATA_DIR':self.temp.name});self.env.start()
        self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1:8000')
        await self.client.put('/candidate',json={'profile':{'firstName':'Alex','lastName':'Sample'},'resume':'Base resume'})

    async def asyncTearDown(self):
        await self.client.aclose();self.env.stop();self.temp.cleanup()

    async def generate(self):
        result=TailoredResume(resume='Tailored resume',changes=[],questions=['Check dates'])
        with patch('backend.apply.tailor',new=AsyncMock(return_value=result)):
            response=await self.client.post('/autofill',json={'job_description':'Backend engineering role. '*10,'job_url':'https://jobs.lever.co/example/1','job_title':'Engineer / ../../Example'})
        self.assertEqual(response.status_code,200)
        return response.json()

    async def test_named_document_and_history_survive_a_new_session(self):
        result=await self.generate()
        self.assertIn('Alex-Sample',result['document']['filename'])
        self.assertNotIn('/',result['document']['filename'])
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1:8000') as client:
            history=(await client.get('/drafts')).json()['drafts']
            self.assertEqual(history[0]['id'],result['draftId'])
            self.assertNotIn('resume',history[0])
            saved=(await client.get('/drafts/'+result['draftId'])).json()
        self.assertEqual(saved['resume'],'Tailored resume')
        self.assertNotIn('profile',saved)
        doc=Document(io.BytesIO(base64.b64decode(saved['document']['base64'])))
        self.assertEqual(doc.paragraphs[0].text,'Tailored resume')
        self.assertEqual((await self.client.get('/candidate')).json()['resume'],'Base resume')

    async def test_history_is_private_and_rejects_invalid_identifiers(self):
        await self.generate()
        self.assertEqual((await self.client.get('/drafts',headers={'Origin':'https://evil.example'})).status_code,403)
        self.assertEqual((await self.client.get('/drafts/not-a-uuid')).status_code,404)

    async def test_history_write_failure_keeps_the_document_available(self):
        with patch('backend.apply.drafts.save',side_effect=OSError('disk full')):
            result=await self.generate()
        self.assertIn('saveWarning',result)
        self.assertTrue(result['document']['base64'])
        self.assertNotIn('draftId',result)
