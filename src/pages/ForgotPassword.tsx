import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: t("error"),
        description: t("enterEmail"),
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: t("success"),
        description: t("resetPasswordEmailSent"),
      });
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: t("error"),
        description: t("resetPasswordFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="container max-w-md py-12">
      <div className="mb-8 flex justify-center">
        <Link to="/" className="flex items-center gap-2">
          <Trophy className="h-8 w-8 text-challenge-purple" />
          <span className="text-2xl font-bold gradient-text">Challenge Champion</span>
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("forgotPassword")}</CardTitle>
          <CardDescription>{t("forgotPasswordDescription")}</CardDescription>
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
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("sending") : t("sendResetLink")}
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