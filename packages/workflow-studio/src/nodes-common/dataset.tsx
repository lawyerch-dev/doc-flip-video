/**
 * Dataset / Knowledge Node — Query knowledge base or dataset
 */
import type { NodeManifest } from '../nodes-shared';
import { commonIcons } from './icons';

export const DATASET_NODE: NodeManifest = {
  id: 'common:dataset',
  name: '知识库查询',
  category: 'dataset',
  description: '从知识库或数据集中检索信息',
  color: '#00cec9',
  icon: commonIcons.dataset,
  ports: [
    { type: 'input', name: 'query' },
    { type: 'output', name: 'result' },
  ],
  params: {
    query: {
      type: 'textarea',
      label: '查询内容',
      placeholder: '输入查询内容，支持 {{变量}} 引用',
      rows: 3,
      description: '要检索的问题或关键词',
    },
    topK: {
      type: 'number',
      label: '返回数量',
      default: 5,
      min: 1,
      max: 50,
      step: 1,
    },
    minScore: {
      type: 'number',
      label: '最低相似度',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: '低于此分数的不返回',
    },
  },
  outputs: [
    { key: 'results', name: '检索结果', type: 'array', description: '匹配的文档列表' },
    { key: 'count', name: '结果数量', type: 'number', description: '返回的文档数量' },
  ],
};
