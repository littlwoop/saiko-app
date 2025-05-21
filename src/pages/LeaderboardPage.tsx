
import { useState } from "react";
import { useChallenges } from "@/contexts/ChallengeContext";
import LeaderboardTable from "@/components/challenges/LeaderboardTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy } from "lucide-react";

export default function LeaderboardPage() {
  const { challenges } = useChallenges();
  const [selectedChallenge, setSelectedChallenge] = useState<string | undefined>(
    undefined
  );
  
  const handleChallengeChange = (value: string) => {
    setSelectedChallenge(value === "all" ? undefined : value);
  };
  
  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-challenge-purple" />
            <h1 className="text-3xl font-bold">Leaderboard</h1>
          </div>
          
          <div className="w-full sm:w-64">
            <Select
              value={selectedChallenge || "all"}
              onValueChange={handleChallengeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by challenge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Challenges</SelectItem>
                {challenges.map((challenge) => (
                  <SelectItem key={challenge.id} value={challenge.id}>
                    {challenge.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <LeaderboardTable challengeId={selectedChallenge} />
      </div>
    </div>
  );
}
