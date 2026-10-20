"""Run the local app using .venv when available: python run.py."""
import argparse
import importlib
import json
import os
import pathlib
import socket
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent


def open_when_ready(url):
    for _ in range(100):
        try:
            with urllib.request.urlopen(url + 'health', timeout=1) as response:
                identity = json.load(response)
                if identity.get('service') == 'jobmatch-ai' and identity.get('apiVersion') == 2:
                    webbrowser.open(url)
                    return
        except (OSError, ValueError, AttributeError):
            pass
        time.sleep(0.3)


def main():
    local_python = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if local_python.exists() and pathlib.Path(sys.prefix).resolve() != (ROOT / '.venv').resolve():
        os.execv(str(local_python), [str(local_python), str(ROOT / 'run.py'), *sys.argv[1:]])
    parser = argparse.ArgumentParser(description='Start JobMatch AI locally; Apply is the home page.')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true', help='Do not open a browser automatically')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('--port must be between 1 and 65535')
    try:
        import uvicorn
    except ImportError:
        parser.exit(1, 'Dependencies are missing. Install with: python -m pip install -r backend/requirements.txt\n')
    os.chdir(ROOT)
    # Reserve the port before starting readiness checks so we cannot open an
    # unrelated server's page or race another process for the same address.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        if os.name != 'nt':
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        else:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            listener.bind(('127.0.0.1', args.port))
            listener.listen(2048)
        except OSError:
            parser.exit(1, f'Could not listen on port {args.port}. Another server may already be using it.\n'
                        'Stop the old server with Ctrl+C, then rerun python run.py.\n'
                        f'Or choose a free port: python run.py --port {8001 if args.port != 8001 else 8002}\n'
                        'If you change ports, update the local app address in the Chrome extension Connection settings.\n')
        module = importlib.import_module('backend.main')
        if pathlib.Path(module.__file__).resolve() != ROOT / 'backend' / 'main.py':
            parser.exit(1, 'A different backend package was imported. Run this repository’s run.py with its .venv.\n')
        url = f'http://127.0.0.1:{args.port}/'
        print(f'JobMatch AI source: {ROOT}\nApply workspace: {url}\nResume analysis: {url}analysis', flush=True)
        if not args.no_browser:
            threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
        uvicorn.Server(uvicorn.Config(module.app, host='127.0.0.1', port=args.port)).run(sockets=[listener])


if __name__ == '__main__':
    main()
