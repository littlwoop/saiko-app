import { Outlet, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { InstallPromptDialog } from "@/components/pwa/InstallPromptDialog";
import { PWAInstallProvider } from "@/contexts/PWAInstallContext";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const isIndexPage = location.pathname === "/";

  const handleRefresh = async () => {
    // You can customize this function to refresh specific data instead of reloading the page
    // For now, it will reload the page as requested
    window.location.reload();
  };

  const content = (
    <>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      {isIndexPage && <Footer />}
    </>
  );

  return (
    <PWAInstallProvider>
      <InstallPromptDialog />
      <div className="flex min-h-screen flex-col">
        {isMobile ? (
          <PullToRefresh onRefresh={handleRefresh}>
            {content}
          </PullToRefresh>
        ) : (
          content
        )}
      </div>
    </PWAInstallProvider>
  );
}
