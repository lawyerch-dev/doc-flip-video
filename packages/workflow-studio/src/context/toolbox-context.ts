import { createContext, useContext } from 'react';

interface ToolboxContextValue {
  visible: boolean;
  toggle: () => void;
}

export const ToolboxContext = createContext<ToolboxContextValue>({
  visible: true,
  toggle: () => {},
});

export const useToolbox = () => useContext(ToolboxContext);
