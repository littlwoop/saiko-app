import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

interface ChallengeDetailProps {
  challenge: {
    id: string;
    title: string;
    description: string;
    target: string;
    deadline: string;
    participants: number;
    progress: number;
  };
  onJoin: () => void;
  isJoined: boolean;
  isSubmitting: boolean;
}

export function ChallengeDetail({
  challenge,
  onJoin,
  isJoined,
  isSubmitting,
}: ChallengeDetailProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <Card className="select-none">
      <CardHeader>
        <CardTitle>{challenge.title}</CardTitle>
        <CardDescription>{challenge.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t("target")}</span>
            <span className="text-sm font-medium">{challenge.target}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              {t("deadline")}
            </span>
            <span className="text-sm font-medium">{challenge.deadline}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              {t("participants")}
            </span>
            <span className="text-sm font-medium">
              {challenge.participants}
            </span>
          </div>
        </div>

        {isJoined && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                {t("progress")}
              </span>
              <span className="text-sm font-medium">{challenge.progress}%</span>
            </div>
            <Progress value={challenge.progress} />
          </div>
        )}

        {!isJoined && (
          <Button onClick={onJoin} disabled={isSubmitting} className="w-full">
            {isSubmitting ? t("joining") : t("joinChallenge")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
