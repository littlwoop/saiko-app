import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRound, Edit, Trash2 } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface Objective {
  id: string;
  title: string;
  unit: string;
}

interface Activity {
  id: string;
  user_id: string;
  username: string;
  objective_id: string;
  value: number;
  notes?: string;
  created_at: string;
}

interface ActivityListProps {
  challengeId: number;
  onUserClick?: (userId: string) => void;
}

export default function ActivityList({
  challengeId,
  onUserClick,
}: ActivityListProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { getChallenge } = useChallenges();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective>>({});
  const [loading, setLoading] = useState(true);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [challengeType, setChallengeType] = useState<string | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  
  // Long press state
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuActivity, setContextMenuActivity] = useState<Activity | null>(null);

  // Detect touch device
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    
    checkTouchDevice();
    window.addEventListener('resize', checkTouchDevice);
    
    return () => {
      window.removeEventListener('resize', checkTouchDevice);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch challenge to get objectives
        const challenge = await getChallenge(challengeId);
        if (challenge) {
          const objectivesMap = challenge.objectives.reduce(
            (acc, objective) => ({
              ...acc,
              [objective.id]: objective,
            }),
            {},
          );
          setObjectives(objectivesMap);
          setChallengeType(challenge.challenge_type);
        }

        // Fetch activities
        const { data: activitiesData, error: activitiesError } = await supabase
          .from("entries")
          .select("*")
          .eq("challenge_id", challengeId)
          .order("created_at", { ascending: false });

        if (activitiesError) {
          console.error("Error fetching activities:", activitiesError);
        } else {
          setActivities(activitiesData || []);

          // Fetch user profiles for all unique users
          const uniqueUserIds = [
            ...new Set(
              activitiesData?.map((activity) => activity.user_id) || [],
            ),
          ];
          const { data: profiles, error: profilesError } = await supabase
            .from("user_profiles")
            .select("id, avatar_url")
            .in("id", uniqueUserIds);

          if (profilesError) {
            console.error("Error fetching user profiles:", profilesError);
          } else {
            const avatarMap = (profiles || []).reduce(
              (acc, profile) => ({
                ...acc,
                [profile.id]: profile.avatar_url,
              }),
              {},
            );
            setUserAvatars(avatarMap);
          }
        }
      } catch (error) {
        console.error("Unexpected error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [challengeId, getChallenge]);

  const locale = language === "de" ? de : enUS;

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setEditValue(activity.value.toString());
    setEditNotes(activity.notes || "");
    setEditDialogOpen(true);
    setContextMenuOpen(false);
  };

  const handleDeleteActivity = (activity: Activity) => {
    setDeletingActivity(activity);
    setDeleteDialogOpen(true);
    setContextMenuOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !user) return;

    const numericValue = parseFloat(editValue);
    if (isNaN(numericValue) || numericValue < 0) {
      toast({
        title: t("error"),
        description: t("pleaseEnterValidValue"),
        variant: "destructive",
      });
      return;
    }

    try {
      // Update the activity in the database
      const { error } = await supabase
        .from("entries")
        .update({
          value: numericValue,
          notes: editNotes.trim() || null,
        })
        .eq("id", editingActivity.id)
        .eq("user_id", user.id); // Ensure user can only edit their own activities

      if (error) {
        console.error("Error updating activity:", error);
        toast({
          title: t("error"),
          description: t("failedToUpdateActivity"),
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setActivities(prev => 
        prev.map(activity => 
          activity.id === editingActivity.id 
            ? { ...activity, value: numericValue, notes: editNotes.trim() || null }
            : activity
        )
      );

      toast({
        title: t("activityUpdated"),
        description: t("activityUpdatedDescription"),
      });

      setEditDialogOpen(false);
      setEditingActivity(null);
      setEditValue("");
      setEditNotes("");
    } catch (error) {
      console.error("Error updating activity:", error);
      toast({
        title: t("error"),
        description: t("failedToUpdateActivity"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingActivity || !user) return;

    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", deletingActivity.id)
        .eq("user_id", user.id); // Ensure user can only delete their own activities

      if (error) {
        console.error("Error deleting activity:", error);
        toast({
          title: t("error"),
          description: t("failedToDeleteActivity"),
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setActivities(prev => prev.filter(activity => activity.id !== deletingActivity.id));

      toast({
        title: t("activityDeleted"),
        description: t("activityDeletedDescription"),
      });

      setDeleteDialogOpen(false);
      setDeletingActivity(null);
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast({
        title: t("error"),
        description: t("failedToDeleteActivity"),
        variant: "destructive",
      });
    }
  };

  // Long press handlers for mobile
  const handleLongPress = (activity: Activity, event: React.TouchEvent) => {
    if (isTouchDevice && user && activity.user_id === user.id) {
      longPressTimer.current = setTimeout(() => {
        const touch = event.touches[0];
        setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
        setContextMenuActivity(activity);
        setContextMenuOpen(true);
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  };

  const handleTouchCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  };

  const handleRightClick = (activity: Activity, event: React.MouseEvent) => {
    if (user && activity.user_id === user.id) {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuActivity(activity);
      setContextMenuOpen(true);
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenuOpen(false);
      }
    };

    if (contextMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenuOpen]);

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">{t("noActivities")}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t("noActivitiesDescription")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableBody>
            {activities.map((activity) => {
              const objective = objectives[activity.objective_id];
              const isOwnActivity = user && activity.user_id === user.id;

              return (
                <TableRow 
                  key={activity.id}
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onTouchStart={(e) => handleLongPress(activity, e)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
                  onContextMenu={(e) => handleRightClick(activity, e)}
                  onClick={(e) => {
                    // Only trigger user click if it's not a right-click
                    if (e.button === 0) {
                      onUserClick?.(activity.user_id);
                    }
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {userAvatars[activity.user_id] && (
                          <AvatarImage
                            src={userAvatars[activity.user_id]}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        )}
                        <AvatarFallback>
                          <UserRound className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{activity.username}</span>
                        {activity.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {format(
                      new Date(activity.created_at),
                      t("dateFormatLong") + " HH:mm",
                      { locale },
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Custom Context Menu */}
      {contextMenuOpen && contextMenuActivity && (
        <div
          className="fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            transform: 'translate(0, -100%)',
          }}
        >
          <button
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleEditActivity(contextMenuActivity)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {t("edit")}
          </button>
          <button
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground text-destructive focus:text-destructive"
            onClick={() => handleDeleteActivity(contextMenuActivity)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("delete")}
          </button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>{t("editActivity")}</DialogTitle>
              <DialogDescription>
                {editingActivity && objectives[editingActivity.objective_id] && (
                  <>
                    {t("editActivityFor")} "{objectives[editingActivity.objective_id].title}"
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-value">
                  {editingActivity && objectives[editingActivity.objective_id] && (
                    <>
                      {t("value")} ({objectives[editingActivity.objective_id].unit})
                    </>
                  )}
                </Label>
                <Input
                  id="edit-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={editingActivity && objectives[editingActivity.objective_id] 
                    ? t("enterUnit").replace("{unit}", objectives[editingActivity.objective_id].unit)
                    : ""
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">{t("notes")}</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={t("addNotesAboutProgress")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteActivity")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteActivityConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
