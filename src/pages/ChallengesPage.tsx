import { useState } from "react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function ChallengesPage() {
  const { challenges, userChallenges, loading } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [searchQuery, setSearchQuery] = useState("");
  
  const activeTab = user ? "all" : "browse";
  
  // Filter challenges based on search query
  const filteredChallenges = challenges.filter(challenge =>
    challenge.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    challenge.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get user's joined challenges
  const userJoinedChallenges = user 
    ? filteredChallenges.filter(challenge => 
        challenge.participants.includes(user.id)
      )
    : [];
  
  // Get other available challenges
  const availableChallenges = user
    ? filteredChallenges.filter(challenge => !challenge.participants.includes(user.id))
    : filteredChallenges;
  
  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-8 w-48 animate-pulse rounded bg-muted"></div>
            <div className="h-10 w-40 animate-pulse rounded bg-muted"></div>
          </div>
          <div className="h-10 w-full animate-pulse rounded bg-muted"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[300px] animate-pulse rounded-lg bg-muted"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">{t("challenges")}</h1>
          <Button asChild>
            <Link to="/challenges/create">
              <Plus className="mr-2 h-4 w-4" />
              {t("createChallenge")}
            </Link>
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchChallenges")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Tabs defaultValue={activeTab}>
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-2">
            <TabsTrigger value="all">{t("allChallenges")}</TabsTrigger>
            {user && (
              <TabsTrigger value="joined">{t("myJoinedChallenges")}</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {filteredChallenges.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredChallenges.map((challenge) => {
                  const userChallenge = userChallenges.find(
                    uc => user && uc.userId === user.id && uc.challengeId === challenge.id
                  );
                  
                  return (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      userScore={userChallenge?.totalScore || 0}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-10 text-center">
                <h3 className="text-lg font-medium">{t("noChallengesFound")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("noChallengesFoundDescription")}
                </p>
                <Button asChild className="mt-4">
                  <Link to="/challenges/create">{t("createChallenge")}</Link>
                </Button>
              </div>
            )}
          </TabsContent>
          
          {user && (
            <TabsContent value="joined" className="mt-6">
              {userJoinedChallenges.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                <div className="mt-10 text-center">
                  <h3 className="text-lg font-medium">{t("noJoinedChallenges")}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("noJoinedChallengesDescription")}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-4">
                    <Button asChild variant="outline">
                      <Link to="/challenges">{t("browseChallenges")}</Link>
                    </Button>
                    <Button asChild>
                      <Link to="/challenges/create">{t("createChallenge")}</Link>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
