import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { useChallenges } from "@/contexts/ChallengeContext";
import { Card } from "@/components/ui/card";
import { CircleX, Trophy, Plus } from "lucide-react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';

export default function CreateChallengeForm() {
  const { createChallenge } = useChallenges();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 30),
  });
  
  const [objectives, setObjectives] = useState([
    { 
      id: uuidv4(), 
      title: "", 
      description: "", 
      targetValue: 0, 
      unit: "", 
      pointsPerUnit: 0 
    }
  ]);
  
  const handleAddObjective = () => {
    setObjectives([
      ...objectives,
      { 
        id: uuidv4(), 
        title: "", 
        description: "", 
        targetValue: 0, 
        unit: "", 
        pointsPerUnit: 0 
      }
    ]);
  };
  
  const handleObjectiveChange = (index: number, field: string, value: string | number) => {
    const newObjectives = [...objectives];
    newObjectives[index] = {
      ...newObjectives[index],
      [field]: value
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
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description || !date?.from || !date?.to) {
      toast({
        title: "Error",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    const hasEmptyObjective = objectives.some(
      obj => !obj.title || !obj.unit || obj.targetValue <= 0 || obj.pointsPerUnit <= 0
    );
    
    if (hasEmptyObjective) {
      toast({
        title: "Error",
        description: "Please complete all objective details.",
        variant: "destructive",
      });
      return;
    }
    
    createChallenge({
      title,
      description,
      startDate: date.from.toISOString(),
      endDate: date.to.toISOString(),
      objectives: objectives.map(obj => ({
        ...obj,
        targetValue: Number(obj.targetValue),
        pointsPerUnit: Number(obj.pointsPerUnit)
      })),
    });
    
    navigate("/my-challenges");
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Challenge Title</Label>
          <Input
            id="title"
            placeholder="e.g., 30-Day Fitness Challenge"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe what this challenge is about..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="min-h-[100px]"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Challenge Duration</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, yyyy")} -{" "}
                      {format(date.to, "LLL dd, yyyy")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
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
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Challenge Objectives</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddObjective}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Objective
          </Button>
        </div>
        
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
                  <span className="sr-only">Remove</span>
                </Button>
              )}
              
              <div className="space-y-4 pr-8">
                <div className="space-y-2">
                  <Label htmlFor={`objective-${index}-title`}>Objective Title</Label>
                  <Input
                    id={`objective-${index}-title`}
                    placeholder="e.g., Daily Steps"
                    value={objective.title}
                    onChange={(e) => handleObjectiveChange(index, "title", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`objective-${index}-description`}>Description</Label>
                  <Textarea
                    id={`objective-${index}-description`}
                    placeholder="Describe what participants need to do..."
                    value={objective.description}
                    onChange={(e) => handleObjectiveChange(index, "description", e.target.value)}
                    required
                    className="min-h-[60px]"
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`objective-${index}-target`}>Target Value</Label>
                    <Input
                      id={`objective-${index}-target`}
                      type="number"
                      min="1"
                      placeholder="e.g., 10000"
                      value={objective.targetValue || ""}
                      onChange={(e) => handleObjectiveChange(index, "targetValue", Number(e.target.value))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`objective-${index}-unit`}>Unit</Label>
                    <Input
                      id={`objective-${index}-unit`}
                      placeholder="e.g., steps"
                      value={objective.unit}
                      onChange={(e) => handleObjectiveChange(index, "unit", e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`objective-${index}-points`}>Points per Unit</Label>
                    <Input
                      id={`objective-${index}-points`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 0.1"
                      value={objective.pointsPerUnit || ""}
                      onChange={(e) => handleObjectiveChange(index, "pointsPerUnit", Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit">
          <Trophy className="mr-2 h-4 w-4" />
          Create Challenge
        </Button>
      </div>
    </form>
  );
}
