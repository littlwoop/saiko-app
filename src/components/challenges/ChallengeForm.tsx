import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  target: z.string().min(1, "Target is required"),
  deadline: z.string().min(1, "Deadline is required"),
});

type FormData = z.infer<typeof formSchema>;

interface ChallengeFormProps {
  onSubmit: (data: FormData) => void;
  initialData?: Partial<FormData>;
  isSubmitting?: boolean;
}

export function ChallengeForm({
  onSubmit,
  initialData,
  isSubmitting,
}: ChallengeFormProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      target: initialData?.target || "",
      deadline: initialData?.deadline || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("challengeTitle")}</FormLabel>
              <FormControl>
                <Input placeholder={t("enterChallengeTitle")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("challengeDescription")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("enterChallengeDescription")}
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="target"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("challengeTarget")}</FormLabel>
              <FormControl>
                <Input placeholder={t("enterChallengeTarget")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("challengeDeadline")}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("saving") : t("saveChallenge")}
        </Button>
      </form>
    </Form>
  );
}
