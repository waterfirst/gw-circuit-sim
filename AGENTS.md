# Setup guide for coding agents (Codex etc.)

Goal: install and run this display-circuit simulator on a machine that already has
ngspice (with OSDI support, 39+) and OpenVAF. Nothing here needs internet access
except `pip install` (and optional `npm`).

## Steps
1. Check tools: `ngspice --version` (must load OSDI: `pre_osdi` command), `openvaf --version`, `python3 --version` (3.9+).
2. Python env: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
   - Offline pip: install fastapi, uvicorn, numpy from the local mirror; versions are not pinned tightly.
3. Build the model with the local OpenVAF: `bash scripts/build_model.sh`
   - Do not reuse the committed `server/ptft_fit.osdi`; the OSDI ABI depends on the build.
   - Non-default paths: `OPENVAF=/path/to/openvaf`, and at run time `GW_NGSPICE=/path/to/ngspice`, `GW_OSDI=/path/to/ptft_fit.osdi`.
4. Self-check: `cd server && ../.venv/bin/python tests/selfcheck.py` — must print `ALL PASS`.
   Small numeric drift on another ngspice build is fine; PASS/FAIL outcomes must match. If a check fails, report the line; do not edit expected values to make it pass.
5. Run: `bash scripts/run_local.sh` then open `http://127.0.0.1:8767/circuit/`.
   - The built web UI is committed in `web/dist/`, so npm is not required.
   - To rebuild the UI (optional): `cd web && npm ci && npm run build`.

## Rules for this repository
- The public presets use public patents and synthetic sizes only. If you add company netlists,
  device cards or measured data, keep them in an untracked folder (for example `local/`, add it to
  `.git/info/exclude`) and never commit or push them.
- Do not expose the server outside the company network. `run_local.sh` binds to 127.0.0.1;
  set `GW_HOST` only if the operator asks.
- `server/app.py` allows only localhost and 100.64.0.0/10 peers. If users reach it through a
  company reverse proxy, add that proxy address to `ALLOWED_NETS` and `NGINX_PEER`.

## Where things are
- `server/sim.py` driver (GIP) simulator: netlist build, ngspice run, PASS/FAIL judge
- `server/pixel.py` 8T1C LTPO pixel simulator
- `server/device.py` model card with temperature and degradation (dVT, Ion, Ioff, SS)
- `server/aging.py` high-temperature stress -> degradation, and VGH/VGL margin maps
- `server/presets.py` circuits (GW 7T/8T/9T, EM 12T3C from US 11,205,374 B2, GC, GI)
- `models/ptft_fit.va` TFT compact model source (Verilog-A)
- `web/` React UI (Vite); `web/dist/` prebuilt
