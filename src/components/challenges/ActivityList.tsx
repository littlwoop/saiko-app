import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRound } from "lucide-react";

interface Objective {
  id: string;
  title: string;
  unit: string;
}

interface Entry {
  id: string;
  user_id: string;
  challenge_id: string;
  objective_id: string;
  value: number;
  created_at: string;
  notes?: string;
  username: string;
  objective?: Objective;
}

interface ActivityListProps {
  challengeId: string;
}

export default function ActivityList({ challengeId }: ActivityListProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const locale = language === 'de' ? de : enUS;

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setLoading(true);
        // First fetch the challenge to get its objectives
        const { data: challengeData, error: challengeError } = await supabase
          .from('challenges')
          .select('objectives')
          .eq('id', challengeId)
          .single();

        if (challengeError) {
          console.error('Error fetching challenge:', challengeError);
          return;
        }

        // Then fetch the entries
        const { data: entriesData, error: entriesError } = await supabase
          .from('entries')
          .select('*')
          .eq('challenge_id', challengeId)
          .order('created_at', { ascending: false });

        if (entriesError) {
          console.error('Error fetching entries:', entriesError);
          return;
        }

        // Combine entries with their objective details
        const entriesWithObjectives = entriesData?.map(entry => {
          const objective = challengeData.objectives.find(
            (obj: Objective) => obj.id === entry.objective_id
          );
          return {
            ...entry,
            objective
          };
        }) || [];

        setEntries(entriesWithObjectives);
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [challengeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10">
        <UserRound className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">{t("noActivities")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("noActivitiesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <UserRound className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{entry.username}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(entry.created_at), t("dateFormatLong"), { locale })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>
                {t("addedValue").replace("{value}", `${entry.value} ${entry.objective?.unit || ''}`)}
              </span>
              {entry.objective && (
                <span className="text-xs text-muted-foreground">
                  {t("forObjective")}: {entry.objective.title}
                </span>
              )}
              {entry.notes && (
                <span className="text-xs text-muted-foreground">• {entry.notes}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 