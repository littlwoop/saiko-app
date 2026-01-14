import { useState, useEffect } from "react";
import { QuestObjective } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Footprints, Plus } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface QuestObjectiveItemProps {
  objective: QuestObjective;
  questId: string;
  questStepId: string;
  currentValue: number;
  onProgressUpdate: () => void;
  disabled?: boolean;
}

export default function QuestObjectiveItem({
  objective,
  questId,
  questStepId,
  currentValue,
  onProgressUpdate,
  disabled = false,
}: QuestObjectiveItemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const targetValue = objective.targetValue || 1;
  const progressPercent = Math.min(100, (currentValue / targetValue) * 100);
  const isCompleted = currentValue >= targetValue;
  const unit = objective.unit || "";

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setValue("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen gültigen Wert ein.",
        variant: "destructive",
      });
      return;
    }

    // Add the entered value to the current value
    const newValue = currentValue + numericValue;
    // Clamp the final value to not exceed the target
    const clampedValue = Math.min(newValue, targetValue);

    try {
      setSaving(true);
      const { questService } = await import("@/lib/quests");
      await questService.updateObjectiveProgress(
        user.id,
        questId,
        questStepId,
        objective.id,
        clampedValue,
        undefined,
        user.name
      );
      
      setIsOpen(false);
      setValue("");
      onProgressUpdate();
    } catch (error) {
      console.error("Error updating quest progress:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Fortschritts.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">
              {objective.title}
            </CardTitle>
            {objective.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {objective.description}
              </p>
            )}
          </div>
          {!disabled && (
            <>
              {isCompleted ? (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="h-8 w-8 p-0 flex-shrink-0"
                      title="Fortschritt hinzufügen"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Fortschritt hinzufügen</DialogTitle>
                  <DialogDescription>
                    Aktueller Fortschritt: {currentValue.toLocaleString()} / {targetValue.toLocaleString()} {unit}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="progress-value">
                      Wie viel möchtest du hinzufügen?
                    </Label>
                    <Input
                      id="progress-value"
                      type="number"
                      min="0"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={`Wert in ${unit} eingeben`}
                      disabled={saving}
                    />
                    {value && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && (
                      <p className="text-sm text-muted-foreground">
                        Neuer Fortschritt: {Math.min(currentValue + parseFloat(value), targetValue).toLocaleString()} / {targetValue.toLocaleString()} {unit}
                        {currentValue + parseFloat(value) > targetValue && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">(wird auf Maximum begrenzt)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Speichern...
                      </>
                    ) : (
                      "Fortschritt speichern"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Footprints className="h-4 w-4" />
              Fortschritt
            </span>
            <span className="font-medium">
              {currentValue.toLocaleString()} / {targetValue.toLocaleString()} {unit}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
