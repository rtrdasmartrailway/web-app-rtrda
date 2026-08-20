
import urllib.request, json, time
from pathlib import Path

TOKEN_FILE = Path('/home/rtrda-dgt/.hermes/credentials/RTRDA_GITHUN_FINE_GRAINED_TOKEN')
token = TOKEN_FILE.read_text().strip()
for i in range(15):
    time.sleep(20)
    req = urllib.request.Request(
        'https://api.github.com/repos/rtrdasmartrailway/web-app-rtrda/actions/runs?branch=test&per_page=1',
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
    )
    try:
        with urllib.request.urlopen(req) as r:
            data = json.load(r)
        run = data['workflow_runs'][0]
        print(f'[{i+1}] status={run["status"]} conclusion={run.get("conclusion")} title={run["display_title"]!r}')
        if run['conclusion'] == 'success':
            print('SUCCESS')
            break
        if run['conclusion'] == 'failure':
            print('FAILED')
            break
    except Exception as e:
        print(f'[{i+1}] err: {e}')
