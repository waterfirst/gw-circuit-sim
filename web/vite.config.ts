import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// served under https://waterfirst.pro/circuit/ ; API proxied at /circuit/api/
export default defineConfig({
  base: "/circuit/",
  plugins: [react()],
  server: { proxy: { "/circuit/api": { target: "http://127.0.0.1:8767", rewrite: (p) => p.replace(/^\/circuit/, "") } } },
});
