import { useMemo } from "react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, UserRound } from "lucide-react";

interface LeaderboardTableProps {
  challengeId?: string;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl?: string;
  score: number;
  position: number;
}

export default function LeaderboardTable({ challengeId }: LeaderboardTableProps) {
  const { userChallenges } = useChallenges();
  const { user } = useAuth();
  
  // Mock user data (in a real app, this would come from a database)
  const mockUsers = [
    { id: "1", name: "John Doe", avatarUrl: "https://i.pravatar.cc/150?u=john" },
    { id: "2", name: "Jane Smith", avatarUrl: "https://i.pravatar.cc/150?u=jane" },
    { id: "3", name: "Mike Johnson", avatarUrl: "https://i.pravatar.cc/150?u=mike" },
    { id: "4", name: "Sarah Williams", avatarUrl: "https://i.pravatar.cc/150?u=sarah" },
    { id: "5", name: "Alex Brown", avatarUrl: "https://i.pravatar.cc/150?u=alex" },
  ];
  
  const leaderboard = useMemo(() => {
    let filteredEntries = userChallenges;
    
    if (challengeId) {
      filteredEntries = filteredEntries.filter(uc => uc.challengeId === challengeId);
    }
    
    const entries: LeaderboardEntry[] = filteredEntries.map(uc => {
      const userData = mockUsers.find(u => u.id === uc.userId) || 
        { id: uc.userId, name: `User ${uc.userId}`, avatarUrl: undefined };
      
      return {
        userId: uc.userId,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
        score: uc.totalScore,
        position: 0 // will be calculated below
      };
    });
    
    // Sort by score (descending)
    entries.sort((a, b) => b.score - a.score);
    
    // Assign positions (handling ties)
    let currentPosition = 1;
    let currentScore = Number.MAX_SAFE_INTEGER;
    
    return entries.map((entry, index) => {
      if (entry.score < currentScore) {
        currentPosition = index + 1;
        currentScore = entry.score;
      }
      
      return {
        ...entry,
        position: currentPosition
      };
    });
  }, [userChallenges, challengeId]);
  
  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return "text-yellow-500 font-bold";
      case 2:
        return "text-gray-400 font-bold";
      case 3:
        return "text-amber-700 font-bold";
      default:
        return "";
    }
  };
  
  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-10">
        <Trophy className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">No participants yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Be the first to join this challenge!
        </p>
      </div>
    );
  }
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">Rank</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map(entry => {
            const isCurrentUser = user && entry.userId === user.id;
            
            return (
              <TableRow key={entry.userId} className={isCurrentUser ? "bg-muted/40" : ""}>
                <TableCell className={`text-center ${getPositionStyle(entry.position)}`}>
                  {entry.position === 1 && "🥇"}
                  {entry.position === 2 && "🥈"}
                  {entry.position === 3 && "🥉"}
                  {entry.position > 3 && entry.position}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {entry.avatarUrl ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.avatarUrl} />
                        <AvatarFallback>
                          <UserRound className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className={isCurrentUser ? "font-medium" : ""}>
                      {entry.name} {isCurrentUser && "(You)"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{Math.round(entry.score)} pts</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
