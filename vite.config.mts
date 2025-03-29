import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
// Import the Tailwind plugin
import tailwindcss from '@tailwindcss/vite';
// Import the animate plugin if shadcn added it
import tailwindcssAnimate from 'tailwindcss-animate';

export default defineConfig({
  // ... existing cacheDir, server, preview options ...

  plugins: [
    react(),
    nxViteTsPaths(),
    // Add the Tailwind plugin
    tailwindcss(),
  ],

  // ... existing build options ...
}); 