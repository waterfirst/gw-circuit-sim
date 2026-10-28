export type Pin = "G" | "S" | "D";
export interface Tft { G: string; S: string; D: string; W: number; L: number; dVT?: number }
export interface Cap { a: string; b: string; pF: number }

export interface Circuit {
  name?: string;
  VGH: number; VGL: number; freq_kHz: number; stages: number; frames: number;
  hold_us: number; clock_mode: "continuous" | "burst";
  VT0?: number; U0?: number; flm_lead_us?: number; flm_lag_us?: number;
  out_low_req?: number; hold_drop?: number;
  tft: Record<string, Tft>;
  caps: Cap[];
}

export interface StageVerdict {
  frame: number; stage: number; pulses: number; t_first_us: number | null;
  low_V: number; hold_min_V: number; pass: boolean; why: string[];
}

export interface SimResult {
  ok: boolean; errors?: string[]; warnings?: string[]; job?: string; elapsed_s?: number;
  netlist?: string; internal?: string[];
  timing?: Record<string, number>;
  verdict?: { pass: boolean; problems: string[]; stages: StageVerdict[] };
  series?: Record<string, number[]>;
  rails?: { VGH: number; VGL: number };
}

export const PIN_NETS = ["VGH", "VGL", "CLK1", "CLK2", "IN", "OUT", "A", "B", "C", "D", "E", "Q", "QB"];
export const CAP_NETS = [...PIN_NETS, "GND"];
