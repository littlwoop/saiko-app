import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trophy, Star, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

export default function Index() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background to-muted py-20 md:py-32">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              <span>{t("heroTitlePart1")}</span>{" "}
              <span className="bg-gradient-to-r from-challenge-purple via-challenge-teal to-challenge-coral bg-clip-text text-transparent">
                {t("heroTitlePart2")}
              </span>{" "}
              <span>{t("heroTitlePart3")}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              {t("heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <Button asChild size="lg">
                  <Link to="/challenges">
                    <Trophy className="mr-2 h-5 w-5" />
                    {t("browseChallenges")}
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/signup">
                    <Trophy className="mr-2 h-5 w-5" />
                    {t("getStarted")}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/challenges/create">{t("createChallenge")}</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 -left-4 h-72 w-72 rounded-full bg-challenge-purple opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-challenge-teal opacity-10 blur-3xl"></div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("howItWorks")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("howItWorksDescription")}
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">
                {t("createChallenges")}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t("createChallengesDescription")}
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-challenge-teal/10">
                <Star className="h-6 w-6 text-challenge-teal" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">
                {t("trackProgress")}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t("trackProgressDescription")}
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-challenge-coral/10">
                <Award className="h-6 w-6 text-challenge-coral" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">{t("winPoints")}</h3>
              <p className="mt-2 text-muted-foreground">
                {t("winPointsDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {/* <section className="border-t bg-muted/30 py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Ready to Start Your Challenge?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Join our community of challenge creators and participants today
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <Button asChild>
                  <Link to="/challenges/create">Create Your Challenge</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/signup">Create Free Account</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/challenges">Browse Challenges</Link>
              </Button>
            </div>
          </div>
        </div>
      </section> */}
    </>
  );
}
