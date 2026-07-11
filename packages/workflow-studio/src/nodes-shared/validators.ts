/**
 * 共享校验器 — 从 ParamDef 自动生成校验函数
 *
 * 合并了 nodes-video 和 nodes-common 两套校验逻辑
 */

import type { ParamDef } from './types';

/** 为单个参数构建校验函数 */
export function buildParamValidator(
  def: ParamDef,
  key: string,
): (value: unknown) => string | undefined {
  return (value: unknown): string | undefined => {
    const val = value as string | number | boolean | undefined | null;

    // 必填检查
    if (def.required) {
      if (val === undefined || val === null || val === '') {
        return `${def.label} 为必填项`;
      }
    }

    // 非空时再做类型检查
    if (val === undefined || val === null || val === '') return undefined;

    switch (def.type) {
      case 'number':
      case 'integer': {
        const num = Number(val);
        if (isNaN(num)) return `${def.label} 必须是数字`;
        if (def.type === 'integer' && num !== Math.floor(num))
          return `${def.label} 必须是整数`;
        if (def.min !== undefined && num < def.min)
          return `${def.label} 不能小于 ${def.min}`;
        if (def.max !== undefined && num > def.max)
          return `${def.label} 不能大于 ${def.max}`;
        break;
      }
      case 'select': {
        if (def.options) {
          const opts = Array.isArray(def.options)
            ? (typeof def.options[0] === 'string'
              ? (def.options as string[]).map(o => o)
              : (def.options as Array<{ label: string; value: string }>).map(o => o.value))
            : [];
          if (def.required && !opts.includes(val as string)) {
            return `${def.label} 请选择有效选项`;
          }
        }
        break;
      }
      case 'string':
      case 'textarea': {
        const s = val as string;
        if (def.maxLength && s.length > def.maxLength)
          return `${def.label} 不能超过 ${def.maxLength} 个字符`;
        if (def.pattern) {
          try {
            if (!new RegExp(def.pattern).test(s))
              return def.patternMessage || `${def.label} 格式不正确`;
          } catch {}
        }
        break;
      }
      case 'json':
      case 'object': {
        try {
          JSON.parse(val as string);
        } catch {
          return `${def.label} 必须是有效的 JSON 格式`;
        }
        break;
      }
      case 'image':
      case 'file':
      case 'audio':
      case 'video': {
        if (def.required && typeof val === 'string' && val.trim() === '') {
          return `${def.label} 为必填项`;
        }
        break;
      }
    }

    return undefined;
  };
}

/** 为整个 params schema 批量构建校验器 */
export function buildValidators(
  params: Record<string, ParamDef>,
): Record<string, (value: unknown) => string | undefined> {
  const validators: Record<string, (value: unknown) => string | undefined> = {};
  for (const [key, def] of Object.entries(params)) {
    validators[`data.params.${key}`] = buildParamValidator(def, key);
  }
  return validators;
}
