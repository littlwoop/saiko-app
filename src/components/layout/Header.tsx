import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Link, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trophy, UserRound, Activity, Globe, Menu } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/ui/drawer";

export default function Header() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation(language);
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const NavLinks = () => (
    <>
      {user && (
        <Link
          to="/dashboard"
          className={`text-sm font-medium transition-colors hover:text-primary select-none ${
            location.pathname === "/dashboard"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          Dashboard
        </Link>
      )}
      <Link
        to="/challenges"
        className={`text-sm font-medium transition-colors hover:text-primary select-none ${
          location.pathname.includes("/challenges")
            ? "text-primary"
            : "text-muted-foreground"
        }`}
      >
        {t("challenges")}
      </Link>
      <Link
        to="/leaderboard"
        className={`text-sm font-medium transition-colors hover:text-primary select-none ${
          location.pathname === "/leaderboard"
            ? "text-primary"
            : "text-muted-foreground"
        }`}
      >
        {t("leaderboard")}
      </Link>
    </>
  );

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-200 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-sm shadow-sm"
          : "bg-background"
      }`}
    >
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.png" alt="Saiko" className="h-6 w-6" />
            <span className="text-xl font-bold gradient-text">Saiko</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage("en")}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("de")}>
                Deutsch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Button */}
          <Drawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <div className="flex flex-col gap-4">
                  <NavLinks />
                  {user ? (
                    <>
                      <Link
                        to="/dashboard"
                        className="text-sm font-medium transition-colors hover:text-primary select-none"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/profile"
                        className="text-sm font-medium transition-colors hover:text-primary select-none"
                      >
                        {t("profile")}
                      </Link>
                      <Link
                        to="/my-challenges"
                        className="text-sm font-medium transition-colors hover:text-primary select-none"
                      >
                        {t("myChallenges")}
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setIsMobileMenuOpen(false);
                        }}
                        className="text-sm font-medium text-red-500 transition-colors hover:text-red-600 select-none"
                      >
                        {t("logout")}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        className="text-sm font-medium transition-colors hover:text-primary select-none"
                      >
                        {t("login")}
                      </Link>
                      <Link
                        to="/signup"
                        className="text-sm font-medium transition-colors hover:text-primary select-none"
                      >
                        {t("signup")}
                      </Link>
                    </>
                  )}
                </div>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  {user.avatarUrl ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback>
                        <UserRound className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="hidden sm:inline-block text-sm font-medium">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile">{t("profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/my-challenges">{t("myChallenges")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link to="/login">{t("login")}</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">{t("signup")}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
