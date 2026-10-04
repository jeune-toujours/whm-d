"""Run on the WHM VM to enable the explicitly authorized staging simulators.
Reads the protected API token; changes staging only and prints no credentials.
"""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

repo = Path(os.environ.get('WHM_REPO', '/home/pavel/whm-d'))
settings = json.loads((repo / 'infra/coolify/environments.json').read_text())['staging']
token_file = Path('/home/pavel/.config/whm/coolify-token')
if token_file.stat().st_mode & 0o077:
    raise SystemExit('Token file must have mode 600')
token = token_file.read_text().strip()
def api(path, method='GET', data=None):
    request = Request('http://127.0.0.1:8000/api/v1/' + path, method=method,
                      headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json'},
                      data=json.dumps(data).encode() if data is not None else None)
    try:
        with urlopen(request, timeout=30) as r:
            return json.load(r)
    except HTTPError as e:
        raise SystemExit('Coolify HTTP ' + str(e.code) + '; endpoint ' + path) from None

for target, values, build in [
    ('backend', {'SIMULATE_INTEGRATIONS': 'true', 'SEED_STAGING': 'true', 'STAGING_TEST_PHONE': '+79990000001'}, False),
    ('frontend', {'VITE_DEMO_MODE': 'false', 'VITE_API_URL': '/api'}, True),
]:
    app = settings[target]
    record = api('applications/' + app)
    if record.get('git_branch') != 'develop':
        raise SystemExit('Refusing changes outside develop')
    envs = api('applications/' + app + '/envs')
    normal = {entry['key'] for entry in envs if not entry.get('is_preview')}
    for key, value in values.items():
        api('applications/' + app + '/envs', 'PATCH' if key in normal else 'POST', {
            'key': key, 'value': value, 'is_buildtime': build, 'is_runtime': not build,
            'is_literal': True, 'is_multiline': False, 'is_preview': False,
        })
        print(target + ': configured ' + key)

runtime = Path('/home/pavel/.config/whm/staging.runtime.env')
if not runtime.exists() or runtime.stat().st_mode & 0o077:
    raise SystemExit('Protected staging.runtime.env is required')
with runtime.open('a') as output:
    output.write('\nSIMULATE_INTEGRATIONS=true\nSEED_STAGING=true\nSTAGING_TEST_PHONE=+79990000001\n')
os.chmod(runtime, 0o600)
print('Protected staging runtime flags saved. Deployment was not triggered.')
