import { useState, useEffect } from "react";
import { Objective, UserProgress } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, CheckCircle, Check } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface ObjectiveItemProps {
  objective: Objective;
  challengeId: string;
  progress?: UserProgress;
  isBingo?: boolean;
  readOnly?: boolean;
}

interface Entry {
  id: string;
  value: number;
  created_at: string;
  notes?: string;
}

export default function ObjectiveItem({
  objective,
  challengeId,
  progress,
  isBingo,
  readOnly
}: ObjectiveItemProps) {
  const [value, setValue] = useState(progress?.currentValue?.toString() || "0");
  const [notes, setNotes] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const { updateProgress } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const currentValue = progress?.currentValue || 0;
  const progressPercent = Math.min(100, (currentValue / objective.targetValue) * 100);
  const isCompleted = currentValue >= objective.targetValue;
  
  const pointsEarned = currentValue * objective.pointsPerUnit;
  const targetPoints = objective.targetValue * objective.pointsPerUnit;

  useEffect(() => {
    const fetchEntries = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching entries:', error);
      } else {
        setEntries(data || []);
      }
    };
    
    fetchEntries();
  }, [user, challengeId, objective.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const newValue = parseInt(value) || 0;
    updateProgress(challengeId, objective.id, newValue);
    setIsOpen(false);
    setValue("0");
  };

  if (isBingo) {
    return (
      <Card className={`relative ${isCompleted ? 'border-challenge-teal bg-green-50/30' : ''}`}>
        <CardHeader className="flex flex-col items-center justify-center p-2 py-4 text-center">
          <CardTitle className="text-sm leading-tight line-clamp-2">
            {objective.title}
          </CardTitle>
        </CardHeader>
        {!isCompleted && !readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-5 w-5"
            onClick={() => {
              if (user) {
                updateProgress(challengeId, objective.id, 1);
              }
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        {isCompleted && (
          <div className="absolute top-1 right-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className={isCompleted ? 'border-challenge-teal bg-green-50/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            {isCompleted && <CheckCircle className="h-4 w-4 text-green-600" />}
            {objective.title}
          </CardTitle>
          <div className="text-sm font-medium">
            {objective.pointsPerUnit} {t('points')}/{objective.unit}
          </div>
        </div>
        <CardDescription className="line-clamp-2 text-xs">
          {objective.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Trophy className="h-4 w-4 text-challenge-purple" />
              <span className="text-sm font-medium">
                {Math.floor(pointsEarned)} / {Math.floor(targetPoints)} {t('points')}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentValue} / {objective.targetValue} {objective.unit}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              {t('addProgress')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t('addProgress')}</DialogTitle>
                <DialogDescription>
                  {t('enterProgressFor')} {objective.title}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="progress-value">
                    {t('progress')}: {currentValue} / {objective.targetValue} {objective.unit}
                  </Label>
                  <Input
                    id="progress-value"
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t('enterUnit').replace('{unit}', objective.unit)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{t('saveProgress')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}