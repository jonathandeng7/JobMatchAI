import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
try:
    import httpx2 as httpx
except ImportError:
    import httpx
from backend import codex_provider
from backend.apply import TailoredResume
from backend.main import app

FAKE_CLI = r'''
import json, os, pathlib, sys, time
mode=os.getenv('JOBMATCH_TEST_CODEX_MODE','ok')
if sys.argv[1:3]==['login','status']:
 print('Logged in using an API key - sk-test-private' if mode=='api-key' else 'Logged in using ChatGPT')
 sys.exit(0)
if mode=='slow':time.sleep(10)
if mode=='quota':print('You have reached your usage limit',file=sys.stderr);sys.exit(1)
assert sys.argv[1]=='exec'
assert 'OPENAI_API_KEY' not in os.environ and 'CODEX_API_KEY' not in os.environ and 'JOBMATCH_OPENAI_API_KEY' not in os.environ
assert '--ignore-user-config' in sys.argv and '--ephemeral' in sys.argv
assert sys.argv[sys.argv.index('--sandbox')+1]=='read-only'
assert 'forced_login_method="chatgpt"' in sys.argv
assert 'shell_tool' in sys.argv and 'browser_use' in sys.argv
schema=json.loads(pathlib.Path(sys.argv[sys.argv.index('--output-schema')+1]).read_text())
assert schema['additionalProperties'] is False
assert schema['$defs']['ResumeEdit']['additionalProperties'] is False
prompt=sys.stdin.read()
assert 'Original resume' in prompt and 'Backend job' in prompt
assert all('Original resume' not in a for a in sys.argv)
pathlib.Path(os.environ['JOBMATCH_TEST_CODEX_TRACE']).write_text(json.dumps({'cwd':os.getcwd(),'argv':sys.argv[1:]}))
result=pathlib.Path(sys.argv[sys.argv.index('--output-last-message')+1])
result.write_text('bad JSON' if mode=='invalid' else json.dumps({'resume':'Tailored resume','changes':[],'questions':[]}))
'''


class CodexTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.script = self.root/'fake_codex.py'
        self.script.write_text(FAKE_CLI)
        self.env = patch.dict(os.environ, {'JOBMATCH_DATA_DIR':str(self.root/'data'),
                    'JOBMATCH_AI_PROVIDER':'codex','OPENAI_API_KEY':'test-api-key', 'CODEX_API_KEY':'test-api-key','JOBMATCH_OPENAI_API_KEY':'test-api-key',
                    'JOBMATCH_TEST_CODEX_TRACE':str(self.root/'trace.json')})
        self.env.start()
        self.command = patch('backend.codex_provider.command', return_value=[sys.executable,str(self.script)])
        self.command.start()

    async def asyncTearDown(self):
        self.command.stop();self.env.stop();self.temp.cleanup()

    async def test_cli_uses_chatgpt_auth_stdin_schema_and_ephemeral_read_only_folder(self):
        result = await codex_provider.generate('Preserve facts.','Original resume','Backend job',TailoredResume.model_json_schema())
        self.assertEqual(result['resume'],'Tailored resume')
        trace=json.loads((self.root/'trace.json').read_text())
        self.assertFalse(Path(trace['cwd']).exists())
        self.assertEqual(os.environ['OPENAI_API_KEY'],'test-api-key')

    async def test_api_key_login_is_not_used_as_subscription_auth(self):
        with patch.dict(os.environ, {'JOBMATCH_TEST_CODEX_MODE':'api-key'}):
            ready,message=await codex_provider.status()
            self.assertFalse(ready)
            self.assertNotIn('sk-test-private',message)
            with self.assertRaises(HTTPException) as error:
                await codex_provider.generate('Instructions','Original resume','Backend job',TailoredResume.model_json_schema())
        self.assertEqual(error.exception.status_code,503)
        self.assertFalse((self.root/'trace.json').exists())

    async def test_usage_limits_and_invalid_output_are_reported(self):
        for mode,status in [('quota',429),('invalid',502)]:
            with patch.dict(os.environ, {'JOBMATCH_TEST_CODEX_MODE':mode}):
                with self.assertRaises(HTTPException) as error:
                    await codex_provider.generate('Instructions','Original resume','Backend job',TailoredResume.model_json_schema())
                self.assertEqual(error.exception.status_code,status)

    async def test_timed_out_cli_process_is_stopped(self):
        with patch.dict(os.environ, {'JOBMATCH_TEST_CODEX_MODE':'slow'}):
            with self.assertRaises(HTTPException) as error:
                await codex_provider.capture([sys.executable,str(self.script),'exec'],0.1)
        self.assertEqual(error.exception.status_code,504)

    async def test_missing_cli_gives_install_instructions(self):
        with patch('backend.codex_provider.command',return_value=None):
            ready,message=await codex_provider.status()
        self.assertFalse(ready)
        self.assertIn('npm install -g @openai/codex',message)

    async def test_selected_subscription_provider_does_not_call_openai_sdk(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1:8000') as client:
            with patch('backend.apply.openai.AsyncOpenAI') as api:
                response=await client.post('/tailor',json={'resume':'Original resume','job_description':'Backend job'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['resume'],'Tailored resume')
        api.assert_not_called()

    async def test_provider_choice_persists_and_requires_local_origin(self):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1:8000') as client:
            denied=await client.put('/ai/provider',json={'provider':'codex'},headers={'Origin':'https://evil.example'})
            self.assertEqual(denied.status_code,403)
            response=await client.put('/ai/provider',json={'provider':'codex'})
            self.assertTrue(response.json()['aiConfigured'])
            self.assertEqual(response.json()['aiProvider'],'codex')
            self.assertEqual(json.loads((self.root/'data'/'ai-provider.json').read_text()),{'provider':'codex'})
            saved=(await client.get('/candidate')).json()
            self.assertTrue(saved['aiConfigured'])
            self.assertEqual(saved['aiProvider'],'codex')
            bad=await client.put('/ai/provider',json={'provider':'unknown'})
            self.assertEqual(bad.status_code,422)
