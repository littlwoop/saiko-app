import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signup } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password) {
      toast({
        title: t("error"),
        description: t("fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }
    
    if (password !== passwordConfirm) {
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
      await signup(name, email, password);
      toast({
        title: t("accountCreated"),
        description: t("accountCreatedDescription"),
      });
      navigate("/login");
    } catch (error) {
      toast({
        title: t("registrationFailed"),
        description: t("emailInUse"),
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
          <CardTitle className="text-2xl">{t("createAccount")}</CardTitle>
          <CardDescription>{t("enterInformation")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("fullName")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("enterFullName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <Label htmlFor="password-confirm">{t("confirmPassword")}</Label>
              <Input
                id="password-confirm"
                type="password"
                placeholder={t("enterConfirmPassword")}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("creatingAccount") : t("createAccount")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("alreadyHaveAccount")}{" "}
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
