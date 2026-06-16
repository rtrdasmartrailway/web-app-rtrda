import os, urllib.request, json, subprocess

# Source env from hermes
subprocess.run(['bash', '-c', 'set -a && source /srv/workspace/hermes/.env && set +a'], check=True)
# Manually load into current process via reading the env file
env_lines = open('/srv/workspace/hermes/.env').readlines()
for line in env_lines:
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ[k] = v

token = os.environ['GITHUB_FINE_GRAINS_TOKEN']
runs = json.load(urllib.request.urlopen(urllib.request.Request(
    'https://api.github.com/repos/rtrdasmartrailway/web-app-rtrda/actions/runs?branch=test&per_page=12',
    headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
)))['workflow_runs']

print(f'{"RUN#":>5}  {"CONCLUSION":10}  {"SHA":7}  {"BRANCH":6}  TITLE')
print('-' * 100)
for r in runs:
    title = (r.get('display_title') or r.get('name') or '?')[:55]
    print(f'#{r["run_number"]:>4}  {r["conclusion"]:10}  {r["head_sha"][:7]}  {r["head_branch"]:6}  {title}')
