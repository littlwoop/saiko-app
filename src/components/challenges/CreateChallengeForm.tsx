import { useState, useEffect, useRef } from "react";
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
import { CircleX, Trophy, Plus, Info } from "lucide-react";
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
import { ChallengeType } from "@/types";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

// Helper function to format date as YYYY-MM-DDTHH:mm:ss.sssZ without timezone conversion
// This preserves the selected date regardless of user's timezone
const formatDateForStorage = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

export default function CreateChallengeForm() {
  const { createChallenge } = useChallenges();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [capedPoints, setCapedPoints] = useState(false);
  const [challenge_type, setChallengeType] = useState<ChallengeType>("standard");
  const [noEndDate, setNoEndDate] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [durationDays, setDurationDays] = useState<number>(30); // Duration in days for repeating challenges
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const prevChallengeTypeRef = useRef<ChallengeType | null>(null);

  // Update objectives when challenge type changes
  useEffect(() => {
    const prevType = prevChallengeTypeRef.current;
    prevChallengeTypeRef.current = challenge_type;

    // Skip on initial mount (when prevType is null and challenge_type is standard)
    if (prevType === null && challenge_type === "standard") {
      return;
    }

    if (challenge_type === "completion") {
      setObjectives(prevObjectives =>
        prevObjectives.map(obj => ({
          ...obj,
          targetValue: obj.targetValue || 1,
          unit: obj.unit || "1",
          pointsPerUnit: obj.pointsPerUnit || 1,
        }))
      );
    } else if (challenge_type === "bingo") {
      // Ensure exactly 25 objectives for bingo (5x5 grid)
      setObjectives(prevObjectives => {
        const currentCount = prevObjectives.length;
        if (currentCount === 25) {
          return prevObjectives; // Already correct, no change needed
        } else if (currentCount < 25) {
          // Add empty objectives to reach 25
          const newObjectives = [...prevObjectives];
          for (let i = currentCount; i < 25; i++) {
            newObjectives.push({
              id: uuidv4(),
              title: "",
              description: "",
              targetValue: 1,
              unit: "",
              pointsPerUnit: 1,
            });
          }
          return newObjectives;
        } else {
          // Remove excess objectives, keep first 25
          return prevObjectives.slice(0, 25);
        }
      });
    } else if (prevType === "bingo" && challenge_type !== "bingo") {
      // When switching away from bingo, if all 25 are empty, reset to 1
      setObjectives(prevObjectives => {
        if (prevObjectives.length === 25 && prevObjectives.every(obj => !obj.title && !obj.description)) {
          return [{
            id: uuidv4(),
            title: "",
            description: "",
            targetValue: 0,
            unit: "",
            pointsPerUnit: 0,
          }];
        }
        return prevObjectives;
      });
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
    
    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

    if (!title || !description) {
      toast({
        title: t("error"),
        description: t("fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    // For repeating challenges, duration is required
    // For non-repeating challenges, start date is required
    if (isRepeating) {
      if (!durationDays || durationDays <= 0) {
        toast({
          title: t("error"),
          description: "Please enter a valid duration (in days)",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!startDate) {
        toast({
          title: t("error"),
          description: t("fillRequiredFields"),
          variant: "destructive",
        });
        return;
      }

      // For non-repeating challenges, end date is required unless noEndDate is checked
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

    // Different validation for checklist/collection challenges and completion/weekly/bingo challenges
    const hasEmptyObjective = challenge_type === "checklist"
      ? objectives.some(obj => !obj.title)
      : (challenge_type === "completion" || challenge_type === "weekly" || challenge_type === "bingo")
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

    // Map checklist to collection for database storage
    const databaseChallengeType = challenge_type === "checklist" ? "collection" : challenge_type;

    // Ensure all objectives have valid UUIDs
    const objectivesWithValidIds = objectives.map((obj) => {
      let validId = obj.id;
      
      // If the ID is not a valid UUID, generate a new one
      if (!validateUUID(obj.id)) {
        console.warn(`Invalid UUID for objective "${obj.title}", generating new one`);
        validId = uuidv4();
      }
      
      // For completion and bingo challenges, set defaults to 1
      const targetValue = (challenge_type === "completion" || challenge_type === "bingo") ? 1 : (Number(obj.targetValue) || undefined);
      const unit = (challenge_type === "completion" || challenge_type === "bingo") ? "1" : obj.unit;
      const pointsPerUnit = (challenge_type === "completion" || challenge_type === "bingo") ? 1 : (Number(obj.pointsPerUnit) || undefined);
      
      return {
        ...obj,
        id: validId,
        targetValue,
        unit,
        pointsPerUnit,
      };
    });

    // For repeating challenges, calculate startDate and endDate from duration
    // Use a reference date (2024-01-01) for startDate, and add duration for endDate
    // This allows us to store the duration while keeping the date format
    let finalStartDate: string | undefined;
    let finalEndDate: string | undefined;

    if (isRepeating) {
      // Use a fixed reference date (2024-01-01) as startDate
      const referenceStartDate = new Date(2024, 0, 1); // January 1, 2024
      const calculatedEndDate = addDays(referenceStartDate, durationDays);
      finalStartDate = formatDateForStorage(referenceStartDate);
      finalEndDate = formatDateForStorage(calculatedEndDate);
    } else {
      finalStartDate = startDate ? formatDateForStorage(startDate) : undefined;
      finalEndDate = noEndDate ? undefined : (endDate ? formatDateForStorage(endDate) : undefined);
    }

    setIsSubmitting(true);
    try {
      const success = await createChallenge({
        title,
        description,
        startDate: finalStartDate,
        endDate: finalEndDate,
        challengeType: databaseChallengeType as ChallengeType,
        capedPoints,
        objectives: objectivesWithValidIds,
        isRepeating,
        isCollaborative,
      });

      // Only navigate if creation was successful
      // Form fields will remain intact if there's an error
      if (success === true) {
        // Navigate away - form will reset naturally when component unmounts
        // Don't clear fields here to avoid data loss if navigation fails
        navigate("/challenges");
      }
      // If creation failed (success === false), form data remains intact
      // User can fix errors and try again
    } catch (error) {
      console.error("Error creating challenge:", error);
      toast({
        title: t("error"),
        description: "Failed to create challenge. Please try again.",
        variant: "destructive",
      });
      // Form data remains intact on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8 px-2 sm:px-0">
      <div className="space-y-3 sm:space-y-4">
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="challengeMode">{t("challengeMode")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-sm">
                        {t("challengeModeInfo")}
                      </h4>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-semibold text-foreground">{t("individualChallenge")}:</span>
                        <p className="text-muted-foreground mt-1">
                          {t("individualChallengeDescription")}
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">{t("collaborativeChallenge")}:</span>
                        <p className="text-muted-foreground mt-1">
                          {t("collaborativeChallengeDescription")}
                        </p>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant={!isCollaborative ? "default" : "outline"}
                className={`flex-1 text-xs sm:text-sm px-2 sm:px-4 py-2 ${isRepeating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isRepeating}
                onClick={() => {
                  setIsCollaborative(false);
                }}
              >
                <span className="truncate">{t("individualChallenge") || "Individual Challenge"}</span>
              </Button>
              <Button
                type="button"
                variant={isCollaborative ? "default" : "outline"}
                className={`flex-1 text-xs sm:text-sm px-2 sm:px-4 py-2 ${isRepeating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isRepeating}
                onClick={() => {
                  setIsCollaborative(true);
                  setIsRepeating(false);
                }}
              >
                <span className="truncate">{t("collaborativeChallenge") || "Collaborative Challenge"}</span>
              </Button>
            </div>
          </div>
          {isRepeating ? (
            <div className="space-y-2">
              <Label htmlFor="durationDays">{t("challengeDuration") || "Challenge Duration (days)"}</Label>
              <Input
                id="durationDays"
                type="number"
                min="1"
                value={durationDays}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    setDurationDays(value);
                  }
                }}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">
                {t("repeatingChallengeDurationHint") || "Each user will get this many days starting from when they join"}
              </p>
            </div>
          ) : (
            <>
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
                    <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "bottom" : "start"}>
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
                    <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "bottom" : "start"}>
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
          <div className="flex items-center gap-2">
            <Label htmlFor="challengeType">{t("challengeType")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm" align="start">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-sm">
                      {t("challengeTypeInfo")}
                    </h4>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">{t("standardChallenge")}:</span>
                      <p className="text-muted-foreground mt-1">
                        {t("standardChallengeDescription")}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{t("bingoChallenge")}:</span>
                      <p className="text-muted-foreground mt-1">
                        {t("bingoChallengeDescription")}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{t("completionChallenge")}:</span>
                      <p className="text-muted-foreground mt-1">
                        {t("completionChallengeDescription")}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{t("weeklyChallenge")}:</span>
                      <p className="text-muted-foreground mt-1">
                        {t("weeklyChallengeDescription")}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{t("checklistChallenge")}:</span>
                      <p className="text-muted-foreground mt-1">
                        {t("checklistChallengeDescription")}
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

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

      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-medium">{t("challengeObjectives")}</h3>
          {challenge_type !== "bingo" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddObjective}
              className={isMobile ? "px-2" : ""}
            >
              <Plus className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
              {!isMobile && t("addObjective")}
            </Button>
          )}
        </div>

        {challenge_type === "bingo" ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-0.5">
            {objectives.map((objective, index) => (
              <Card key={objective.id || index} className="p-1.5 sm:p-2 relative aspect-square">
                <div className="space-y-1 sm:space-y-2 h-full flex flex-col">
                  <Input
                    placeholder={`${t("objectiveTitle")} ${index + 1}`}
                    value={objective.title}
                    onChange={(e) =>
                      handleObjectiveChange(index, "title", e.target.value)
                    }
                    className="text-[10px] sm:text-xs h-6 sm:h-8"
                  />
                  <Textarea
                    placeholder={t("objectiveDescription")}
                    value={objective.description || ""}
                    onChange={(e) =>
                      handleObjectiveChange(index, "description", e.target.value)
                    }
                    className="text-[10px] sm:text-xs flex-1 min-h-[40px] sm:min-h-[60px] resize-none"
                  />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {objectives.map((objective, index) => (
            <Card key={index} className="p-4 relative">
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

                {challenge_type !== "checklist" && challenge_type !== "completion" && challenge_type !== "weekly" && (
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
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t("creating") || "Creating..."}
          </>
        ) : (
          <>
            <Trophy className="mr-2 h-4 w-4" /> {t("createChallenge")}
          </>
        )}
      </Button>
    </form>
  );
}
