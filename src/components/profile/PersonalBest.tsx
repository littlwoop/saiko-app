import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { StravaActivity } from "@/types";
import { stravaService } from "@/lib/strava";
import { Trophy, TrendingUp, Zap, Clock, Calendar } from "lucide-react";

interface PersonalBest {
  type: string;
  metric: string;
  value: number;
  activity: StravaActivity;
}

export default function PersonalBest() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [days, setDays] = useState(365);

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const formatDuration = (seconds: number): string => {
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

  const formatSpeed = (metersPerSecond: number): string => {
    const kmh = (metersPerSecond * 3.6).toFixed(1);
    return `${kmh} km/h`;
  };

  const formatPace = (metersPerSecond: number): string => {
    if (metersPerSecond === 0) return "N/A";
    const secondsPerKm = 1000 / metersPerSecond;
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(
      language === "de" ? "de-DE" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  const calculatePersonalBests = (activities: StravaActivity[]): PersonalBest[] => {
    if (activities.length === 0) return [];

    const bests: PersonalBest[] = [];
    
    // Group activities by type
    const activitiesByType = activities.reduce((acc, activity) => {
      const type = activity.type.toLowerCase();
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(activity);
      return acc;
    }, {} as Record<string, StravaActivity[]>);

    // Calculate personal bests for each activity type
    Object.entries(activitiesByType).forEach(([type, typeActivities]) => {
      // Longest distance
      const longestDistance = typeActivities.reduce((max, activity) =>
        activity.distance > max.distance ? activity : max
      );
      if (longestDistance.distance > 0) {
        bests.push({
          type,
          metric: "distance",
          value: longestDistance.distance,
          activity: longestDistance,
        });
      }

      // Fastest average speed (for activities with meaningful speed)
      const fastest = typeActivities
        .filter((a) => a.average_speed > 0 && a.moving_time > 60) // At least 1 minute
        .reduce((max, activity) =>
          activity.average_speed > max.average_speed ? activity : max
        );
      if (fastest && fastest.average_speed > 0) {
        bests.push({
          type,
          metric: "speed",
          value: fastest.average_speed,
          activity: fastest,
        });
      }

      // Highest elevation gain
      const highestElevation = typeActivities
        .filter((a) => a.total_elevation_gain > 0)
        .reduce((max, activity) =>
          activity.total_elevation_gain > max.total_elevation_gain
            ? activity
            : max
        );
      if (highestElevation && highestElevation.total_elevation_gain > 0) {
        bests.push({
          type,
          metric: "elevation",
          value: highestElevation.total_elevation_gain,
          activity: highestElevation,
        });
      }

      // Longest duration
      const longestDuration = typeActivities.reduce((max, activity) =>
        activity.moving_time > max.moving_time ? activity : max
      );
      if (longestDuration.moving_time > 0) {
        bests.push({
          type,
          metric: "duration",
          value: longestDuration.moving_time,
          activity: longestDuration,
        });
      }
    });

    return bests.sort((a, b) => {
      // Sort by activity type, then by metric
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.metric.localeCompare(b.metric);
    });
  };

  const handleLoadPersonalBests = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const activities = await stravaService.getRecentActivities(user.id, days);
      const bests = calculatePersonalBests(activities);
      setPersonalBests(bests);

      toast({
        title: "Personal Bests Loaded",
        description: `${bests.length} personal bests found`,
      });
    } catch (error) {
      console.error("Error loading personal bests:", error);
      toast({
        title: t("error"),
        description:
          error instanceof Error
            ? error.message
            : "Failed to load personal bests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMetricLabel = (metric: string, activityType: string): string => {
    const typeLabels: Record<string, Record<string, string>> = {
      run: {
        distance: language === "de" ? "Längste Distanz" : "Longest Distance",
        speed: language === "de" ? "Schnellste Pace" : "Fastest Pace",
        elevation: language === "de" ? "Höchster Anstieg" : "Highest Elevation",
        duration: language === "de" ? "Längste Dauer" : "Longest Duration",
      },
      ride: {
        distance: language === "de" ? "Längste Distanz" : "Longest Distance",
        speed: language === "de" ? "Höchste Geschwindigkeit" : "Highest Speed",
        elevation: language === "de" ? "Höchster Anstieg" : "Highest Elevation",
        duration: language === "de" ? "Längste Dauer" : "Longest Duration",
      },
    };

    return (
      typeLabels[activityType.toLowerCase()]?.[metric] ||
      metric.charAt(0).toUpperCase() + metric.slice(1)
    );
  };

  const getMetricValue = (best: PersonalBest): string => {
    switch (best.metric) {
      case "distance":
        return formatDistance(best.value);
      case "speed":
        // For running, show pace; for cycling, show speed
        if (best.type.toLowerCase() === "run" || best.type.toLowerCase() === "running") {
          return formatPace(best.value);
        }
        return formatSpeed(best.value);
      case "elevation":
        return `${Math.round(best.value)} m`;
      case "duration":
        return formatDuration(best.value);
      default:
        return best.value.toString();
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case "distance":
        return <TrendingUp className="h-4 w-4" />;
      case "speed":
        return <Zap className="h-4 w-4" />;
      case "elevation":
        return <TrendingUp className="h-4 w-4" />;
      case "duration":
        return <Clock className="h-4 w-4" />;
      default:
        return <Trophy className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Personal Best
        </CardTitle>
        <CardDescription>
          Your personal records from Strava activities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="days-pb" className="text-sm font-medium">
              Time Range
            </label>
            <select
              id="days-pb"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value={30}>30 {t("days") || "days"}</option>
              <option value={90}>90 {t("days") || "days"}</option>
              <option value={180}>180 {t("days") || "days"}</option>
              <option value={365}>365 {t("days") || "days"}</option>
              <option value={730}>All Time</option>
            </select>
          </div>
          <Button onClick={handleLoadPersonalBests} disabled={isLoading}>
            {isLoading ? t("loading") : "Load Personal Bests"}
          </Button>
        </div>

        {personalBests.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(
              personalBests.reduce((acc, best) => {
                if (!acc[best.type]) {
                  acc[best.type] = [];
                }
                acc[best.type].push(best);
                return acc;
              }, {} as Record<string, PersonalBest[]>)
            ).map(([type, typeBests]) => (
              <div key={type} className="space-y-2">
                <h3 className="font-medium capitalize">{type}</h3>
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                  {typeBests.map((best, index) => (
                    <Card key={index} className="border-l-4 border-l-yellow-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getMetricIcon(best.metric)}
                              <span className="text-sm font-medium">
                                {getMetricLabel(best.metric, best.type)}
                              </span>
                            </div>
                            <div className="text-2xl font-bold mb-1">
                              {getMetricValue(best)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {best.activity.name}
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(best.activity.start_date_local)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No personal bests found. Load activities to see your records.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

