# GW 회로 시뮬레이터

All-PMOS 게이트 드라이버(GW) 시프트 레지스터를 TFT의 G/S/D 연결과 커패시터로 정의하면 ngspice로 돌려 단별 출력 파형과 PASS/FAIL을 보여주는 웹 서비스.

- 화면: React + Vite + TypeScript (`web/`)
- 서버: FastAPI + ngspice 45 + OSDI p-TFT 모델 `ptft_fit` (`server/`)
- 소자 모델은 합성(synthetic) 모델이며 실측으로 보정되지 않았다.

## 입력
- 전원·구동: VGH, VGL, 라인 주파수(H = 1000/f µs, CLK 주기 2H, Low 폭 0.75H), 단 수, 프레임 수, 홀드 시간
- 클럭 모드: `continuous`(홀드 중에도 계속 토글, 현장 LFD 구동) / `burst`(스캔 때만)
- TFT T1~T12: G/S/D 노드, W, L, ΔVth
- 커패시터: 두 노드와 pF
- 노드 이름: `VGH VGL CLK1 CLK2 IN OUT A B C D E Q QB GND`. 홀수 단 기준이며 짝수 단은 CLK1↔CLK2가 자동으로 바뀐다. IN은 전단 출력(1단은 FLM).

## 판정 (PASS 조건)
프레임마다 각 OUT에 대해
1. Low 펄스가 정확히 1개
2. 단 순서대로 나옴
3. Low 레벨 ≤ `out_low_req`(기본 −6 V)
4. 자기 펄스 밖에서 OUT ≥ VGH − `hold_drop`(기본 1 V)

## 예제 회로 (`server/presets.py`)
| 회로 | 결과(기본 조건, 클럭 계속 토글) |
|---|---|
| 7T | FAIL — QB를 Low로 리셋하는 소자가 없어 홀드 중 OUT 처짐, OUT2~5 이중 펄스 |
| 8T (7T + T8: G=CLK1, D=QB, S=VGL) | PASS |
| 9T (참고 회로) | PASS |

## 실행
```bash
python3 -m venv .venv && .venv/bin/pip install fastapi 'uvicorn[standard]' numpy
cd web && npm install && npm run build && cd ..
cd server && ../.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8767
# 브라우저: http://127.0.0.1:8767/circuit/
```
ngspice(OSDI 지원)가 PATH에 있어야 한다.

## 배포 구조
- 시뮬레이션 서버: 신노트북 `gw-service.service`(systemd user), Tailscale IP에만 바인드, 피어는 localhost·tailnet만 허용
- 공개 주소: `https://waterfirst.pro/circuit/` — 구노트북 nginx가 정적 파일을 내주고 `/circuit/api/`를 Tailscale로 신노트북에 넘긴다 (`deploy/`)
- 보호: 동시 실행 1, 대기 3, IP당 분당 12회, ngspice 120 s 제한, 시뮬레이션 길이 1500 µs 제한, 입력은 화이트리스트 노드와 범위 검사된 숫자만 넷리스트에 들어간다
