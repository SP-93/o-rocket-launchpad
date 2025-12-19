import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/*.png"],
      manifest: false, // Use manual manifest.json in public folder
      workbox: {
        skipWaiting: true, // New SW takes control immediately
        clientsClaim: true, // Activates without waiting for refresh
        cleanupOutdatedCaches: true, // Automatically removes old cache versions
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB for Web3Modal bundle
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Production security optimizations
  build: {
    // Disable source maps in production for security
    sourcemap: mode === "development",
    minify: "terser",
    terserOptions: {
      compress: {
        // Remove console.log in production (keep errors and warnings)
        drop_console: mode === "production",
        drop_debugger: true,
        pure_funcs: mode === "production" ? ['console.log', 'console.info', 'console.debug'] : [],
      },
      mangle: {
        // Mangle property names for additional obfuscation
        properties: false,
      },
    },
    // Don't generate .map files in production
    rollupOptions: {
      output: {
        // Obfuscate chunk names
        chunkFileNames: mode === "production" ? "assets/[hash].js" : "assets/[name]-[hash].js",
        entryFileNames: mode === "production" ? "assets/[hash].js" : "assets/[name]-[hash].js",
        assetFileNames: mode === "production" ? "assets/[hash].[ext]" : "assets/[name]-[hash].[ext]",
      },
    },
  },
  // Prevent leaking env variables
  define: {
    __DEV__: mode === "development",
  },
}));
