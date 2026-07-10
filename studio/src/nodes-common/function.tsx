/**
 * Function Node — simple data transformation using expressions
 * Simpler than Code node: just transforms input to output with a formula
 */
import type { CommonNodeManifest } from './types';
import { commonIcons } from './icons';

export const FUNCTION_NODE: CommonNodeManifest = {
  id: 'common:function',
  name: '数据转换',
  category: 'utility',
  description: '用表达式转换输入数据，支持 {{变量}} 引用',
  color: '#00b894',
  icon: commonIcons.function,
  ports: [
    { type: 'input', name: 'input' },
    { type: 'output', name: 'result' },
  ],
  params: {
    expression: {
      type: 'textarea',
      label: '表达式',
      placeholder: '例如: inputs.value * 2 + 1',
      rows: 4,
      description: '使用 inputs.key 访问输入参数，return 结果',
    },
    outputName: {
      type: 'string',
      label: '输出变量名',
      placeholder: 'result',
      description: '转换结果的变量名称',
    },
  },
  outputs: [
    { key: 'result', name: '转换结果', type: 'object' },
  ],
};
