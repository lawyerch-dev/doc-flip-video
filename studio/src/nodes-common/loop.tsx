/**
 * Loop Node — repeat a sub-process N times or iterate over a list
 */
import type { CommonNodeManifest } from './types';
import { commonIcons } from './icons';

export const LOOP_NODE: CommonNodeManifest = {
  id: 'common:loop',
  name: '循环',
  category: 'loop',
  description: '重复执行或遍历列表中的每一项',
  color: '#6c5ce7',
  icon: commonIcons.loop,
  ports: [
    { type: 'input', name: 'iterate' },
    { type: 'output', name: 'iteration' },
  ],
  params: {
    mode: {
      type: 'select',
      label: '循环模式',
      default: 'count',
      options: [
        { label: '按次数', value: 'count' },
        { label: '遍历列表', value: 'list' },
      ],
      description: '按指定次数循环，或遍历一个数组',
    },
    count: {
      type: 'integer',
      label: '循环次数',
      default: 3,
      min: 1,
      max: 100,
      description: '循环执行的次数（按次数模式）',
    },
    listData: {
      type: 'textarea',
      label: '数据列表',
      placeholder: '["item1", "item2", "item3"]',
      rows: 3,
      description: '要遍历的 JSON 数组（遍历列表模式）',
    },
    itemVariable: {
      type: 'string',
      label: '元素变量名',
      default: 'item',
      description: '循环中每个元素存储的变量名',
    },
  },
  outputs: [
    { key: 'result', name: '循环结果', type: 'array', description: '每次迭代的结果数组' },
    { key: 'count', name: '执行次数', type: 'number' },
  ],
};
