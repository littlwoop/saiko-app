import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { getWeekStart, getWeekEnd, isFullWeeksRange } from "@/lib/week-utils";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CircleX, Trophy, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { v4 as uuidv4, validate as validateUUID } from "uuid";
import { ChallengeType, Challenge } from "@/types";
import { useNavigate, useParams } from "react-router-dom";

// Helper function to format date as YYYY-MM-DDTHH:mm:ss.sssZ without timezone conversion
// This preserves the selected date regardless of user's timezone
const formatDateForStorage = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

export default function EditChallengeForm() {
  const { id } = useParams<{ id: string }>();
  const { updateChallenge, getChallenge } = useChallenges();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [capedPoints, setCapedPoints] = useState(false);
  const [challenge_type, setChallengeType] = useState<ChallengeType>("standard");
  const [noEndDate, setNoEndDate] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);

  const [objectives, setObjectives] = useState([
    {
      id: uuidv4(),
      title: "",
      description: "",
      targetValue: 0,
      unit: "",
      pointsPerUnit: 0,
    },
  ]);

  // Update objectives when challenge type changes to completion (weekly uses normal fields)
  useEffect(() => {
    if (challenge_type === "completion") {
      setObjectives(prevObjectives =>
        prevObjectives.map(obj => ({
          ...obj,
          targetValue: obj.targetValue || 1,
          unit: obj.unit || "1",
          pointsPerUnit: obj.pointsPerUnit || 1,
        }))
      );
    }
  }, [challenge_type]);

  // Auto-adjust dates to week boundaries when weekly challenge is selected
  useEffect(() => {
    if (challenge_type === "weekly" && startDate) {
      const weekStart = getWeekStart(startDate);
      
      // Only update start date if it doesn't align with week boundary
      if (startDate.getTime() !== weekStart.getTime()) {
        setStartDate(weekStart);
      }
      
      // Only update end date if it exists and doesn't align with week boundary
      if (endDate && !noEndDate) {
        const weekEnd = getWeekEnd(endDate);
        if (endDate.getTime() !== weekEnd.getTime()) {
          setEndDate(weekEnd);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge_type]);

  // Load challenge data
  useEffect(() => {
    const loadChallenge = async () => {
      if (!id) return;

      try {
        const challenge = await getChallenge(parseInt(id));
        if (challenge) {
          setTitle(challenge.title);
          setDescription(challenge.description);
          setCapedPoints(challenge.capedPoints || false);
          setChallengeType(challenge.challenge_type);
          setIsRepeating(challenge.isRepeating || false);
          
          // Set dates (only if not repeating)
          if (challenge.isRepeating) {
            setStartDate(undefined);
            setEndDate(undefined);
            setNoEndDate(false);
          } else {
            const challengeStartDate = new Date(challenge.startDate);
            const challengeEndDate = challenge.endDate ? new Date(challenge.endDate) : null;
            setNoEndDate(!challengeEndDate);
            setStartDate(challengeStartDate);
            setEndDate(challengeEndDate || undefined);
          }

          // Set objectives
          if (challenge.objectives && challenge.objectives.length > 0) {
            const isCompletion = challenge.challenge_type === "completion";
            setObjectives(challenge.objectives.map(obj => ({
              id: obj.id,
              title: obj.title,
              description: obj.description || "",
              targetValue: isCompletion ? (obj.targetValue || 1) : (obj.targetValue || 0),
              unit: isCompletion ? (obj.unit || "1") : (obj.unit || ""),
              pointsPerUnit: isCompletion ? (obj.pointsPerUnit || 1) : (obj.pointsPerUnit || 0),
            })));
          }
        }
      } catch (error) {
        console.error("Error loading challenge:", error);
        toast({
          title: t("error"),
          description: "Failed to load challenge",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadChallenge();
  }, [id, getChallenge, toast, t]);

  const handleAddObjective = () => {
    const defaultTargetValue = challenge_type === "completion" ? 1 : 0;
    const defaultUnit = challenge_type === "completion" ? "1" : "";
    const defaultPointsPerUnit = challenge_type === "completion" ? 1 : 0;
    
    setObjectives([
      ...objectives,
      {
        id: uuidv4(),
        title: "",
        description: "",
        targetValue: defaultTargetValue,
        unit: defaultUnit,
        pointsPerUnit: defaultPointsPerUnit,
      },
    ]);
  };

  const handleObjectiveChange = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const newObjectives = [...objectives];
    newObjectives[index] = {
      ...newObjectives[index],
      [field]: value,
    };
    setObjectives(newObjectives);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length > 1) {
      const newObjectives = [...objectives];
      newObjectives.splice(index, 1);
      setObjectives(newObjectives);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    if (!title || !description) {
      toast({
        title: t("error"),
        description: t("fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    // For repeating challenges, dates are not required
    if (!isRepeating) {
      if (!startDate) {
        toast({
          title: t("error"),
          description: t("fillRequiredFields"),
          variant: "destructive",
        });
        return;
      }

      if (!noEndDate && !endDate) {
        toast({
          title: t("error"),
          description: t("fillRequiredFields"),
          variant: "destructive",
        });
        return;
      }
    }

    // Validate full weeks for weekly challenges (only if not repeating)
    if (!isRepeating && challenge_type === "weekly" && !noEndDate && startDate && endDate) {
      if (!isFullWeeksRange(startDate, endDate)) {
        toast({
          title: t("error"),
          description: t("mustSelectFullWeeks"),
          variant: "destructive",
        });
        return;
      }
    }

    // Different validation for checklist/collection challenges and completion challenges
    const hasEmptyObjective = challenge_type === "checklist"
      ? objectives.some(obj => !obj.title)
      : challenge_type === "completion"
      ? objectives.some(obj => !obj.title)
      : objectives.some(
          (obj) =>
            !obj.title ||
            !obj.unit ||
            obj.targetValue === undefined ||
            (obj.targetValue || 0) <= 0 ||
            obj.pointsPerUnit === undefined ||
            (obj.pointsPerUnit || 0) <= 0,
        );

    if (hasEmptyObjective) {
      toast({
        title: t("error"),
        description: t("completeObjectiveDetails"),
        variant: "destructive",
      });
      return;
    }

    const databaseChallengeType = challenge_type === "checklist" ? "collection" : challenge_type;

    const objectivesWithValidIds = objectives.map((obj) => {
      let validId = obj.id;
      
      if (!validateUUID(obj.id)) {
        console.warn(`Invalid UUID for objective "${obj.title}", generating new one`);
        validId = uuidv4();
      }
      
      // For completion challenges, set defaults to 1
      const targetValue = challenge_type === "completion" ? 1 : (Number(obj.targetValue) || undefined);
      const unit = challenge_type === "completion" ? "1" : obj.unit;
      const pointsPerUnit = challenge_type === "completion" ? 1 : (Number(obj.pointsPerUnit) || undefined);
      
      return {
        ...obj,
        id: validId,
        targetValue,
        unit,
        pointsPerUnit,
      };
    });

    await updateChallenge(parseInt(id), {
      title,
      description,
      startDate: isRepeating ? undefined : (startDate ? formatDateForStorage(startDate) : undefined),
      endDate: isRepeating ? undefined : (noEndDate ? undefined : (endDate ? formatDateForStorage(endDate) : undefined)),
      challenge_type: databaseChallengeType as ChallengeType,
      capedPoints,
      objectives: objectivesWithValidIds,
      isRepeating,
    });

    navigate(`/challenges/${id}`);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-full rounded bg-muted"></div>
          <div className="h-24 w-full rounded bg-muted"></div>
          <div className="h-10 w-full rounded bg-muted"></div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("challengeTitle")}</Label>
          <Input
            id="title"
            placeholder={t("challengeTitlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("description")}</Label>
          <Textarea
            id="description"
            placeholder={t("descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRepeating"
              checked={isRepeating}
              onCheckedChange={(checked) => {
                setIsRepeating(checked as boolean);
                if (checked) {
                  setStartDate(undefined);
                  setEndDate(undefined);
                  setNoEndDate(false);
                } else {
                  setStartDate(new Date());
                  setEndDate(addDays(new Date(), 30));
                }
              }}
            />
            <Label htmlFor="isRepeating" className="text-sm font-normal cursor-pointer">
              {t("repeatingChallenge") || "Repeating Challenge (users start when they join)"}
            </Label>
          </div>
          {!isRepeating && (
            <>
              <Label>{t("challengeDuration")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm">{t("startDate") || "Start Date"}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {startDate ? (
                          format(startDate, "LLL dd, yyyy")
                        ) : (
                          <span>{t("pickStartDate") || "Pick start date"}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="single"
                        selected={startDate}
                        weekStartsOn={1}
                        onSelect={(date) => {
                          if (date) {
                            if (challenge_type === "weekly") {
                              // Auto-adjust to week start (Monday)
                              const weekStart = getWeekStart(date);
                              setStartDate(weekStart);
                            } else {
                              setStartDate(date);
                            }
                          }
                        }}
                        disabled={(date) => {
                          // Disable dates after end date if end date is set
                          if (endDate && !noEndDate) {
                            return date > endDate;
                          }
                          return false;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm">{t("endDate") || "End Date"}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={noEndDate}
                      >
                        {endDate && !noEndDate ? (
                          format(endDate, "LLL dd, yyyy")
                        ) : noEndDate ? (
                          <span className="text-muted-foreground">{t("noEndDate")}</span>
                        ) : (
                          <span>{t("pickEndDate") || "Pick end date"}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="single"
                        selected={endDate}
                        weekStartsOn={1}
                        onSelect={(date) => {
                          if (date) {
                            if (challenge_type === "weekly") {
                              // Auto-adjust to week end (Sunday)
                              const weekEnd = getWeekEnd(date);
                              setEndDate(weekEnd);
                            } else {
                              setEndDate(date);
                            }
                          }
                        }}
                        disabled={(date) => {
                          // Disable dates before start date
                          if (startDate) {
                            return date < startDate;
                          }
                          return false;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="noEndDate"
                  checked={noEndDate}
                  onCheckedChange={(checked) => {
                    setNoEndDate(checked as boolean);
                    if (checked) {
                      setEndDate(undefined);
                    } else if (!endDate) {
                      // Set default end date if enabling end date
                      setEndDate(addDays(startDate || new Date(), 30));
                    }
                  }}
                />
                <Label htmlFor="noEndDate" className="text-sm font-normal cursor-pointer">
                  {t("noEndDate")}
                </Label>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="challengeType">{t("challengeType")}</Label>
          <Select value={challenge_type} onValueChange={(value: ChallengeType) => setChallengeType(value)}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectChallengeType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">{t("standardChallenge")}</SelectItem>
              <SelectItem value="bingo">{t("bingoChallenge")}</SelectItem>
              <SelectItem value="completion">{t("completionChallenge")}</SelectItem>
              <SelectItem value="weekly">{t("weeklyChallenge")}</SelectItem>
              <SelectItem value="checklist">{t("checklistChallenge")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="capedPoints"
            checked={capedPoints}
            onCheckedChange={(checked) => setCapedPoints(checked as boolean)}
          />
          <Label htmlFor="capedPoints" className="text-sm font-normal">
            {t("capedPoints")}
          </Label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t("challengeObjectives")}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddObjective}
          >
            <Plus className="mr-2 h-4 w-4" /> {t("addObjective")}
          </Button>
        </div>

        <div className="space-y-4">
          {objectives.map((objective, index) => (
            <Card key={objective.id || index} className="p-4 relative">
              {objectives.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-8 w-8 p-0"
                  onClick={() => handleRemoveObjective(index)}
                >
                  <CircleX className="h-4 w-4" />
                  <span className="sr-only">{t("remove")}</span>
                </Button>
              )}

              <div className="space-y-4 pr-8">
                <div className="space-y-2">
                  <Label htmlFor={`objective-${index}-title`}>
                    {t("objectiveTitle")}
                  </Label>
                  <Input
                    id={`objective-${index}-title`}
                    placeholder={t("objectiveTitlePlaceholder")}
                    value={objective.title}
                    onChange={(e) =>
                      handleObjectiveChange(index, "title", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`objective-${index}-description`}>
                    {t("objectiveDescription")} <span className="text-muted-foreground">({t("optional")})</span>
                  </Label>
                  <Textarea
                    id={`objective-${index}-description`}
                    placeholder={t("objectiveDescriptionPlaceholder")}
                    value={objective.description || ""}
                    onChange={(e) =>
                      handleObjectiveChange(
                        index,
                        "description",
                        e.target.value,
                      )
                    }
                    className="min-h-[60px]"
                  />
                </div>

                {challenge_type !== "checklist" && challenge_type !== "completion" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`objective-${index}-target`}>
                        {t("targetValue")}
                      </Label>
                      <Input
                        id={`objective-${index}-target`}
                        type="number"
                        min="1"
                        placeholder={t("targetValuePlaceholder")}
                        value={objective.targetValue || ""}
                        onChange={(e) =>
                          handleObjectiveChange(
                            index,
                            "targetValue",
                            Number(e.target.value),
                          )
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`objective-${index}-unit`}>
                        {t("unit")}
                      </Label>
                      <Input
                        id={`objective-${index}-unit`}
                        placeholder={t("unitPlaceholder")}
                        value={objective.unit}
                        onChange={(e) =>
                          handleObjectiveChange(index, "unit", e.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`objective-${index}-points`}>
                        {t("pointsPerUnit")}
                      </Label>
                      <Input
                        id={`objective-${index}-points`}
                        type="number"
                        min="1"
                        placeholder={t("pointsPerUnitPlaceholder")}
                        value={objective.pointsPerUnit || ""}
                        onChange={(e) =>
                          handleObjectiveChange(
                            index,
                            "pointsPerUnit",
                            Number(e.target.value),
                          )
                        }
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full">
        <Trophy className="mr-2 h-4 w-4" /> {t("updateChallenge") || "Update Challenge"}
      </Button>
    </form>
  );
}

