"""Exercise the actual launcher, including the stale-port failure path."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


class LauncherTests(unittest.TestCase):
    def test_occupied_port_reports_recovery_instead_of_opening_another_app(self):
        with socket.socket() as occupied:
            occupied.bind(('127.0.0.1', 0))
            occupied.listen()
            port = occupied.getsockname()[1]
            result = subprocess.run([sys.executable, str(ROOT / 'run.py'), '--port', str(port), '--no-browser'],
                                    cwd=ROOT, capture_output=True, text=True, timeout=15)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f'Could not listen on port {port}', result.stderr)
        self.assertIn('Connection settings', result.stderr)
        self.assertNotIn('Apply workspace:', result.stdout)

    def test_launcher_serves_correct_routes_even_from_another_working_directory(self):
        with socket.socket() as available:
            available.bind(('127.0.0.1', 0))
            port = available.getsockname()[1]
        with tempfile.TemporaryDirectory() as directory:
            environment = {**os.environ, 'JOBMATCH_DATA_DIR': directory}
            process = subprocess.Popen([sys.executable, str(ROOT / 'run.py'), '--port', str(port), '--no-browser'],
                                       cwd=directory, env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            try:
                base = f'http://127.0.0.1:{port}'
                deadline = time.monotonic() + 15
                while True:
                    try:
                        with urllib.request.urlopen(base + '/health', timeout=1) as response:
                            identity = json.load(response)
                        break
                    except (OSError, ValueError):
                        if process.poll() is not None:
                            self.fail(process.stdout.read())
                        if time.monotonic() >= deadline:
                            self.fail('Launcher did not become ready within 15 seconds')
                        time.sleep(0.1)
                self.assertEqual(identity['service'], 'jobmatch-ai')
                self.assertEqual(identity['apiVersion'], 2)
                self.assertIn('saved-profile', identity['features'])
                with urllib.request.urlopen(base + '/') as response:
                    self.assertIn('Their next hire.', response.read().decode())
                with urllib.request.urlopen(base + '/candidate') as response:
                    self.assertFalse(json.load(response)['ready'])
                with urllib.request.urlopen(base + '/apply') as response:
                    self.assertEqual(response.status, 200)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
                process.stdout.close()
