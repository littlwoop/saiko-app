import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

interface Challenge {
  id: string;
  title: string;
  description: string;
  target: string;
  deadline: string;
  participants: number;
}

interface ChallengeListProps {
  challenges: Challenge[];
}

export function ChallengeList({ challenges }: ChallengeListProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {challenges.map((challenge) => (
        <Card key={challenge.id}>
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
            <CardDescription>{challenge.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('target')}</span>
                <span className="text-sm font-medium">{challenge.target}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('deadline')}</span>
                <span className="text-sm font-medium">{challenge.deadline}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('participants')}</span>
                <span className="text-sm font-medium">{challenge.participants}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to={`/challenges/${challenge.id}`}>{t('viewChallenge')}</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
} 