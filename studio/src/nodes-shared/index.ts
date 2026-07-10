/**
 * nodes-shared — 统一节点基础设施
 *
 * 所有节点类型（视频 + 通用）共用的类型、注册表、渲染、校验
 */

export type {
  ParamType,
  ParamDef,
  OutputDef,
  PortDef,
  CategoryInfo,
  NodeManifest,
} from './types';

export {
  NODE_CATEGORIES,
  inferCategoryKey,
  registerManifest,
  registerManifests,
  getManifest,
  getAllManifests,
  getNodeName,
  getNodeColor,
  getNodeIcon,
  getNodeCategory,
} from './types';

export { buildParamValidator, buildValidators } from './validators';

export {
  NodeHeader,
  renderCanvasFace,
  renderOutputsSummary,
  renderSidebarForm,
  buildFormMeta,
} from './render';

export { buildRegistry } from './registry';
