
import { useState } from "react";
import { Objective, UserProgress } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, CheckCircle } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
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

interface ObjectiveItemProps {
  objective: Objective;
  challengeId: string;
  progress?: UserProgress;
}

export default function ObjectiveItem({
  objective,
  challengeId,
  progress
}: ObjectiveItemProps) {
  const [value, setValue] = useState(progress?.currentValue?.toString() || "0");
  const [isOpen, setIsOpen] = useState(false);
  const { updateProgress } = useChallenges();

  const currentValue = progress?.currentValue || 0;
  const progressPercent = Math.min(100, (currentValue / objective.targetValue) * 100);
  const isCompleted = currentValue >= objective.targetValue;
  
  const pointsEarned = Math.min(currentValue, objective.targetValue) * objective.pointsPerUnit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newValue = parseInt(value) || 0;
    updateProgress(challengeId, objective.id, newValue);
    setIsOpen(false);
  };

  return (
    <Card className={`${isCompleted ? 'border-challenge-teal bg-green-50/30' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            {isCompleted && <CheckCircle className="h-4 w-4 text-green-600" />}
            {objective.title}
          </CardTitle>
          <div className="text-sm font-medium">
            {objective.pointsPerUnit} pts/{objective.unit}
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
                {Math.floor(pointsEarned)} / {objective.targetValue * objective.pointsPerUnit} pts
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
              Update Progress
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Update Progress</DialogTitle>
                <DialogDescription>
                  Enter your current progress for {objective.title}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="progress-value">
                    Current {objective.unit} ({currentValue} / {objective.targetValue})
                  </Label>
                  <Input
                    id="progress-value"
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={`Enter ${objective.unit}`}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Progress</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
