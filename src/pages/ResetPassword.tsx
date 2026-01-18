import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [searchParams] = useSearchParams();

  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback from Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          toast({
            title: t("error"),
            description: "Invalid or expired reset token",
            variant: "destructive",
          });
          navigate("/forgot-password");
          return;
        }

        // Check if we have a valid session (user is authenticated)
        if (data.session) {
          setIsTokenValid(true);
        } else {
          // Check URL parameters for token-based reset
          const accessToken = searchParams.get("access_token");
          const refreshToken = searchParams.get("refresh_token");
          
          if (accessToken && refreshToken) {
            // Set the session with the tokens from URL
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (setSessionError) {
              console.error("Set session error:", setSessionError);
              toast({
                title: t("error"),
                description: "Invalid or expired reset token",
                variant: "destructive",
              });
              navigate("/forgot-password");
              return;
            }
            
            setIsTokenValid(true);
          } else {
            toast({
              title: t("error"),
              description: "Invalid or missing reset token",
              variant: "destructive",
            });
            navigate("/forgot-password");
          }
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        toast({
          title: t("error"),
          description: "Invalid or expired reset token",
          variant: "destructive",
        });
        navigate("/forgot-password");
      }
    };

    handleAuthCallback();
  }, [searchParams, toast, t, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: t("error"),
        description: t("enterPasswordAndConfirm"),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t("error"),
        description: t("passwordsDoNotMatch"),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t("error"),
        description: t("passwordTooShort"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("passwordResetSuccess"),
      });
      navigate("/login");
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: t("error"),
        description: t("passwordResetFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isTokenValid) {
    return (
      <div className="container max-w-md py-12">
        <div className="mb-8 flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.png" alt="Saiko" className="h-6 w-6 bg-transparent" style={{ mixBlendMode: 'normal' }} />
            <span className="text-2xl font-bold gradient-text">Saiko</span>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">Verifying reset token...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <CardTitle className="text-2xl">{t("resetPassword")}</CardTitle>
          <CardDescription>{t("resetPasswordDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("enterPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("enterConfirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("resetting") : t("resetPassword")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("rememberPassword")}{" "}
              <Link to="/login" className="text-primary hover:underline">
                {t("login")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
