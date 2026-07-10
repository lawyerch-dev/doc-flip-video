/**
 * Code Node — Execute custom JavaScript/Python code
 */
import type { NodeManifest } from '../nodes-shared';
import { commonIcons } from './icons';

export const CODE_NODE: NodeManifest = {
  id: 'common:code',
  name: '代码执行',
  category: 'code',
  description: '运行自定义代码处理数据',
  color: '#00b894',
  icon: commonIcons.code,
  ports: [
    { type: 'input', name: 'input' },
    { type: 'output', name: 'result' },
  ],
  params: {
    language: {
      type: 'select',
      label: '语言',
      default: 'javascript',
      options: [
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
      ],
    },
    code: {
      type: 'textarea',
      label: '代码',
      placeholder: '// 使用 inputs 访问输入变量\nreturn inputs;',
      rows: 8,
      description: '使用 inputs.inputName 访问参数，return 输出结果',
    },
  },
  outputs: [
    { key: 'result', name: '执行结果', type: 'object', description: '代码 return 的值' },
  ],
};
