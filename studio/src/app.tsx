/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';

import { Editor } from './editor';
import { WorkflowList } from './pages/workflow-list';

/**
 * React 18/19 polyfill for form-materials
 */
unstableSetCreateRoot(createRoot);

type View = { page: 'list' } | { page: 'editor'; workflowId: string };

function App() {
  const [view, setView] = useState<View>({ page: 'list' });

  switch (view.page) {
    case 'list':
      return <WorkflowList onEdit={(id) => setView({ page: 'editor', workflowId: id })} />;
    case 'editor':
      return <Editor workflowId={view.workflowId} onBack={() => setView({ page: 'list' })} />;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
