import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
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
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { challenges, userChallenges } = useChallenges();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
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
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      // Update user metadata in Supabase
      const { error } = await supabase.auth.updateUser({
        data: {
          name: name,
        },
        email: email !== user.email ? email : undefined,
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: t("profileUpdated"),
        description: t("profileUpdatedDescription"),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t("error"),
        description: t("profileUpdateFailed"),
        variant: "destructive",
      });
    }
  };
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="container py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">{t("myProfile")}</h1>
        
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
                  <span className="text-muted-foreground">{t("joinedChallenges")}</span>
                  <span>{userJoinedChallenges.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("createdChallenges")}</span>
                  <span>{userCreatedChallenges.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-2">
            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">{t("profileInformation")}</TabsTrigger>
                <TabsTrigger value="challenges">{t("myChallenges")}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("profileInformation")}</CardTitle>
                    <CardDescription>
                      {t("updatePersonalDetails")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t("fullName")}</Label>
                        <Input
                          id="name"
                          value={name}
                          disabled
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          disabled
                          readOnly
                        />
                      </div>
                      <div className="flex gap-4">
                        <Button type="button" variant="outline" onClick={logout}>
                          {t("logOut")}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="challenges" className="mt-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium">{t("joinedChallenges")}</h3>
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
                        {t("noJoinedChallengesYet")}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium">{t("createdChallenges")}</h3>
                    {userCreatedChallenges.length > 0 ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {userCreatedChallenges.map((challenge) => {
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
                        {t("noCreatedChallengesYet")}
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
