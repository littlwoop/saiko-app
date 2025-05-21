import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChallenges } from "@/contexts/ChallengeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { UserRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChallengeCard from "@/components/challenges/ChallengeCard";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { challenges, userChallenges } = useChallenges();
  const { toast } = useToast();
  
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  
  // Get user's joined challenges
  const userJoinedChallenges = user
    ? challenges.filter(challenge => challenge.participants.includes(user.id))
    : [];
  
  // Get challenges created by the user
  const userCreatedChallenges = user
    ? challenges.filter(challenge => challenge.createdById === user.id)
    : [];
  
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real app, this would update the user's profile
    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully.",
    });
  };
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="container py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">My Profile</h1>
        
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardHeader className="flex flex-col items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                  <UserRound className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Joined Challenges</span>
                  <span>{userJoinedChallenges.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created Challenges</span>
                  <span>{userCreatedChallenges.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-2">
            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">Profile Information</TabsTrigger>
                <TabsTrigger value="challenges">My Challenges</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal details here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-4">
                        <Button type="submit">Save Changes</Button>
                        <Button type="button" variant="outline" onClick={logout}>
                          Log Out
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="challenges" className="mt-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium">Joined Challenges</h3>
                    {userJoinedChallenges.length > 0 ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {userJoinedChallenges.map((challenge) => {
                          const userChallenge = userChallenges.find(
                            uc => uc.userId === user.id && uc.challengeId === challenge.id
                          );
                          
                          return (
                            <ChallengeCard
                              key={challenge.id}
                              challenge={challenge}
                              userScore={userChallenge?.totalScore || 0}
                              showJoin={false}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        You haven't joined any challenges yet.
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium">Created Challenges</h3>
                    {userCreatedChallenges.length > 0 ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {userCreatedChallenges.map((challenge) => (
                          <ChallengeCard
                            key={challenge.id}
                            challenge={challenge}
                            userScore={0}
                            showJoin={false}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        You haven't created any challenges yet.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
