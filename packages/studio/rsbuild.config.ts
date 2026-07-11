import { pluginReact } from '@rsbuild/plugin-react';
import { pluginLess } from '@rsbuild/plugin-less';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  plugins: [pluginReact(), pluginLess()],
  source: {
    entry: { index: './src/app.tsx' },
    decorators: { version: 'legacy' },
  },
  html: { title: '视频工作流编辑器' },
  server: {
    port: 5173,
    proxy: {
      '/workflows': { target: 'http://localhost:33011', changeOrigin: true },
      '/api': { target: 'http://localhost:33011', changeOrigin: true },
      '/data': { target: 'http://localhost:33011', changeOrigin: true },
    },
  },
  tools: {
    rspack: {
      ignoreWarnings: [
        /Critical dependency: the request of a dependency is an expression/,
        /__filename/, /__dirname/,
      ],
    },
  },
});
