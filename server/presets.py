"""Reference circuits. Pins follow odd-stage naming: CLK1 = own clock (CKA),
CLK2 = the other clock (CKB); even stages swap them automatically."""

_COMMON = {"VGH": 8.0, "VGL": -9.5, "freq_kHz": 250.0, "stages": 6, "frames": 2,
           "hold_us": 100.0, "clock_mode": "continuous"}

_7T = {
    "T1": {"G": "CLK1", "S": "IN", "D": "B", "W": 8, "L": 4.5},
    "T2": {"G": "B", "S": "VGH", "D": "A", "W": 4, "L": 6},
    "T3": {"G": "VGL", "S": "B", "D": "Q", "W": 4, "L": 4.5},
    "T4": {"G": "B", "S": "VGH", "D": "QB", "W": 4, "L": 4.5},
    "T5": {"G": "A", "S": "QB", "D": "B", "W": 4, "L": 6},
    "T6": {"G": "QB", "S": "VGH", "D": "OUT", "W": 40, "L": 4.5},
    "T7": {"G": "Q", "S": "OUT", "D": "CLK2", "W": 4, "L": 4.5},
}
_7T_CAPS = [{"a": "A", "b": "B", "pF": 1.0}, {"a": "Q", "b": "OUT", "pF": 0.2},
            {"a": "OUT", "b": "GND", "pF": 1.0}]

PRESETS = {
    "7T": {**_COMMON, "name": "7T (사용자 회로, QB 리셋 없음)", "tft": _7T, "caps": _7T_CAPS},
    "8T": {**_COMMON, "name": "8T (7T + T8: CLK1로 QB를 VGL로 리셋)",
           "tft": {**_7T, "T8": {"G": "CLK1", "S": "VGL", "D": "QB", "W": 2, "L": 4.5}},
           "caps": _7T_CAPS},
    "9T": {**_COMMON, "name": "9T (참고 회로)", "flm_lead_us": 0.5, "flm_lag_us": 0.5,
           "tft": {
               "T1": {"G": "CLK1", "S": "IN", "D": "B", "W": 8, "L": 4.5},
               "T2": {"G": "C", "S": "VGH", "D": "A", "W": 4, "L": 6},
               "T3": {"G": "CLK2", "S": "A", "D": "B", "W": 4, "L": 4.5},
               "T4": {"G": "B", "S": "VGH", "D": "C", "W": 4, "L": 4.5},
               "T5": {"G": "CLK1", "S": "QB", "D": "VGL", "W": 4, "L": 6},
               "T6": {"G": "QB", "S": "VGH", "D": "OUT", "W": 40, "L": 4.5},
               "T7": {"G": "Q", "S": "OUT", "D": "CLK2", "W": 4, "L": 4.5},
               "T8": {"G": "VGL", "S": "B", "D": "Q", "W": 4, "L": 4.5},
               "T9": {"G": "CLK2", "S": "QB", "D": "C", "W": 4, "L": 4.5}},
           "caps": [{"a": "VGH", "b": "QB", "pF": 1.0}, {"a": "OUT", "b": "Q", "pF": 0.2},
                    {"a": "OUT", "b": "GND", "pF": 1.0}]},
}
