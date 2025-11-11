import { useCallback, useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "pwa-install-dismissed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-expect-error - iOS Safari specific property
  window.navigator.standalone === true;

export function usePWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(isStandalone());
  const [shouldShowPrompt, setShouldShowPrompt] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);

      const hasDismissed = localStorage.getItem(DISMISS_KEY) === "true";

      if (!hasDismissed && !isStandalone()) {
        setShouldShowPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShouldShowPrompt(false);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const listener = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
        setShouldShowPrompt(false);
      }
    };

    if (mediaQuery.matches) {
      setIsInstalled(true);
    }

    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        setShouldShowPrompt(false);
      } else {
        localStorage.setItem(DISMISS_KEY, "true");
        setShouldShowPrompt(false);
      }
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "true");
    setShouldShowPrompt(false);
  }, []);

  const state = useMemo(
    () => ({
      canInstall: !!deferredPrompt && !isInstalled,
      shouldShowPrompt,
      promptInstall,
      dismissPrompt,
    }),
    [deferredPrompt, dismissPrompt, isInstalled, promptInstall, shouldShowPrompt],
  );

  return state;
}

