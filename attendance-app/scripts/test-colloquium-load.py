#!/usr/bin/env python3
"""Own a disposable local PostgreSQL/server for the real 70-student/600s rehearsal.

Run npm run build first. Supply only the new assessment key via an ignored file
or COLLOQUIUM_BANK_KEY; this harness never downloads production credentials.
"""
import argparse
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bank-key-file', type=Path)
parser.add_argument('--output-dir', type=Path)
args = parser.parse_args()
app = Path(__file__).resolve().parents[1]
if 'VERCEL' in os.environ:
    parser.error('This rehearsal must never run in a deployment environment')
if not (app / '.next/BUILD_ID').is_file():
    parser.error('Run npm run build first')
key = args.bank_key_file.read_text().strip() if args.bank_key_file else os.environ.get('COLLOQUIUM_BANK_KEY', '')
if len(key) != 64 or any(c not in '0123456789abcdefABCDEF' for c in key):
    parser.error('Supply the assessment key via --bank-key-file or environment; do not paste it into command arguments')
output = args.output_dir or Path(tempfile.mkdtemp(prefix='colloquium-load-'))
output.mkdir(parents=True, exist_ok=True)
container = 'colloquium-load-' + secrets.token_hex(6)
server = None
with (output / 'server.log').open('w') as server_log:
    try:
        subprocess.run(['docker', 'run', '--detach', '--rm', '--name', container,
                        '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_DB=attendance_e2e',
                        '--env', 'POSTGRES_USER=attendance_e2e', '--env', 'POSTGRES_PASSWORD=disposable-load',
                        'postgres:16-alpine'], check=True, stdout=subprocess.DEVNULL)
        for attempt in range(60):
            ready = subprocess.run(['docker', 'exec', container, 'pg_isready', '--host', '127.0.0.1',
                                    '--username', 'attendance_e2e', '--dbname', 'attendance_e2e'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            if attempt == 59:
                raise RuntimeError('Disposable PostgreSQL did not start')
            time.sleep(.25)
        database_port = subprocess.check_output(['docker', 'port', container, '5432/tcp'], text=True).strip().rsplit(':', 1)[1]
        for migration in sorted((app / 'drizzle').glob('000*.sql')):
            with migration.open('rb') as source:
                subprocess.run(['docker', 'exec', '--interactive', container, 'psql', '--username', 'attendance_e2e',
                                '--dbname', 'attendance_e2e', '--set', 'ON_ERROR_STOP=1'],
                               stdin=source, stdout=subprocess.DEVNULL, check=True)
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            web_port = reservation.getsockname()[1]
        environment = os.environ.copy()
        environment.pop('E2E_TEST_AUTH', None)
        environment.pop('E2E_DISPOSABLE_DATABASE', None)
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=app, text=True).strip()
        environment.update(
            DATABASE_URL=f'postgresql://attendance_e2e:disposable-load@127.0.0.1:{database_port}/attendance_e2e',
            NEXTAUTH_URL=f'http://127.0.0.1:{web_port}', NEXTAUTH_SECRET=secrets.token_hex(32),
            RATE_LIMIT_SECRET=secrets.token_hex(32), GITHUB_ID='isolated-load-client',
            GITHUB_SECRET='isolated-load-secret', PROFESSOR_GITHUB_ID='900000001', NODE_ENV='production',
            COLLOQUIUM_BANK_KEY=key, COLLOQUIUM_LOAD_DISPOSABLE='1', COLLOQUIUM_LOAD_COMMIT=commit,
            COLLOQUIUM_LOAD_REPORT=str((output / '70-student-report.json').resolve()),
        )
        server = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1',
                                   '--port', str(web_port)], cwd=app, env=environment,
                                  stdout=server_log, stderr=subprocess.STDOUT)
        for attempt in range(80):
            if server.poll() is not None:
                raise RuntimeError('Disposable Next server exited; inspect server.log')
            try:
                with urllib.request.urlopen(environment['NEXTAUTH_URL'], timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                if attempt == 79:
                    raise RuntimeError('Disposable Next server did not become ready')
                time.sleep(.25)
        subprocess.run(['node', 'scripts/test-colloquium-load.mjs'], cwd=app, env=environment, check=True)
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        subprocess.run(['docker', 'rm', '--force', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
