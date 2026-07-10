/**
 * Condition Node — If/Else branch
 */
import type { NodeManifest } from '../nodes-shared';
import { commonIcons } from './icons';

export const CONDITION_NODE: NodeManifest = {
  id: 'common:condition',
  name: '条件分支',
  category: 'condition',
  description: '根据条件判断走不同分支',
  color: '#e17055',
  icon: commonIcons.condition,
  ports: [
    { type: 'input', name: 'input' },
    { type: 'output', name: 'true' },
    { type: 'output', name: 'false' },
  ],
  params: {
    leftValue: {
      type: 'string',
      label: '左值',
      placeholder: '{{变量名}} 或直接输入值',
      description: '比较的左侧值',
    },
    operator: {
      type: 'select',
      label: '运算符',
      default: 'eq',
      options: [
        { label: '等于 (==)', value: 'eq' },
        { label: '不等于 (!=)', value: 'neq' },
        { label: '大于 (>)', value: 'gt' },
        { label: '大于等于 (>=)', value: 'gte' },
        { label: '小于 (<)', value: 'lt' },
        { label: '小于等于 (<=)', value: 'lte' },
        { label: '包含', value: 'contains' },
        { label: '以...开头', value: 'startsWith' },
        { label: '为空', value: 'empty' },
        { label: '不为空', value: 'notEmpty' },
      ],
    },
    rightValue: {
      type: 'string',
      label: '右值',
      placeholder: '比较的右侧值',
    },
  },
  outputs: [
    { key: 'result', name: '判断结果', type: 'boolean', description: '条件计算结果' },
  ],
};
