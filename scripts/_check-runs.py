import urllib.request, json
from pathlib import Path

TOKEN_FILE = Path('/home/rtrda-dgt/.hermes/credentials/RTRDA_GITHUN_FINE_GRAINED_TOKEN')
token = TOKEN_FILE.read_text().strip()
runs = json.load(urllib.request.urlopen(urllib.request.Request(
    'https://api.github.com/repos/rtrdasmartrailway/web-app-rtrda/actions/runs?branch=test&per_page=12',
    headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
)))['workflow_runs']

print(f'{"RUN#":>5}  {"CONCLUSION":10}  {"SHA":7}  {"BRANCH":6}  TITLE')
print('-' * 100)
for r in runs:
    title = (r.get('display_title') or r.get('name') or '?')[:55]
    print(f'#{r["run_number"]:>4}  {r["conclusion"]:10}  {r["head_sha"][:7]}  {r["head_branch"]:6}  {title}')
