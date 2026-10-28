# 디스플레이 회로 시뮬레이터 (GIP + 8T1C LTPO 화소)

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
| EM 12T3C (Samsung Display US 11,205,374 B2 1실시예 연결, 크기는 합성) | PASS (High 펄스, 폭 = 시작 폭 − 1H). M1·M2를 4u로 두면 CLK2 하강이 C1로 N3·N1을 끌어내려 출력이 안 나옴 → 20u |
| GC / GI | EM형 단을 양의 펄스 n-scan 드라이버로 재사용 (가정). 시작 폭 4H / 2H |

## 8T1C LTPO 화소 (`server/pixel.py`)
- 토폴로지: T1 구동(P), T2 쓰기(P, GW), T3 보상(산화물 N, GC), T4 게이트 초기화(N, GI), T5·T6 발광(P, EM), T7 애노드 초기화·T8 온바이어스(P, GO). 참고 US 11,056,060 B2, US 11,600,229 B2. 값은 합성
- 결과(기본값): DATA 2/3/4 V → 발광 전류 1673/749/194 nA. T1 ΔVth ±0.2 V → 전류 ±1.3% (보상 동작)
- API: `GET /api/pixel/preset`, `POST /api/pixel/simulate`

## 열화·온도 (`server/device.py`, `server/aging.py`)
- TR마다 ΔVth, Ion 배수, Ioff 배수, SS 배수 입력. 온도 입력 시 Ioff ×exp(0.35 eV), SS ∝ T, |Vth| −2 mV/K (모델에 온도항이 없어 카드 값을 바꿈)
- 고온 장기 구동: 정상 회로 파형에서 TR별 게이트 스트레스(켜진 비율, |Vgs|)를 재서 늘어진 지수 법칙으로 ΔVth·Ion·Ioff·SS 계산. 계수는 합성 가정이며 화면에서 수정 가능
- VGH·VGL 마진 맵: 새 소자와 열화 소자를 격자로 비교 (구동 회로 = PASS/FAIL, 화소 = 발광 전류 변화 %)
- 예: 8T의 T1을 ΔVth +3 V, Ion ×0.3으로 열화시키면 VGL −10 V에서 FAIL, −12 V 이하에서 PASS. T6 열화(홀드 처짐)는 VGH·VGL로 회복되지 않음

## 설치 (다른 PC·회사)
`AGENTS.md` 참고. 요약: `pip install -r requirements.txt` → `bash scripts/build_model.sh`(로컬 OpenVAF로 모델 컴파일) → `server/tests/selfcheck.py` ALL PASS 확인 → `bash scripts/run_local.sh`

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
- 공개 주소: `https://waterfirst.pro/circuit/` (구노트북 nginx가 정적 파일) — API는 신노트북 Tailscale Funnel `https://waterfirst-gpu.tail351ee9.ts.net/circuit/api` 로 직접 호출(CORS). 같은 앱이 Funnel 주소 `/circuit/` 에서도 열린다
- nginx `/circuit/api/` 프록시(`deploy/`)는 설정 파일에만 넣었고 reload(sudo) 전이라 아직 안 쓴다
- Funnel 끄기: `tailscale funnel --https=443 off`
- 보호: 동시 실행 1, 대기 3, IP당 분당 12회, ngspice 120 s 제한, 시뮬레이션 길이 1500 µs 제한, 입력은 화이트리스트 노드와 범위 검사된 숫자만 넷리스트에 들어간다
