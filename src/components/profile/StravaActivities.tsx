import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { StravaActivity } from "@/types";
import { stravaService } from "@/lib/strava";
import { Activity, Calendar, Clock, MapPin, TrendingUp, Zap } from "lucide-react";

export default function StravaActivities() {
  console.log('StravaActivities component rendering');
  
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [days, setDays] = useState(30);

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatSpeed = (metersPerSecond: number): string => {
    const kmh = (metersPerSecond * 3.6).toFixed(1);
    return `${kmh} km/h`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'run':
      case 'running':
        return '🏃';
      case 'ride':
      case 'cycling':
        return '🚴';
      case 'walk':
      case 'walking':
        return '🚶';
      case 'swim':
      case 'swimming':
        return '🏊';
      case 'hike':
      case 'hiking':
        return '🥾';
      case 'yoga':
        return '🧘';
      case 'weighttraining':
        return '🏋️';
      default:
        return '🏃';
    }
  };

  const handleLoadActivities = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const recentActivities = await stravaService.getRecentActivities(user.id, days);
      setActivities(recentActivities);
      
      toast({
        title: t("activitiesLoaded"),
        description: t("activitiesLoadedDescription").replace("{count}", recentActivities.length.toString()).replace("{days}", days.toString()),
      });
    } catch (error) {
      console.error("Error loading activities:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("activitiesLoadFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
  const totalTime = activities.reduce((sum, activity) => sum + activity.moving_time, 0);
  const totalElevation = activities.reduce((sum, activity) => sum + activity.total_elevation_gain, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t("stravaActivities")}
        </CardTitle>
        <CardDescription>
          {t("stravaActivitiesDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="days" className="text-sm font-medium">
              {t("lastDays")}
            </label>
            <select
              id="days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value={7}>7 {t("days")}</option>
              <option value={14}>14 {t("days")}</option>
              <option value={30}>30 {t("days")}</option>
              <option value={60}>60 {t("days")}</option>
              <option value={90}>90 {t("days")}</option>
            </select>
          </div>
          <Button onClick={handleLoadActivities} disabled={isLoading}>
            {isLoading ? t("loadingActivities") : t("loadActivities")}
          </Button>
        </div>

        {activities.length > 0 && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatDistance(totalDistance)}</div>
                <div className="text-sm text-muted-foreground">{t("totalDistance")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatDuration(totalTime)}</div>
                <div className="text-sm text-muted-foreground">{t("totalTime")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(totalElevation)}m</div>
                <div className="text-sm text-muted-foreground">{t("elevationGain")}</div>
              </div>
            </div>

            {/* Activities List */}
            <div className="space-y-3">
              <h3 className="font-medium">{t("activities")} ({activities.length})</h3>
              {activities.map((activity) => (
                <Card key={activity.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                        <div className="space-y-1">
                          <div className="font-medium">{activity.name}</div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(activity.start_date_local)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(activity.moving_time)}
                            </div>
                            {activity.location_city && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {activity.location_city}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatDistance(activity.distance)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatSpeed(activity.average_speed)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {activity.type}
                      </Badge>
                      {activity.total_elevation_gain > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <TrendingUp className="mr-1 h-3 w-3" />
                          {Math.round(activity.total_elevation_gain)}m
                        </Badge>
                      )}
                      {activity.calories && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="mr-1 h-3 w-3" />
                          {activity.calories} cal
                        </Badge>
                      )}
                      {activity.kudos_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          👍 {activity.kudos_count}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
