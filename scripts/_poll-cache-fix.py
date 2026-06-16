import os, urllib.request, json

env_lines = open('/srv/workspace/hermes/.env').readlines()
for line in env_lines:
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ[k] = v

token = os.environ['GITHUB_FINE_GRAINS_TOKEN']
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
