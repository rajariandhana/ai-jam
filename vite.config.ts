import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 41743,
    // Fail loudly instead of drifting onto the next free port, which would
    // collide with the API on 41744.
    strictPort: true,
  },
  plugins: [react(), tailwindcss()],
});
