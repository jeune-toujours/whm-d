"""Run on the WHM VM: python3 scripts/coolify.py list|deploy|status staging|production.

Uses the protected token file. Prints selected metadata only; never secrets or logs.
"""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['list', 'deploy', 'status'])
parser.add_argument('environment', nargs='?', choices=['staging', 'production'])
args = parser.parse_args()
if args.action != 'list' and not args.environment:
    parser.error('Choose staging or production')
configuration = json.loads((Path(__file__).resolve().parent.parent / 'infra/coolify/environments.json').read_text())
token_file = Path(os.environ.get('WHM_COOLIFY_TOKEN_FILE', '/home/pavel/.config/whm/coolify-token'))
if token_file.stat().st_mode & 0o077:
    raise SystemExit('Token file must have mode 600')
token = token_file.read_text().strip()
base = os.environ.get('COOLIFY_URL', 'http://127.0.0.1:8000').rstrip('/')

def api(path, body=None):
    request = Request(base + '/api/v1/' + path, data=json.dumps(body).encode() if body is not None else None,
                      headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise SystemExit(f'Coolify API HTTP {error.code}; endpoint: {path}') from None

if args.action == 'list':
    fields = ['uuid', 'name', 'git_branch', 'fqdn', 'status']
    print(json.dumps([{key: app.get(key) for key in fields} for app in api('applications')], indent=2))
else:
    selected = configuration[args.environment]
    ids = [selected[name] for name in ['frontend', 'backend'] if selected.get(name)]
    if args.action == 'deploy':
        result = api('deploy', {'uuid': ','.join(ids)})
        print(json.dumps({'environment': args.environment, 'deployments': result.get('deployments', [])}, indent=2))
        print('Queued. Verify deployment completion, HTTPS health and commit before reporting success.')
    else:
        for app_id in ids:
            result = api('deployments/applications/' + app_id)
            deployments = result if isinstance(result, list) else result.get('deployments', [])
            fields = ['deployment_uuid', 'status', 'commit', 'created_at', 'finished_at']
            print(json.dumps({'app': app_id, 'deployments': [{key: item.get(key) for key in fields} for item in deployments[:3]]}, indent=2))
