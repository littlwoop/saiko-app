import CreateChallengeForm from "@/components/challenges/CreateChallengeForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

export default function CreateChallengePage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="container py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">{t("createNewChallenge")}</h1>
        <CreateChallengeForm />
      </div>
    </div>
  );
}
