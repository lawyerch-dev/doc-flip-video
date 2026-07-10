/**
 * LLM Node — Coze-inspired AI model invocation node
 */
import type { CommonNodeManifest } from './types';
import { commonIcons } from './icons';

export const LLM_NODE: CommonNodeManifest = {
  id: 'common:llm',
  name: 'LLM 调用',
  category: 'llm',
  description: '调用大语言模型处理文本',
  color: '#5c62ff',
  icon: commonIcons.llm,
  ports: [
    { type: 'input', name: 'prompt' },
    { type: 'output', name: 'result' },
  ],
  params: {
    model: {
      type: 'model',
      label: '模型',
      default: 'gpt-4o-mini',
      description: '选择要调用的 AI 模型',
      required: true,
    },
    prompt: {
      type: 'textarea',
      label: '提示词',
      placeholder: '输入提示词模板，支持 {{变量名}} 引用',
      rows: 5,
      description: '使用 {{变量名}} 引用上游节点的输出',
    },
    temperature: {
      type: 'number',
      label: '温度',
      default: 0.7,
      min: 0,
      max: 2,
      step: 0.1,
      description: '控制输出的随机性，0=确定，2=完全随机',
    },
    maxTokens: {
      type: 'number',
      label: '最大 Token',
      default: 2048,
      min: 1,
      max: 32768,
      step: 1,
      description: '生成的最大 token 数量',
    },
    systemPrompt: {
      type: 'textarea',
      label: '系统提示',
      placeholder: '可选系统级提示词',
      rows: 3,
    },
  },
  outputs: [
    { key: 'text', name: '生成文本', type: 'string', description: '模型输出的文本' },
    { key: 'usage', name: 'Token 用量', type: 'object', description: '输入/输出 token 数量' },
  ],
};
