import EditChallengeForm from "@/components/challenges/EditChallengeForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useParams, useNavigate } from "react-router-dom";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function EditChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { getChallenge } = useChallenges();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!id || !user) {
        navigate("/challenges");
        return;
      }

      try {
        const challenge = await getChallenge(parseInt(id));
        if (!challenge) {
          navigate("/challenges");
          return;
        }

        if (challenge.createdById !== user.id) {
          navigate(`/challenges/${id}`);
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Error checking authorization:", error);
        navigate("/challenges");
      } finally {
        setLoading(false);
      }
    };

    checkAuthorization();
  }, [id, user, getChallenge, navigate]);

  if (loading) {
    return (
      <div className="container py-8">
        <div className="mx-auto max-w-4xl">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-64 rounded bg-muted"></div>
            <div className="h-96 w-full rounded bg-muted"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/challenges/${id}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{t("editChallenge") || "Edit Challenge"}</h1>
        </div>
        <EditChallengeForm />
      </div>
    </div>
  );
}

