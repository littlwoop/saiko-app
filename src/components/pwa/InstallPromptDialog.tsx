import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { usePWAInstall } from "@/contexts/PWAInstallContext";

export function InstallPromptDialog() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canInstall, shouldShowPrompt, promptInstall, dismissPrompt } =
    usePWAInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <Dialog
      open={shouldShowPrompt}
      onOpenChange={(open) => {
        if (!open) {
          dismissPrompt();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("installAppTitle")}</DialogTitle>
          <DialogDescription>{t("installAppDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={dismissPrompt}>
            {t("installAppDismiss")}
          </Button>
          <Button onClick={promptInstall}>{t("installAppConfirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

