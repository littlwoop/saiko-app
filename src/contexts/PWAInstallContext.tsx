import {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
} from "react";
import { usePWAInstallPrompt } from "@/hooks/use-pwa-install";

type PWAInstallContextValue = ReturnType<typeof usePWAInstallPrompt>;

const PWAInstallContext = createContext<PWAInstallContextValue | null>(null);

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const value = usePWAInstallPrompt();

  const memoizedValue = useMemo(() => value, [value]);

  return (
    <PWAInstallContext.Provider value={memoizedValue}>
      {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);

  if (!context) {
    throw new Error("usePWAInstall must be used within a PWAInstallProvider");
  }

  return context;
}

