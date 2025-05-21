
import CreateChallengeForm from "@/components/challenges/CreateChallengeForm";

export default function CreateChallengePage() {
  return (
    <div className="container py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">Create New Challenge</h1>
        <CreateChallengeForm />
      </div>
    </div>
  );
}
