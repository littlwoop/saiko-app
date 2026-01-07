import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, user, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: t("error"),
        description: t("enterEmailAndPassword"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);
      toast({
        title: t("loginSuccess"),
        description: t("loginSuccessDescription"),
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: t("loginFailed"),
        description: t("invalidCredentials"),
        variant: "destructive",
      });
      console.error("Login error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-md py-12">
      <div className="mb-8 flex justify-center">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.png" alt="Saiko" className="h-6 w-6" />
          <span className="text-2xl font-bold gradient-text">Saiko</span>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("loginDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("enterEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("password")}</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t("enterPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("loggingIn") : t("login")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link to="/signup" className="text-primary hover:underline">
                {t("signup")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        <p>{t("demoNote")}</p>
      </div>
    </div>
  );
}
