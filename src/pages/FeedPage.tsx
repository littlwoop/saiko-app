import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useAuth } from "@/contexts/AuthContext";
import { activityFeedService, ActivityFeedEntry } from "@/lib/activity-feed";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Target, Users, Trophy, BookOpen, CheckCircle2, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function FeedPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to start page if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return null;
  }
  const [feedEntries, setFeedEntries] = useState<ActivityFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;
  
  const dateLocale = language === "de" ? de : enUS;

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const entries = await activityFeedService.getActivityFeed(limit, offset);
      setFeedEntries(prev => offset === 0 ? entries : [...prev, ...entries]);
      setHasMore(entries.length === limit);
    } catch (error) {
      console.error("Error loading feed:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const loadMore = async () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    try {
      const entries = await activityFeedService.getActivityFeed(limit, newOffset);
      setFeedEntries(prev => [...prev, ...entries]);
      setHasMore(entries.length === limit);
    } catch (error) {
      console.error("Error loading more feed entries:", error);
    }
  };

  const getActivityIcon = (activityType: ActivityFeedEntry['activityType']) => {
    switch (activityType) {
      case 'objective_progress':
        return <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'challenge_join':
        return <Users className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'challenge_complete':
        return <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'quest_join':
        return <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />;
      case 'quest_complete':
        return <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />;
      default:
        return <Target className="h-4 w-4 sm:h-5 sm:w-5" />;
    }
  };

  const getActivityMessage = (entry: ActivityFeedEntry): string => {
    const userName = entry.userName || t("feedUser");
    
    switch (entry.activityType) {
      case 'objective_progress':
        if (entry.challengeTitle) {
          return t("feedObjectiveProgress").replace("{user}", userName).replace("{title}", entry.challengeTitle);
        } else if (entry.questTitle) {
          return t("feedObjectiveProgress").replace("{user}", userName).replace("{title}", entry.questTitle);
        }
        return t("feedObjectiveProgressGeneric").replace("{user}", userName);
      
      case 'challenge_join':
        return entry.challengeTitle 
          ? t("feedChallengeJoin").replace("{user}", userName).replace("{title}", entry.challengeTitle)
          : t("feedChallengeJoinGeneric").replace("{user}", userName);
      
      case 'challenge_complete': {
        const isDaily = entry.metadata?.isDaily === true;
        if (isDaily) {
          return entry.challengeTitle
            ? t("feedDailyChallengeComplete").replace("{user}", userName).replace("{title}", entry.challengeTitle)
            : t("feedDailyChallengeCompleteGeneric").replace("{user}", userName);
        }
        return entry.challengeTitle
          ? t("feedChallengeComplete").replace("{user}", userName).replace("{title}", entry.challengeTitle)
          : t("feedChallengeCompleteGeneric").replace("{user}", userName);
      }
      
      case 'quest_join':
        return entry.questTitle
          ? t("feedQuestJoin").replace("{user}", userName).replace("{title}", entry.questTitle)
          : t("feedQuestJoinGeneric").replace("{user}", userName);
      
      case 'quest_complete':
        return entry.questTitle
          ? t("feedQuestComplete").replace("{user}", userName).replace("{title}", entry.questTitle)
          : t("feedQuestCompleteGeneric").replace("{user}", userName);
      
      default:
        return t("feedActivityGeneric").replace("{user}", userName);
    }
  };

  const getActivityLink = (entry: ActivityFeedEntry): string | null => {
    if (entry.challengeId) {
      return `/challenges/${entry.challengeId}`;
    }
    if (entry.chapterId) {
      return `/quests`;
    }
    return null;
  };

  if (loading && feedEntries.length === 0) {
    return (
      <div className="container py-4 sm:py-8 max-w-4xl">
      <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] space-y-4">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("feedLoading")}</p>
      </div>
      </div>
    );
  }

  return (
    <div className="container py-4 sm:py-8 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-2">{t("feedTitle")}</h1>
      </div>

      {feedEntries.length === 0 ? (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <p className="text-muted-foreground">{t("feedEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-4">
          {feedEntries.map((entry) => {
            const link = getActivityLink(entry);
            const content = (
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      {getActivityIcon(entry.activityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {getActivityMessage(entry)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">
                        {formatDistanceToNow(new Date(entry.createdAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            return link ? (
              <Link key={entry.id} to={link}>
                {content}
              </Link>
            ) : (
              <div key={entry.id}>{content}</div>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-2 sm:pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
                size="sm"
                className="text-xs sm:text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("feedLoadingMore")}
                  </>
                ) : (
                  t("feedLoadMore")
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
