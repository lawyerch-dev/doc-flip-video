/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import {
  inject,
  injectable,
  WorkflowLinesManager,
  FlowNodeEntity,
  FlowNodeFormData,
  WorkflowDocument,
} from '@flowgram.ai/free-layout-editor';

export interface ValidateResult {
  node: FlowNodeEntity;
  feedbacks: Array<{ feedbackText: string }>;
}

@injectable()
export class ValidateService {
  @inject(WorkflowLinesManager)
  protected readonly linesManager: WorkflowLinesManager;

  @inject(WorkflowDocument) private readonly document: WorkflowDocument;

  validateLines() {
    try {
      const allLines = this.linesManager.getAllLines();
      allLines.forEach((line) => line.validate());
    } catch {}
  }

  async validateNode(node: FlowNodeEntity): Promise<Array<{ feedbackText: string }>> {
    try {
      // Try flowgram's form validation first
      const formData = node.getData(FlowNodeFormData);
      if (formData) {
        const formModel = formData.getFormModel() as any;
        if (formModel?.validateWithFeedbacks) {
          const feedbacks = await formModel.validateWithFeedbacks();
          if (feedbacks?.length) return feedbacks;
        }
      }
    } catch {}

    // Fallback: check params against validators from formMeta
    const values = (node.form?.values as any)?.data?.params;
    if (!values) return [];

    const registry = node.getNodeRegistry();
    const formMeta = registry?.formMeta as any;
    const validators = formMeta?.validate as Record<string, (v: unknown) => string | undefined> | undefined;
    if (!validators) return [];

    const errors: Array<{ feedbackText: string }> = [];
    for (const [path, validator] of Object.entries(validators)) {
      const key = path.split('.').pop()!;
      const val = (values as any)[key];
      const error = validator(val);
      if (error) {
        errors.push({ feedbackText: error });
      }
    }
    return errors;
  }

  async validateNodes(): Promise<ValidateResult[]> {
    try {
      const nodes = this.document.getAssociatedNodes();
      const results = await Promise.all(
        nodes.map(async (node) => {
          const feedbacks = await this.validateNode(node);
          return { feedbacks, node };
        })
      );
      return results.filter((i) => i.feedbacks.length);
    } catch {
      return [];
    }
  }
}
