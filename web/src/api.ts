// On waterfirst.pro the old-laptop nginx cannot proxy the API yet, so the page
// calls the simulator host directly through its Tailscale Funnel URL.
// Everywhere else (Funnel itself, Tailscale, local dev) the API is same-origin.
const FUNNEL = "https://waterfirst-gpu.tail351ee9.ts.net/circuit/api";
export const API = /(^|\.)waterfirst\.pro$/.test(location.hostname)
  ? FUNNEL
  : import.meta.env.BASE_URL + "api";
