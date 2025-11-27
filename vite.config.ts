import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { resolve } from 'path';
function pathResolve(dir: string) {
  return resolve(process.cwd(), '.', dir);
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      https: {
        cert: fs.readFileSync(pathResolve('public/ssl') + '/cert.crt'),
        key: fs.readFileSync(pathResolve('public/ssl') + '/cert.key'),
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
