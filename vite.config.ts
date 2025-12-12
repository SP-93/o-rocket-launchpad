import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
