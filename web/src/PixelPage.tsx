import { useEffect, useMemo, useState } from "react";
import PixelDiagram from "./PixelDiagram";
import Schematic from "./Schematic";
import Waveforms from "./Waveforms";
import { PIXEL_NETS, PIXEL_SIGS, PixelCircuit, PixelResult, PixelTft } from "./types";

import { API } from "./api";

function Num({ label, value, onChange, step = 0.1, unit }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string;
}) {
  return (
    <label className="num">
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      {unit && <em>{unit}</em>}
    </label>
  );
}

const SIG_NOTE: Record<string, string> = {
  GI: "T4 게이트 초기화 (N형, High=켜짐)", GC: "T3 Vth 보상 (N형, High=켜짐)",
  GW: "T2 데이터 쓰기 (P형, Low=켜짐)", EM: "T5·T6 발광 끔 구간 (High=꺼짐)",
  GO: "T7 애노드 초기화 · T8 온바이어스 (P형, Low=켜짐)",
};

export default function PixelPage() {
  const [preset, setPreset] = useState<PixelCircuit | null>(null);
  const [c, setC] = useState<PixelCircuit | null>(null);
  const [res, setRes] = useState<PixelResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showNet, setShowNet] = useState(false);

  useEffect(() => {
    fetch(API + "/pixel/preset").then((r) => r.json()).then((p) => { setPreset(p); setC(structuredClone(p)); })
      .catch(() => setErr("시뮬레이션 서버에 연결할 수 없어요. 서버(신노트북)가 꺼져 있거나 공개 연결이 아직 열리지 않았습니다. 잠시 후 새로고침해 보세요."));
  }, []);

  const set = <K extends keyof PixelCircuit>(k: K, v: PixelCircuit[K]) => c && setC({ ...c, [k]: v });
  const setTft = (n: string, p: Partial<PixelTft>) => c && setC({ ...c, tft: { ...c.tft, [n]: { ...c.tft[n], ...p } } });
  const setTm = (s: string, i: 0 | 1, v: number) => {
    if (!c) return;
    const cur = [...c.timing_us[s]] as [number, number];
    cur[i] = v;
    setC({ ...c, timing_us: { ...c.timing_us, [s]: cur } });
  };

  const run = async () => {
    if (!c) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(API + "/pixel/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c),
      });
      setRes(await r.json());
    } catch {
      setErr("요청 실패: 서버 응답 없음");
    } finally {
      setBusy(false);
    }
  };

  const sameTopo = useMemo(() => {
    if (!c || !preset) return false;
    const a = Object.keys(c.tft).sort(), b = Object.keys(preset.tft).sort();
    if (a.join() !== b.join()) return false;
    return a.every((k) => (["type", "G", "S", "D"] as const).every((p) => c.tft[k][p] === preset.tft[k][p]));
  }, [c, preset]);

  const rows = useMemo(() => {
    if (!res?.series || !c) return [];
    const s = res.series;
    const sig = PIXEL_SIGS.map((k) => ({ key: k, label: k, data: s[`v(${k})`] }));
    const nodes = ["G", "S", "D", "AN"].map((k) => ({
      key: "N" + k, label: k, data: s[`v(${k})`], range: [-5, 8] as [number, number],
    }));
    const i = s["I_OLED_nA"];
    const imax = Math.max(1, ...i);
    return [...sig, ...nodes, { key: "I_OLED", label: "I nA", data: i, range: [0, Math.ceil(imax * 1.1)] as [number, number] }];
  }, [res, c]);

  if (!c) return err ? <section className="card bad"><h2>연결 안 됨</h2><p>{err}</p></section> : <p>불러오는 중…</p>;
  const names = Object.keys(c.tft).sort((a, b) => +a.slice(1) - +b.slice(1));

  return (
    <div>
      <section className="card">
        <div className="row wrapline">
          <h2>{c.name ?? "8T1C 화소"}</h2>
          <button className="ghost" onClick={() => { if (preset) { setC(structuredClone(preset)); setRes(null); } }}>기본값으로</button>
        </div>
        <p className="hint">T1 구동(P) · T2 데이터 쓰기(P, GW) · T3 Vth 보상(산화물 N, GC) · T4 게이트 초기화(산화물 N, GI) · T5/T6 발광(P, EM) · T7 애노드 초기화(P, GO) · T8 온바이어스(P, GO).
          토폴로지 참고: US 11,056,060 B2, US 11,600,229 B2. 소자 값은 합성값이며 특정 제조사 회로가 아닙니다.</p>
        <div className="grid4">
          <Num label="DATA" unit="V" value={c.VDATA} onChange={(x) => set("VDATA", x)} />
          <Num label="ELVDD" unit="V" value={c.ELVDD} onChange={(x) => set("ELVDD", x)} />
          <Num label="ELVSS" unit="V" value={c.ELVSS} onChange={(x) => set("ELVSS", x)} />
          <Num label="VINT" unit="V" value={c.VINT} onChange={(x) => set("VINT", x)} />
          <Num label="VOBS (온바이어스)" unit="V" value={c.VOBS} onChange={(x) => set("VOBS", x)} />
          <Num label="스캔 VGH" unit="V" value={c.VGH} onChange={(x) => set("VGH", x)} />
          <Num label="스캔 VGL" unit="V" value={c.VGL} onChange={(x) => set("VGL", x)} />
          <Num label="프레임 주파수" unit="Hz" step={1} value={c.frame_hz} onChange={(x) => set("frame_hz", x)} />
          <Num label="Cst" unit="fF" step={10} value={c.Cst_fF} onChange={(x) => set("Cst_fF", x)} />
          <Num label="C_OLED" unit="fF" step={5} value={c.Coled_fF} onChange={(x) => set("Coled_fF", x)} />
          <Num label="P형 |Vth|" unit="V" value={c.models.P.VT0} onChange={(x) => set("models", { ...c.models, P: { ...c.models.P, VT0: x } })} />
          <Num label="N형 Vth" unit="V" value={c.models.N.VT0} onChange={(x) => set("models", { ...c.models, N: { ...c.models.N, VT0: x } })} />
        </div>
        <label className="row"><input type="checkbox" checked={c.vth_check} onChange={(e) => set("vth_check", e.target.checked)} />
          <span>T1 Vth ±0.2 V 보상 확인도 같이 돌리기 (3회 실행)</span></label>
      </section>

      <section className="card">
        <h2>회로도</h2>
        {sameTopo
          ? <div className="scroll"><div style={{ minWidth: 680 }}><PixelDiagram c={c} /></div><p className="hint">폰에서는 옆으로 밀어서 보세요.</p></div>
          : <p className="warn">연결을 바꿔서 기본 배선도 대신 노드 태그 회로도로 보여줍니다.</p>}
        <details open={!sameTopo}>
          <summary>노드 태그 회로도 (연결 그대로)</summary>
          <Schematic
            tfts={names.map((n) => ({ name: n, ...c.tft[n] }))}
            caps={[{ name: "Cst", a: "ELVDD", b: "G", value: `${c.Cst_fF} fF` }, { name: "Coled", a: "AN", b: "ELVSS", value: `${c.Coled_fF} fF` }]}
            diodes={[{ name: "OLED", a: "AN", k: "ELVSS", label: "IS 6e-26, N 3" }]}
          />
        </details>
      </section>

      <section className="card">
        <h2>구동 타이밍 (한 프레임 안, µs)</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>신호</th><th>시작</th><th>끝</th><th>역할</th></tr></thead>
            <tbody>
              {PIXEL_SIGS.map((s) => (
                <tr key={s}>
                  <td><b>{s}</b></td>
                  <td><input type="number" step={1} value={c.timing_us[s][0]} onChange={(e) => setTm(s, 0, parseFloat(e.target.value))} /></td>
                  <td><input type="number" step={1} value={c.timing_us[s][1]} onChange={(e) => setTm(s, 1, parseFloat(e.target.value))} /></td>
                  <td className="hint">{SIG_NOTE[s]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">순서: EM 끔 → GI(게이트를 VINT로) → GC 켬, 그 안에서 GW로 데이터 쓰기·Vth 저장 → GO(애노드 리셋·온바이어스) → EM 켬(발광).</p>
      </section>

      <section className="card">
        <h2>TFT</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>TFT</th><th>형</th><th>G</th><th>S</th><th>D</th><th>W µm</th><th>L µm</th><th>ΔVth V</th></tr></thead>
            <tbody>
              {names.map((n) => {
                const p = c.tft[n];
                return (
                  <tr key={n}>
                    <td><b>{n}</b></td>
                    <td><select value={p.type} onChange={(e) => setTft(n, { type: e.target.value as "P" | "N" })}><option>P</option><option>N</option></select></td>
                    {(["G", "S", "D"] as const).map((pin) => (
                      <td key={pin}><select value={p[pin]} onChange={(e) => setTft(n, { [pin]: e.target.value })}>
                        {PIXEL_NETS.map((x) => <option key={x}>{x}</option>)}</select></td>
                    ))}
                    <td><input type="number" step={0.5} value={p.W} onChange={(e) => setTft(n, { W: parseFloat(e.target.value) })} /></td>
                    <td><input type="number" step={0.5} value={p.L} onChange={(e) => setTft(n, { L: parseFloat(e.target.value) })} /></td>
                    <td><input type="number" step={0.05} value={p.dVT ?? 0} onChange={(e) => setTft(n, { dVT: parseFloat(e.target.value) })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="runbar">
        <button className="primary" onClick={run} disabled={busy}>{busy ? "시뮬레이션 중…" : "화소 시뮬레이션 실행"}</button>
        {err && <span className="err">{err}</span>}
      </div>

      {res && !res.ok && (
        <section className="card bad"><h2>실행 안 됨</h2><ul>{res.errors?.map((e, i) => <li key={i}>{e}</li>)}</ul></section>
      )}

      {res?.ok && res.metrics && (
        <>
          <section className="card">
            <h2>결과</h2>
            <div className="stats">
              <div><span>발광 중 OLED 전류</span><b>{res.metrics.I_em_nA.toFixed(1)} nA</b></div>
              <div><span>프레임 평균 전류</span><b>{res.metrics.I_frame_nA.toFixed(1)} nA</b></div>
              <div><span>GC 끝난 직후 G</span><b>{res.metrics.Vg_after_GC_V.toFixed(3)} V</b></div>
              <div><span>발광 중 G 평균</span><b>{res.metrics.Vg_em_V.toFixed(3)} V</b></div>
            </div>
            {res.vth_check && (
              <>
                <h2>Vth 보상 확인 (T1 ΔVth)</h2>
                <div className="scroll">
                  <table className="small">
                    <thead><tr><th>T1 ΔVth</th><th>G (GC 직후)</th><th>발광 전류</th><th>변화</th></tr></thead>
                    <tbody>
                      {res.vth_check.map((r) => (
                        <tr key={r.dVT}><td>{r.dVT > 0 ? "+" : ""}{r.dVT} V</td><td>{r.Vg_after_GC_V?.toFixed(3)} V</td>
                          <td>{r.I_em_nA?.toFixed(1)} nA</td><td>{r.I_change_pct > 0 ? "+" : ""}{r.I_change_pct}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint">보상이 잘 되면 G가 ΔVth만큼 따라 움직이고 전류 변화는 작습니다.</p>
              </>
            )}
            <p className="hint">작업 {res.job} · {res.elapsed_s}s · 두 번째 프레임 기준</p>
          </section>
          <section className="card">
            <h2>파형 (한 프레임)</h2>
            <Waveforms key={res.job} t={res.series!.t_us} rows={rows} vmin={Math.floor(c.VGL)} vmax={Math.ceil(c.VGH)} />
          </section>
          <section className="card">
            <div className="row wrapline">
              <h2>넷리스트</h2>
              <button className="ghost" onClick={() => setShowNet(!showNet)}>{showNet ? "접기" : "보기"}</button>
            </div>
            {showNet && <pre className="net">{res.netlist}</pre>}
          </section>
        </>
      )}
    </div>
  );
}
