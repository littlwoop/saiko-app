import { Challenge } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Award, Calendar, Trophy } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ChallengeCardProps {
  challenge: Challenge;
  userScore?: number;
  showJoin?: boolean;
}

export default function ChallengeCard({ 
  challenge, 
  userScore = 0,
  showJoin = true 
}: ChallengeCardProps) {
  const { joinChallenge, userChallenges } = useChallenges();
  const { user } = useAuth();
  
  const hasJoined = user && (
    userChallenges.some(uc => uc.userId === user.id && uc.challengeId === challenge.id) ||
    challenge.participants.includes(user.id)
  );
  
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const today = new Date();
  
  const isActive = today >= startDate && today <= endDate;
  const isFuture = today < startDate;
  const isPast = today > endDate;
  
  const totalObjectives = challenge.objectives.length;
  const progress = userScore / challenge.totalPoints * 100;
  
  return (
    <Card className="overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="line-clamp-1 text-lg">{challenge.title}</CardTitle>
          {isActive && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>}
          {isFuture && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Upcoming</Badge>}
          {isPast && <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Completed</Badge>}
        </div>
        <CardDescription className="line-clamp-2">{challenge.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2 flex-grow">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-challenge-purple" />
            <span className="text-sm">{totalObjectives} Objectives</span>
            <span className="ml-auto text-sm font-semibold">
              {challenge.totalPoints} Points
            </span>
          </div>
          
          {hasJoined && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Your Progress</span>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        {user ? (
          hasJoined ? (
            <Button asChild className="w-full" variant="outline">
              <Link to={`/challenges/${challenge.id}`}>View Challenge</Link>
            </Button>
          ) : (
            showJoin && (
              <Button 
                className="w-full" 
                onClick={() => joinChallenge(challenge.id)}
              >
                <Trophy className="mr-2 h-4 w-4" />
                Join Challenge
              </Button>
            )
          )
        ) : (
          <Button asChild className="w-full">
            <Link to="/login">Login to Join</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
