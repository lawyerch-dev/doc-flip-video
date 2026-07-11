/**
 * 视频节点注册 — Start/End 节点 + 视频插件节点
 *
 * 渲染和校验逻辑统一由 nodes-shared 提供
 */

import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';
import { Field } from '@flowgram.ai/free-layout-editor';
import { Input } from '@douyinfe/semi-ui';

import type { FlowNodeRegistry, FlowNodeJSON } from '../typings';
import { useIsSidebar } from '../hooks';
import { buildRegistry, registerManifests, NodeHeader } from '../nodes-shared';
import { getPluginIcon } from './icons';
import { VIDEO_MANIFESTS } from './plugin-manifest';
import { ParamEditor } from './param-editor';
import type { ParamItem } from './param-editor';

// ─── 注册视频节点清单到中央注册表 ───
registerManifests(VIDEO_MANIFESTS);

// ─── Start 节点：定义工作流输入参数 ───

const startRegistry: FlowNodeRegistry = {
  type: 'system:start',
  info: {
    description: '定义工作流的输入参数',
    iconComponent: getPluginIcon('system:start') ?? undefined,
  },
  meta: {
    defaultPorts: [{ type: 'output' }],
    size: { width: 200, height: 52 },
    deleteDisable: true,
    copyDisable: true,
  },
  formMeta: {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const data = form.values?.data;
      const params = (data?.params ?? {}) as Record<string, unknown>;
      const inputs = params.inputs as ParamItem[] | undefined;

      if (isSidebar) {
        const StartIcon = getPluginIcon('system:start');
        return (
          <div style={{
            height: '100%',
            width: '100%',
            background: 'rgb(251, 251, 251)',
            borderRadius: 8,
            border: '1px solid rgba(82,100,154, 0.13)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'linear-gradient(135deg, #4e40e512 0%, transparent 100%)',
              borderBottom: '1px solid rgba(6,7,9,0.08)',
              borderRadius: '8px 8px 0 0',
            }}>
              <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#4e40e518', flexShrink: 0 }}>
                {StartIcon ? <StartIcon size={16} color="#4e40e5" /> : <span style={{ fontSize: 13, color: '#4e40e5' }}>●</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--g-fg-primary, #0f1529d1)', lineHeight: '18px' }}>开始</div>
                <div style={{ fontSize: 11, color: 'var(--g-fg-dim, #8c8f99)', lineHeight: '15px', marginTop: 2 }}>定义工作流的输入参数</div>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--g-space-sm) var(--g-space-lg)' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--g-fg-primary)' }}>工作流名称</label>
                <Field
                  name="data.params.workflowName"
                  render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                    <Input size="small" value={value as string ?? '新工作流'} onChange={(v: string) => onChange(v)} />
                  }
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--g-fg-primary)' }}>输入参数</label>
                <Field
                  name="data.params.inputs"
                  render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                    <ParamEditor value={value as ParamItem[]} onChange={onChange} />
                  }
                />
              </div>
            </div>
          </div>
        );
      }

      const paramCount = Array.isArray(inputs) ? inputs.length : 0;
      const StartIcon = getPluginIcon('system:start');
      return (
        <div>
          <NodeHeader
            icon={StartIcon ? <StartIcon size={16} color="#4e40e5" /> : null}
            name="开始"
            color="#4e40e5"
          />
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--g-fg-secondary)' }}>
            {(params.workflowName as string) || '工作流'}{paramCount > 0 ? ` · ${paramCount}个参数` : ''}
          </div>
        </div>
      );
    },
  },
};

// ─── End 节点：定义工作流输出参数 ───

const endRegistry: FlowNodeRegistry = {
  type: 'system:end',
  info: {
    description: '定义工作流的输出参数',
    iconComponent: getPluginIcon('system:end') ?? undefined,
  },
  meta: {
    defaultPorts: [{ type: 'input' }],
    size: { width: 200, height: 52 },
    deleteDisable: true,
    copyDisable: true,
  },
  formMeta: {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const params = (form.values?.data?.params ?? {}) as Record<string, unknown>;
      const outputs = params.outputs as ParamItem[] | undefined;

      if (isSidebar) {
        const EndIcon = getPluginIcon('system:end');
        return (
          <div style={{
            height: '100%',
            width: '100%',
            background: 'rgb(251, 251, 251)',
            borderRadius: 8,
            border: '1px solid rgba(82,100,154, 0.13)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'linear-gradient(135deg, #e9456012 0%, transparent 100%)',
              borderBottom: '1px solid rgba(6,7,9,0.08)',
              borderRadius: '8px 8px 0 0',
            }}>
              <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#e9456018', flexShrink: 0 }}>
                {EndIcon ? <EndIcon size={16} color="#e94560" /> : <span style={{ fontSize: 13, color: '#e94560' }}>●</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--g-fg-primary, #0f1529d1)', lineHeight: '18px' }}>结束</div>
                <div style={{ fontSize: 11, color: 'var(--g-fg-dim, #8c8f99)', lineHeight: '15px', marginTop: 2 }}>定义工作流的输出参数</div>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--g-space-sm) var(--g-space-lg)' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--g-fg-primary)' }}>输出参数</label>
                <Field
                  name="data.params.outputs"
                  render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                    <ParamEditor value={value as ParamItem[]} onChange={onChange} />
                  }
                />
              </div>
            </div>
          </div>
        );
      }

      const paramCount = Array.isArray(outputs) ? outputs.length : 0;
      const EndIcon = getPluginIcon('system:end');
      return (
        <div>
          <NodeHeader
            icon={EndIcon ? <EndIcon size={16} color="#e94560" /> : null}
            name="结束"
            color="#e94560"
          />
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--g-fg-secondary)' }}>
            {paramCount > 0 ? `${paramCount}个输出参数` : '点击配置输出'}
          </div>
        </div>
      );
    },
  },
};

// ─── 导出 ───

export const nodeRegistries: FlowNodeRegistry[] = [
  startRegistry,
  endRegistry,
  ...VIDEO_MANIFESTS.map(buildRegistry),
];

// 向后兼容 re-exports
export { VideoNodeType } from './constants';
export { type PluginManifest } from './plugin-manifest';
export { fromEngineJSON, toEngineJSON, fetchDefaultWorkflow } from './convert';
export type { EngineWorkflowJSON, EngineNodeJSON } from './convert';
