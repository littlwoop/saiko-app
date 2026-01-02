import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
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
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 30),
  });
  const [capedPoints, setCapedPoints] = useState(false);
  const [challenge_type, setChallengeType] = useState<ChallengeType>("standard");
  const [noEndDate, setNoEndDate] = useState(false);

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
          
          // Set dates
          const startDate = new Date(challenge.startDate);
          const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
          setNoEndDate(!endDate);
          setDate({
            from: startDate,
            to: endDate || undefined,
          });

          // Set objectives
          if (challenge.objectives && challenge.objectives.length > 0) {
            setObjectives(challenge.objectives.map(obj => ({
              id: obj.id,
              title: obj.title,
              description: obj.description || "",
              targetValue: obj.targetValue || 0,
              unit: obj.unit || "",
              pointsPerUnit: obj.pointsPerUnit || 0,
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
    setObjectives([
      ...objectives,
      {
        id: uuidv4(),
        title: "",
        description: "",
        targetValue: 0,
        unit: "",
        pointsPerUnit: 0,
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

    if (!title || !description || !date?.from) {
      toast({
        title: t("error"),
        description: t("fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    if (!noEndDate && !date.to) {
      toast({
        title: t("error"),
        description: t("fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    const hasEmptyObjective = challenge_type === "checklist"
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
      
      return {
        ...obj,
        id: validId,
        targetValue: Number(obj.targetValue) || undefined,
        pointsPerUnit: Number(obj.pointsPerUnit) || undefined,
      };
    });

    await updateChallenge(parseInt(id), {
      title,
      description,
      startDate: date.from.toISOString(),
      endDate: noEndDate ? undefined : date.to?.toISOString(),
      challenge_type: databaseChallengeType as ChallengeType,
      capedPoints,
      objectives: objectivesWithValidIds,
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
          <Label>{t("challengeDuration")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                {date?.from ? (
                  date.to && !noEndDate ? (
                    <>
                      {format(date.from, "LLL dd, yyyy")} -{" "}
                      {format(date.to, "LLL dd, yyyy")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, yyyy")
                  )
                ) : (
                  <span>{t("pickDateRange")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="noEndDate"
              checked={noEndDate}
              onCheckedChange={(checked) => {
                setNoEndDate(checked as boolean);
                if (checked) {
                  setDate({ ...date, to: undefined });
                }
              }}
            />
            <Label htmlFor="noEndDate" className="text-sm font-normal cursor-pointer">
              {t("noEndDate")}
            </Label>
          </div>
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

                {challenge_type !== "checklist" && (
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

