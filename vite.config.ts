import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite only answers localhost by default. To open the game through a forwarded or preview address,
// list its hostname in .env.local (not committed), e.g. CLIPPER_ALLOWED_HOSTS=my-box-5173.example.dev
function allowedHosts(mode: string): string[] | true | undefined {
  const raw = loadEnv(mode, process.cwd(), 'CLIPPER_').CLIPPER_ALLOWED_HOSTS?.trim();
  if (!raw) return undefined;
  if (raw === 'all') return true;
  return raw.split(',').map((host) => host.trim()).filter(Boolean);
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, allowedHosts: allowedHosts(mode) },
  preview: { port: 4173, allowedHosts: allowedHosts(mode) },
}));
