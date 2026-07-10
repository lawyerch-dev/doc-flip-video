import type { FlowDocumentJSON } from './typings';

/** Start with empty document; default workflow loads on demand */
export const initialData: FlowDocumentJSON = {
  nodes: [],
  edges: [],
};
