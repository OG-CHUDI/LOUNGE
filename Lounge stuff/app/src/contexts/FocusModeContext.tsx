import { createContext, useContext, useState, type ReactNode } from 'react';

interface FocusModeContextType {
  enabled: boolean;
  toggle: () => void;
}

const FocusModeContext = createContext<FocusModeContextType>({ enabled: false, toggle: () => {} });

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  return (
    <FocusModeContext.Provider value={{ enabled, toggle: () => setEnabled(e => !e) }}>
      {children}
    </FocusModeContext.Provider>
  );
}

export const useFocusMode = () => useContext(FocusModeContext);
