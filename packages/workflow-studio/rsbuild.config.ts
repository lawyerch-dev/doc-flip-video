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
  dev: {
    assetPrefix: '/workflow/',
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/workflow/workflows': { target: 'http://localhost:33011', changeOrigin: true },
      '/workflow/api': { target: 'http://localhost:33011', changeOrigin: true },
      '/workflow/data': { target: 'http://localhost:33011', changeOrigin: true },
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
