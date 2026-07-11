/**
 * Coze-style add-node panel
 * Fixed position relative to viewport — always visible regardless of canvas scroll
 */
import { useRef, useEffect, useState } from 'react';

import { NodePanelRenderProps as NodePanelRenderPropsDefault } from '@flowgram.ai/free-node-panel-plugin';
import { WorkflowPortEntity, useClientContext } from '@flowgram.ai/free-layout-editor';

import { NodePlaceholder } from './node-placeholder';
import { NodeList } from './node-list';

interface NodePanelRenderProps extends NodePanelRenderPropsDefault {
  panelProps?: {
    fromPort?: WorkflowPortEntity;
    enableNodePlaceholder?: boolean;
  };
}

export const NodePanel: React.FC<NodePanelRenderProps> = (props) => {
  const { onSelect, position, onClose, containerNode, panelProps = {} } = props;
  const { enableNodePlaceholder } = panelProps;
  const ref = useRef<HTMLDivElement>(null);
  const { playground } = useClientContext();

  // Convert canvas position to viewport-fixed position
  const [screenPos, setScreenPos] = useState({ left: 300, top: 100 });

  useEffect(() => {
    if (position) {
      // Try to convert canvas coords → screen coords via the playground container
      const container = playground?.node;
      if (container) {
        const rect = container.getBoundingClientRect();
        // position is relative to the canvas; add container offset for fixed positioning
        setScreenPos({
          left: rect.left + position.x + 16,
          top: rect.top + position.y - 10,
        });
      } else {
        setScreenPos({ left: position.x + 16, top: position.y - 10 });
      }
    }
  }, [position, playground]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Clamp to viewport
  const clampedLeft = Math.max(10, Math.min(screenPos.left, window.innerWidth - 360));
  const clampedTop = Math.max(10, Math.min(screenPos.top, window.innerHeight - 400));

  if (enableNodePlaceholder) {
    return (
      <div
        style={{
          position: 'absolute',
          top: position.y - 61.5,
          left: position.x,
          width: 360,
          height: 100,
        }}
      >
        <NodePlaceholder />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: clampedLeft,
        top: clampedTop,
        zIndex: 10000,
      }}
    >
      <NodeList onSelect={onSelect} containerNode={containerNode} />
    </div>
  );
};
