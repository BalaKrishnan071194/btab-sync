import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx, ManifestV3Export } from "@crxjs/vite-plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load manifest based on browser target
const browser = process.env["BROWSER"] || "chrome";

// Base manifest shared across all browsers
const baseManifest: ManifestV3Export = {
  manifest_version: 3,
  name: "__MSG_extensionName__",
  description: "__MSG_extensionDescription__",
  version: "2.0.0",
  default_locale: "en",
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  permissions: ["tabs", "activeTab", "storage", "alarms", "sessions"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  action: {
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
    },
    default_title: "bTab Sync",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
  commands: {
    "toggle-overlay": {
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K",
      },
      description: "Toggle bTab Sync",
    },
  },
  web_accessible_resources: [
    {
      resources: [
        "assets/*",
        "icons/*",
      ],
      matches: ["<all_urls>"],
    },
  ],
};

// Browser-specific manifest adjustments
function getManifest(): ManifestV3Export {
  switch (browser) {
    case "firefox":
      // Firefox uses browser_specific_settings
      return {
        ...baseManifest,
        browser_specific_settings: {
          gecko: {
            id: "btab-sync@bvoc.dev",
            strict_min_version: "109.0",
          },
        },
        // Firefox MV3 uses scripts array instead of service_worker
        background: {
          scripts: ["src/background/index.ts"],
          type: "module",
        },
      } as unknown as ManifestV3Export;

    case "edge":
      // Edge is Chromium-based, mostly identical to Chrome
      return baseManifest;

    default: // chrome
      return baseManifest;
  }
}

// bTab Sync — Vite config for Chrome Extension MV3
// Uses @crxjs/vite-plugin for hot reload and multi-browser builds
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: getManifest() }),
  ],

  // Alias for clean imports
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@types": path.resolve(__dirname, "src/types"),
    },
  },

  // Define browser target for conditional code
  define: {
    __BROWSER__: JSON.stringify(browser),
  },

  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
    sourcemap: process.env["NODE_ENV"] === "development",
    minify: "esbuild",
    // Disable module preload polyfill - it uses 'document' which breaks service workers
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        // Prevent code splitting for content scripts (must be single file)
        // This avoids CORS/dynamic import issues on strict pages like YouTube
        manualChunks: undefined,
        inlineDynamicImports: false,
      },
      // Ensure content script is bundled as a single entry
      input: {
        content: "src/content/index.tsx",
        background: "src/background/index.ts",
      },
    },
    // Increase chunk size warning limit since we're bundling everything
    chunkSizeWarningLimit: 700,
  },

  // Dev server config for extension hot reload
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
