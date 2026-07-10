/**
 * Variable Node — Set or get workflow variables
 */
import type { NodeManifest } from '../nodes-shared';
import { commonIcons } from './icons';

export const SET_VARIABLE_NODE: NodeManifest = {
  id: 'common:set-variable',
  name: '设置变量',
  category: 'variable',
  description: '创建或更新工作流变量',
  color: '#fdcb6e',
  icon: commonIcons.variable,
  ports: [
    { type: 'input', name: 'input' },
    { type: 'output', name: 'output' },
  ],
  params: {
    variableName: {
      type: 'string',
      label: '变量名',
      placeholder: 'myVariable',
      description: '变量的名称，字母开头，只支持字母数字下划线',
    },
    variableType: {
      type: 'select',
      label: '变量类型',
      default: 'string',
      options: [
        { label: '文本', value: 'string' },
        { label: '数字', value: 'number' },
        { label: '布尔', value: 'boolean' },
        { label: '对象', value: 'object' },
        { label: '数组', value: 'array' },
      ],
    },
    value: {
      type: 'textarea',
      label: '值',
      placeholder: '支持 {{变量}} 引用',
      rows: 3,
      description: '变量的值，可以使用 {{变量名}} 引用其他变量',
    },
  },
  outputs: [
    { key: 'variable', name: '变量值', type: 'object', description: '设置后的变量值' },
  ],
};
