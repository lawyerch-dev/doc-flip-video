/**
 * HTTP Node — Make API requests
 */
import type { CommonNodeManifest } from './types';
import { commonIcons } from './icons';

export const HTTP_NODE: CommonNodeManifest = {
  id: 'common:http',
  name: 'HTTP 请求',
  category: 'http',
  description: '发送 HTTP 请求调用外部 API',
  color: '#fd79a8',
  icon: commonIcons.http,
  ports: [
    { type: 'input', name: 'input' },
    { type: 'output', name: 'response' },
  ],
  params: {
    method: {
      type: 'select',
      label: '方法',
      default: 'GET',
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'DELETE', value: 'DELETE' },
      ],
    },
    url: {
      type: 'string',
      label: 'URL',
      placeholder: 'https://api.example.com/endpoint',
      description: '请求地址，支持 {{变量}} 模板',
    },
    headers: {
      type: 'textarea',
      label: '请求头',
      placeholder: 'Content-Type: application/json\nAuthorization: Bearer {{token}}',
      rows: 3,
      description: '每行一个 Header，格式：Key: Value',
    },
    body: {
      type: 'textarea',
      label: '请求体',
      placeholder: '{"key": "{{变量}}"}',
      rows: 5,
      description: 'JSON 格式请求体（仅 POST/PUT/PATCH）',
    },
    timeout: {
      type: 'number',
      label: '超时(秒)',
      default: 30,
      min: 1,
      max: 300,
      step: 1,
    },
  },
  outputs: [
    { key: 'status', name: '状态码', type: 'number', description: 'HTTP 响应状态码' },
    { key: 'body', name: '响应体', type: 'object', description: '解析后的响应数据' },
    { key: 'headers', name: '响应头', type: 'object', description: '响应头信息' },
  ],
};
