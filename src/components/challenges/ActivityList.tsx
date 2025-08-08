import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRound } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  challengeId: string;
  onUserClick?: (userId: string) => void;
}

export default function ActivityList({
  challengeId,
  onUserClick,
}: ActivityListProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { getChallenge } = useChallenges();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective>>({});
  const [loading, setLoading] = useState(true);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});

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
    <div className="rounded-md border">
      <Table>
        <TableBody>
          {activities.map((activity) => {
            const objective = objectives[activity.objective_id];

            return (
              <TableRow key={activity.id}>
                <TableCell>
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                    onClick={() => onUserClick?.(activity.user_id)}
                  >
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
                    <span className="font-medium">{activity.username}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm">
                      {t("addedValue").replace(
                        "{value}",
                        `${activity.value} ${objective?.unit}`,
                      )}{" "}
                      {t("forObjective")} "{objective?.title}"
                    </p>
                    {activity.notes && (
                      <p className="text-sm text-muted-foreground">
                        {activity.notes}
                      </p>
                    )}
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
  );
}
