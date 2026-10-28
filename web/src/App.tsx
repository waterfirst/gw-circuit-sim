import { useEffect, useMemo, useState } from "react";
import Waveforms from "./Waveforms";
import { CAP_NETS, Circuit, PIN_NETS, SimResult, Tft } from "./types";

const API = import.meta.env.BASE_URL + "api";

function Num({ label, value, onChange, step = 0.1, unit }: {
  label: string; value: number | undefined; onChange: (v: number) => void; step?: number; unit?: string;
}) {
  return (
    <label className="num">
      <span>{label}</span>
      <input type="number" step={step} value={value ?? ""}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      {unit && <em>{unit}</em>}
    </label>
  );
}

function NetSelect({ value, nets, onChange }: { value: string; nets: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {nets.map((n) => <option key={n}>{n}</option>)}
    </select>
  );
}

export default function App() {
  const [presets, setPresets] = useState<Record<string, Circuit>>({});
  const [c, setC] = useState<Circuit | null>(null);
  const [res, setRes] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [netErr, setNetErr] = useState("");
  const [stage, setStage] = useState(1);
  const [showNet, setShowNet] = useState(false);

  useEffect(() => {
    fetch(API + "/presets").then((r) => r.json()).then((p) => {
      setPresets(p);
      setC(structuredClone(p["8T"]));
    }).catch(() => setNetErr("서버에 연결할 수 없어요 (시뮬레이션 서버가 꺼져 있을 수 있음)"));
  }, []);

  const set = <K extends keyof Circuit>(k: K, v: Circuit[K]) => c && setC({ ...c, [k]: v });
  const setTft = (name: string, patch: Partial<Tft>) =>
    c && setC({ ...c, tft: { ...c.tft, [name]: { ...c.tft[name], ...patch } } });

  const addTft = () => {
    if (!c) return;
    const free = Array.from({ length: 12 }, (_, i) => `T${i + 1}`).find((n) => !(n in c.tft));
    if (free) setTft(free, { G: "VGL", S: "VGH", D: "QB", W: 4, L: 4.5, dVT: 0 });
  };
  const delTft = (name: string) => {
    if (!c) return;
    const { [name]: _, ...rest } = c.tft;
    setC({ ...c, tft: rest });
  };

  const run = async () => {
    if (!c) return;
    setBusy(true); setNetErr("");
    try {
      const r = await fetch(API + "/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c),
      });
      const j: SimResult = await r.json();
      setRes(j);
      setStage(1);
    } catch {
      setNetErr("요청 실패: 서버 응답 없음");
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    if (!res?.series || !c) return [];
    const s = res.series;
    const out = [
      { key: "FLM", label: "FLM", data: s["v(FLM)"] },
      { key: "CLK1", label: "CLK1", data: s["v(CLK1)"] },
      { key: "CLK2", label: "CLK2", data: s["v(CLK2)"] },
    ];
    for (let i = 1; i <= c.stages; i++) {
      const d = s[`v(OUT${i})`];
      if (d) out.push({ key: `OUT${i}`, label: `OUT${i}`, data: d });
    }
    for (const n of res.internal ?? []) {
      const d = s[`v(x${stage}.${n.toLowerCase()})`];
      if (d) out.push({ key: `N${n}`, label: `${stage}단 ${n}`, data: d });
    }
    return out;
  }, [res, c, stage]);

  if (!c) return <div className="wrap"><h1>GW 회로 시뮬레이터</h1><p>{netErr || "불러오는 중…"}</p></div>;

  const names = Object.keys(c.tft).sort((a, b) => +a.slice(1) - +b.slice(1));
  const v = res?.verdict;

  return (
    <div className="wrap">
      <header>
        <h1>GW 회로 시뮬레이터</h1>
        <p className="sub">
          All-PMOS 게이트 드라이버(GW) 시프트 레지스터를 TFT의 G/S/D 연결로 정의하고 ngspice로 돌려
          단별 출력 파형과 PASS/FAIL을 봅니다. 소자 모델은 합성 p-TFT(Verilog-A)이고 실측으로 맞춘 값이 아닙니다.
        </p>
      </header>

      <section className="card">
        <div className="row wrapline">
          <label className="num"><span>예제 회로</span>
            <select value="" onChange={(e) => { if (e.target.value) { setC(structuredClone(presets[e.target.value])); setRes(null); } }}>
              <option value="">불러오기…</option>
              {Object.entries(presets).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
          </label>
          <span className="hint">현재: {c.name ?? "사용자 회로"}</span>
        </div>
        <div className="grid4">
          <Num label="VGH" unit="V" value={c.VGH} onChange={(x) => set("VGH", x)} />
          <Num label="VGL" unit="V" value={c.VGL} onChange={(x) => set("VGL", x)} />
          <Num label="라인 주파수" unit="kHz" step={10} value={c.freq_kHz} onChange={(x) => set("freq_kHz", x)} />
          <Num label="단 수" step={1} value={c.stages} onChange={(x) => set("stages", Math.round(x))} />
          <Num label="프레임 수" step={1} value={c.frames} onChange={(x) => set("frames", Math.round(x))} />
          <Num label="홀드 시간" unit="µs" step={10} value={c.hold_us} onChange={(x) => set("hold_us", x)} />
          <label className="num"><span>클럭</span>
            <select value={c.clock_mode} onChange={(e) => set("clock_mode", e.target.value as Circuit["clock_mode"])}>
              <option value="continuous">계속 토글 (현장 구동)</option>
              <option value="burst">스캔 때만 (홀드 중 정지)</option>
            </select>
          </label>
          <Num label="OUT Low 스펙" unit="V" value={c.out_low_req ?? -6} onChange={(x) => set("out_low_req", x)} />
        </div>
        <details>
          <summary>고급 설정</summary>
          <div className="grid4">
            <Num label="|Vth| VT0" unit="V" value={c.VT0 ?? 1.1} onChange={(x) => set("VT0", x)} />
            <Num label="이동도 U0" unit="cm²/Vs" step={1} value={c.U0 ?? 65} onChange={(x) => set("U0", x)} />
            <Num label="FLM 앞당김" unit="µs" value={c.flm_lead_us ?? 0} onChange={(x) => set("flm_lead_us", x)} />
            <Num label="FLM 늘림" unit="µs" value={c.flm_lag_us ?? 0} onChange={(x) => set("flm_lag_us", x)} />
            <Num label="홀드 허용 처짐" unit="V" value={c.hold_drop ?? 1} onChange={(x) => set("hold_drop", x)} />
          </div>
          <p className="hint">H = 1000 / 라인 주파수(µs). CLK 주기 = 2H, Low 폭 = 0.75H. 핀 이름은 홀수 단 기준이며 짝수 단은 CLK1↔CLK2가 자동으로 바뀝니다.</p>
        </details>
      </section>

      <section className="card">
        <h2>TFT ({names.length}개)</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>TFT</th><th>G</th><th>S</th><th>D</th><th>W µm</th><th>L µm</th><th>ΔVth V</th><th></th></tr></thead>
            <tbody>
              {names.map((n) => {
                const p = c.tft[n];
                return (
                  <tr key={n}>
                    <td><b>{n}</b></td>
                    {(["G", "S", "D"] as const).map((pin) => (
                      <td key={pin}><NetSelect value={p[pin]} nets={PIN_NETS} onChange={(x) => setTft(n, { [pin]: x })} /></td>
                    ))}
                    <td><input type="number" step={0.5} value={p.W} onChange={(e) => setTft(n, { W: parseFloat(e.target.value) })} /></td>
                    <td><input type="number" step={0.5} value={p.L} onChange={(e) => setTft(n, { L: parseFloat(e.target.value) })} /></td>
                    <td><input type="number" step={0.05} value={p.dVT ?? 0} onChange={(e) => setTft(n, { dVT: parseFloat(e.target.value) })} /></td>
                    <td><button className="ghost" onClick={() => delTft(n)}>삭제</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="ghost" onClick={addTft} disabled={names.length >= 12}>+ TFT 추가</button>
        <p className="hint">IN = 전단 출력(1단은 FLM), OUT = 이 단 출력, A·B·C·D·E·Q·QB = 단 내부 노드.</p>

        <h2>커패시터 ({c.caps.length}개)</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>#</th><th>노드 1</th><th>노드 2</th><th>pF</th><th></th></tr></thead>
            <tbody>
              {c.caps.map((cp, i) => (
                <tr key={i}>
                  <td>C{i + 1}</td>
                  <td><NetSelect value={cp.a} nets={CAP_NETS} onChange={(x) => set("caps", c.caps.map((q, j) => j === i ? { ...q, a: x } : q))} /></td>
                  <td><NetSelect value={cp.b} nets={CAP_NETS} onChange={(x) => set("caps", c.caps.map((q, j) => j === i ? { ...q, b: x } : q))} /></td>
                  <td><input type="number" step={0.05} value={cp.pF} onChange={(e) => set("caps", c.caps.map((q, j) => j === i ? { ...q, pF: parseFloat(e.target.value) } : q))} /></td>
                  <td><button className="ghost" onClick={() => set("caps", c.caps.filter((_, j) => j !== i))}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="ghost" onClick={() => set("caps", [...c.caps, { a: "Q", b: "OUT", pF: 0.2 }])}>+ 커패시터 추가</button>
      </section>

      <div className="runbar">
        <button className="primary" onClick={run} disabled={busy}>{busy ? "시뮬레이션 중… (수 초)" : "시뮬레이션 실행"}</button>
        {netErr && <span className="err">{netErr}</span>}
      </div>

      {res && !res.ok && (
        <section className="card bad">
          <h2>실행 안 됨</h2>
          <ul>{res.errors?.map((e, i) => <li key={i}><pre>{e}</pre></li>)}</ul>
          {res.netlist && <details><summary>넷리스트</summary><pre className="net">{res.netlist}</pre></details>}
        </section>
      )}

      {res?.ok && v && (
        <>
          <section className={"card verdict " + (v.pass ? "good" : "bad")}>
            <h2>{v.pass ? "PASS — 단마다 펄스 1개, 순서·레벨·홀드 정상" : `FAIL — 문제 ${v.problems.length}건`}</h2>
            <p className="hint">작업 {res.job} · ngspice {res.elapsed_s}s · 기준: 프레임마다 OUT 펄스 정확히 1개, 단 순서대로, Low ≤ {c.out_low_req ?? -6} V, 홀드 중 VGH−{c.hold_drop ?? 1} V 이상</p>
            {!!res.warnings?.length && <ul className="warn">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            {!v.pass && <ul>{v.problems.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}</ul>}
            <div className="scroll">
              <table className="small">
                <thead><tr><th>프레임</th><th>단</th><th>펄스</th><th>시작 µs</th><th>Low V</th><th>홀드 최저 V</th><th></th></tr></thead>
                <tbody>
                  {v.stages.map((s) => (
                    <tr key={s.frame + "-" + s.stage} className={s.pass ? "" : "rowbad"}>
                      <td>{s.frame}</td><td>OUT{s.stage}</td><td>{s.pulses}</td>
                      <td>{s.t_first_us ?? "—"}</td><td>{s.low_V}</td><td>{s.hold_min_V}</td>
                      <td>{s.pass ? "✓" : "✗"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="row wrapline">
              <h2>파형</h2>
              <label className="num"><span>내부 노드 볼 단</span>
                <select value={stage} onChange={(e) => setStage(+e.target.value)}>
                  {Array.from({ length: c.stages }, (_, i) => <option key={i} value={i + 1}>{i + 1}단</option>)}
                </select>
              </label>
            </div>
            <Waveforms key={res.job} t={res.series!.t_us} rows={rows}
              vmin={Math.floor(Math.min(res.rails!.VGL, -1))} vmax={Math.ceil(res.rails!.VGH + 1)} />
          </section>

          <section className="card">
            <div className="row wrapline">
              <h2>넷리스트</h2>
              <button className="ghost" onClick={() => setShowNet(!showNet)}>{showNet ? "접기" : "보기"}</button>
              <button className="ghost" onClick={() => {
                const b = new Blob([res.netlist ?? ""], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(b); a.download = `gw_${res.job}.cir`; a.click();
              }}>.cir 내려받기</button>
            </div>
            {showNet && <pre className="net">{res.netlist}</pre>}
          </section>
        </>
      )}
      <footer className="hint">합성 모델 기반 교육·검토용 도구입니다. 실제 공정 값으로 보정되지 않았습니다.</footer>
    </div>
  );
}
