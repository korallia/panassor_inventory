import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    // Les appels /api vont au serveur local (server/index.js).
    proxy: { "/api": "http://127.0.0.1:5181" },
  },
});
