import { useState } from "react";
import DriverPage from "./DriverPage";
import PixelPage from "./PixelPage";

type Tab = "driver" | "pixel";

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (location.hash === "#pixel" ? "pixel" : "driver"));
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", t === "pixel" ? "#pixel" : "#driver"); };
  return (
    <div className="wrap">
      <header>
        <h1>디스플레이 회로 시뮬레이터</h1>
        <p className="sub">
          OLED 패널의 게이트 구동 회로(GIP: GW·EM·GC·GI)와 8T1C LTPO 화소를 TFT 연결로 정의하고 ngspice로 돌려 파형과 판정을 봅니다.
          소자 모델은 합성 TFT(Verilog-A)이며 실측으로 보정되지 않았습니다.
        </p>
        <nav className="tabs">
          <button className={tab === "driver" ? "on" : ""} onClick={() => go("driver")}>구동 회로 (GW·EM·GC·GI)</button>
          <button className={tab === "pixel" ? "on" : ""} onClick={() => go("pixel")}>8T1C LTPO 화소</button>
        </nav>
      </header>
      {/* keep both mounted so inputs survive tab switches */}
      <div hidden={tab !== "driver"}><DriverPage /></div>
      <div hidden={tab !== "pixel"}><PixelPage /></div>
      <footer className="hint">교육·검토용 도구. 회로 출처는 각 예제에 적었고, 소자 크기·용량은 합성 가정입니다.</footer>
    </div>
  );
}
