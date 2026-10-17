"""Run the local app using .venv when available: python run.py."""
import argparse
import os
import pathlib
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent


def open_when_ready(url):
    for _ in range(100):
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    webbrowser.open(url)
                    return
        except OSError:
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
    try:
        import uvicorn
    except ImportError:
        parser.exit(1, 'Dependencies are missing. Install with: python -m pip install -r backend/requirements.txt\n')
    os.chdir(ROOT)
    url = f'http://127.0.0.1:{args.port}/'
    print(f'Apply workspace: {url}\nResume analysis: {url}analysis', flush=True)
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
    uvicorn.run('backend.main:app', host='127.0.0.1', port=args.port)


if __name__ == '__main__':
    main()
