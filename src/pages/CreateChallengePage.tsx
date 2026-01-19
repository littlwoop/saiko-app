import CreateChallengeForm from "@/components/challenges/CreateChallengeForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

export default function CreateChallengePage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="container py-4 sm:py-8 px-2 sm:px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 sm:mb-6 text-2xl sm:text-3xl font-bold">{t("createNewChallenge")}</h1>
        <CreateChallengeForm />
      </div>
    </div>
  );
}
