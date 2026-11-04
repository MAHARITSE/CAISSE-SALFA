import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Injecte le jeu d'essai dans l'application pendant le développement.
 *
 * `apply: 'serve'` garantit que le script n'existe ni dans `vite build` ni dans
 * le paquet WAMP : le déploiement ne contient aucune donnée de démonstration.
 */
function amorceDemo(): Plugin {
  return {
    name: 'amorce-demo',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        '  <script type="module" src="/demo/amorce.js"></script>\n  </body>',
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), amorceDemo()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
