import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { PersonalBest, PersonalBestType } from "@/types";
import { Trophy, Edit2, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ACHIEVEMENT_TYPES: {
  type: PersonalBestType;
  translationKey: string;
  isTimeBased: boolean;
}[] = [
  { type: "5k", translationKey: "achievement5k", isTimeBased: true },
  { type: "10k", translationKey: "achievement10k", isTimeBased: true },
  { type: "half_marathon", translationKey: "achievementHalfMarathon", isTimeBased: true },
  { type: "marathon", translationKey: "achievementMarathon", isTimeBased: true },
  { type: "longest_run", translationKey: "achievementLongestRun", isTimeBased: false },
  { type: "longest_bike_ride", translationKey: "achievementLongestBikeRide", isTimeBased: false },
];

export default function PersonalBest() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBest, setEditingBest] = useState<PersonalBest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    achievementType: PersonalBestType;
    timeHours: string;
    timeMinutes: string;
    timeSeconds: string;
    distance: string;
    achievementDate: string;
    notes: string;
  }>({
    achievementType: "5k",
    timeHours: "",
    timeMinutes: "",
    timeSeconds: "",
    distance: "",
    achievementDate: "",
    notes: "",
  });

  const loadPersonalBests = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("personal_bests")
        .select("*")
        .eq("user_id", user.id)
        .order("achievement_type");

      if (error) throw error;

      // Map database format to our interface
      const mappedData: PersonalBest[] = (data || []).map((pb: any) => ({
        id: pb.id,
        userId: pb.user_id,
        achievementType: pb.achievement_type,
        timeSeconds: pb.time_seconds,
        distanceMeters: pb.distance_meters,
        achievementDate: pb.achievement_date,
        notes: pb.notes,
        createdAt: pb.created_at,
        updatedAt: pb.updated_at,
      }));

      setPersonalBests(mappedData);
    } catch (error) {
      console.error("Error loading personal bests:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadPersonalBests"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPersonalBests();
    }
  }, [user]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const parseTimeInput = (
    hours: string,
    minutes: string,
    seconds: string
  ): number => {
    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes || "0", 10);
    const s = parseInt(seconds || "0", 10);
    return h * 3600 + m * 60 + s;
  };

  const timeToInputs = (seconds?: number): {
    hours: string;
    minutes: string;
    seconds: string;
  } => {
    if (!seconds) return { hours: "", minutes: "", seconds: "" };
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return {
      hours: hours > 0 ? hours.toString() : "",
      minutes: minutes > 0 ? minutes.toString() : "",
      seconds: secs > 0 ? secs.toString() : "",
    };
  };

  const openEditDialog = (best?: PersonalBest, achievementType?: PersonalBestType) => {
    if (best) {
      setEditingBest(best);
      const timeInputs = timeToInputs(best.timeSeconds);
      setFormData({
        achievementType: best.achievementType,
        timeHours: timeInputs.hours,
        timeMinutes: timeInputs.minutes,
        timeSeconds: timeInputs.seconds,
        distance: best.distanceMeters
          ? (best.distanceMeters / 1000).toFixed(2)
          : "",
        achievementDate: best.achievementDate || "",
        notes: best.notes || "",
      });
    } else {
      setEditingBest(null);
      setFormData({
        achievementType: achievementType || "5k",
        timeHours: "",
        timeMinutes: "",
        timeSeconds: "",
        distance: "",
        achievementDate: "",
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const achievementType = formData.achievementType;
    const achievementInfo = ACHIEVEMENT_TYPES.find(
      (a) => a.type === achievementType
    );

    if (!achievementInfo) return;

    try {
      const timeSeconds = achievementInfo.isTimeBased
        ? parseTimeInput(
            formData.timeHours,
            formData.timeMinutes,
            formData.timeSeconds
          )
        : undefined;

      const distanceMeters = !achievementInfo.isTimeBased
        ? parseFloat(formData.distance) * 1000
        : undefined;

      if (achievementInfo.isTimeBased && (!timeSeconds || timeSeconds <= 0)) {
        toast({
          title: t("error"),
          description: t("pleaseEnterValidTime"),
          variant: "destructive",
        });
        return;
      }

      if (
        !achievementInfo.isTimeBased &&
        (!distanceMeters || distanceMeters <= 0)
      ) {
        toast({
          title: t("error"),
          description: t("pleaseEnterValidDistance"),
          variant: "destructive",
        });
        return;
      }

      const dataToSave = {
        user_id: user.id,
        achievement_type: achievementType,
        time_seconds: timeSeconds || null,
        distance_meters: distanceMeters || null,
        achievement_date: formData.achievementDate || null,
        notes: formData.notes || null,
      };

      if (editingBest) {
        const { error } = await supabase
          .from("personal_bests")
          .update(dataToSave)
          .eq("id", editingBest.id);

        if (error) throw error;

        toast({
          title: t("success"),
          description: t("personalBestUpdated"),
        });
      } else {
        const { error } = await supabase.from("personal_bests").insert(dataToSave);

        if (error) throw error;

        toast({
          title: t("success"),
          description: t("personalBestAdded"),
        });
      }

      setDialogOpen(false);
      loadPersonalBests();
    } catch (error) {
      console.error("Error saving personal best:", error);
      toast({
        title: t("error"),
        description: t("failedToSavePersonalBest"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const { error } = await supabase
        .from("personal_bests")
        .delete()
        .eq("id", deletingId);

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("personalBestDeleted"),
      });

      setDeleteDialogOpen(false);
      setDeletingId(null);
      loadPersonalBests();
    } catch (error) {
      console.error("Error deleting personal best:", error);
      toast({
        title: t("error"),
        description: t("failedToDeletePersonalBest"),
        variant: "destructive",
      });
    }
  };

  const getPersonalBest = (type: PersonalBestType): PersonalBest | undefined => {
    return personalBests.find((pb) => pb.achievementType === type);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {ACHIEVEMENT_TYPES.map((achievement) => {
          const best = getPersonalBest(achievement.type);
          return (
            <Card
              key={achievement.type}
              className={`${
                best ? "border-l-4 border-l-yellow-500" : ""
              } transition-shadow hover:shadow-md`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <Trophy className={`h-4 w-4 shrink-0 ${best ? "text-yellow-500" : "text-muted-foreground"}`} />
                      <span className="font-medium text-sm sm:text-base truncate">
                        {t(achievement.translationKey)}
                      </span>
                    </div>
                    {best ? (
                      <>
                        <div className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 break-words">
                          {achievement.isTimeBased
                            ? formatTime(best.timeSeconds || 0)
                            : formatDistance(best.distanceMeters || 0)}
                        </div>
                        {best.achievementDate && (
                          <div className="text-xs sm:text-sm text-muted-foreground mb-1">
                            {new Date(
                              best.achievementDate
                            ).toLocaleDateString(
                              language === "de" ? "de-DE" : "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </div>
                        )}
                        {best.notes && (
                          <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 break-words">
                            {best.notes}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {t("notSet")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {best ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(best)}
                          className="h-9 w-9 p-0 touch-manipulation"
                          aria-label={t("edit")}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(best.id)}
                          className="h-9 w-9 p-0 touch-manipulation text-destructive hover:text-destructive"
                          aria-label={t("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(undefined, achievement.type)}
                        className="h-9 w-9 p-0 touch-manipulation"
                        aria-label={t("addPersonalBest")}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editingBest
                ? t("editPersonalBest")
                : `${t("addPersonalBest")} - ${t(
                    ACHIEVEMENT_TYPES.find(
                      (a) => a.type === formData.achievementType
                    )?.translationKey || "achievement5k"
                  )}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {ACHIEVEMENT_TYPES.find(
              (a) => a.type === formData.achievementType
            )?.isTimeBased ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("time")}</Label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="hours" className="text-xs text-muted-foreground">
                      {t("hours")}
                    </Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.timeHours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          timeHours: e.target.value,
                        })
                      }
                      className="h-10 text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="minutes" className="text-xs text-muted-foreground">
                      {t("minutes")}
                    </Label>
                    <Input
                      id="minutes"
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={formData.timeMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          timeMinutes: e.target.value,
                        })
                      }
                      className="h-10 text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seconds" className="text-xs text-muted-foreground">
                      {t("seconds")}
                    </Label>
                    <Input
                      id="seconds"
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={formData.timeSeconds}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          timeSeconds: e.target.value,
                        })
                      }
                      className="h-10 text-base sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("distance")} (km)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.distance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      distance: e.target.value,
                    })
                  }
                  className="h-10 text-base sm:text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">
                {t("dateOptional")}
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.achievementDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    achievementDate: e.target.value,
                  })
                }
                className="h-10 text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                {t("notesOptional")}
              </Label>
              <Textarea
                id="notes"
                placeholder={t("addNotesAboutAchievement")}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notes: e.target.value,
                  })
                }
                className="min-h-[80px] text-base sm:text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="w-full sm:w-auto h-10"
              >
                {t("cancel")}
              </Button>
              <Button 
                onClick={handleSave}
                className="w-full sm:w-auto h-10"
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-sm sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {t("delete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t("confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto m-0 h-10">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full sm:w-auto h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
