
import urllib.request, json, time, os, base64
token = os.environ['GITHUB_FINE_GRAINS_TOKEN']
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
