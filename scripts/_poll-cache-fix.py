import urllib.request, json
from pathlib import Path

TOKEN_FILE = Path('/home/rtrda-dgt/.hermes/credentials/RTRDA_GITHUN_FINE_GRAINED_TOKEN')
token = TOKEN_FILE.read_text().strip()
runs = json.load(urllib.request.urlopen(urllib.request.Request(
    'https://api.github.com/repos/rtrdasmartrailway/web-app-rtrda/actions/runs?branch=test&per_page=3',
    headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
)))['workflow_runs']

for r in runs:
    title = (r.get('display_title') or r.get('name') or '?')[:55]
    conc = r.get('conclusion') or '-'
    print(f'#{r["run_number"]:>4}  {conc:8}  {r["head_sha"][:7]}  {title}')

import time
for i in range(15):
    runs = json.load(urllib.request.urlopen(urllib.request.Request(
        'https://api.github.com/repos/rtrdasmartrailway/web-app-rtrda/actions/runs?branch=test&per_page=1',
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
    )))['workflow_runs']
    run = runs[0]
    print(f'[{i+1}] {run["status"]:10} {run.get("conclusion") or "-":8} {run["head_sha"][:7]}  {(run.get("display_title") or "?")[:50]}')
    if run['conclusion'] == 'success':
        print('SUCCESS')
        break
    if run['conclusion'] == 'failure':
        print('FAILED')
        break
    time.sleep(20)
