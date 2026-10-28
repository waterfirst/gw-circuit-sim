"""FastAPI wrapper for the GW simulator. Public traffic arrives only through
the old-laptop nginx (/circuit/api/ -> this host over Tailscale)."""
import asyncio, os, time
from collections import defaultdict, deque

from fastapi import APIRouter, FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

import presets, sim

import ipaddress
# direct peers only: localhost and our own Tailscale tailnet (old-laptop nginx
# proxy included). Public users reach us through that proxy, never directly.
ALLOWED_NETS = [ipaddress.ip_network("127.0.0.0/8"), ipaddress.ip_network("100.64.0.0/10")]


def _peer_ok(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in n for n in ALLOWED_NETS)
RATE_N, RATE_WINDOW_S = 12, 60.0
MAX_QUEUE = 3
MAX_BODY = 32_000

app = FastAPI(title="GW circuit simulator", docs_url=None, redoc_url=None)
_sem = asyncio.Semaphore(1)
_waiting = 0
_hits = defaultdict(deque)
api = APIRouter()
DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "dist")


def _client_ip(req: Request) -> str:
    fwd = req.headers.get("x-real-ip") or req.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or req.client.host


@app.middleware("http")
async def peer_guard(req: Request, call_next):
    if req.client is None or not _peer_ok(req.client.host):
        return JSONResponse({"ok": False, "errors": ["forbidden"]}, status_code=403)
    return await call_next(req)


@api.get("/api/health")
async def health():
    return {"status": "ok", "busy": _sem.locked(), "waiting": _waiting}


@api.get("/api/presets")
async def get_presets():
    return presets.PRESETS


@api.post("/api/simulate")
async def simulate(req: Request):
    global _waiting
    body = await req.body()
    if len(body) > MAX_BODY:
        return JSONResponse({"ok": False, "errors": ["요청이 너무 큼"]}, status_code=413)
    ip, now = _client_ip(req), time.time()
    q = _hits[ip]
    while q and now - q[0] > RATE_WINDOW_S:
        q.popleft()
    if len(q) >= RATE_N:
        return JSONResponse({"ok": False, "errors": ["1분에 12회까지만 실행할 수 있어요. 잠시 후 다시."]},
                            status_code=429)
    q.append(now)
    try:
        desc = await req.json()
    except ValueError:
        return JSONResponse({"ok": False, "errors": ["JSON 형식 오류"]}, status_code=400)
    if _waiting >= MAX_QUEUE:
        return JSONResponse({"ok": False, "errors": ["대기열이 가득 찼어요. 잠시 후 다시."]}, status_code=429)
    _waiting += 1
    try:
        async with _sem:
            return await asyncio.to_thread(sim.run, desc)
    finally:
        _waiting -= 1


# same API at /api (nginx proxy) and /circuit/api (direct Tailscale preview)
app.include_router(api)
app.include_router(api, prefix="/circuit")
if os.path.isdir(DIST):
    app.mount("/circuit", StaticFiles(directory=DIST, html=True), name="web")
