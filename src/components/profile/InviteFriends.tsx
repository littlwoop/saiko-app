import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Share2, Check, MessageCircle } from "lucide-react";

export default function InviteFriends() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!user) {
    return null;
  }

  // Generate invite link using user ID as referral code
  const inviteCode = user.id;
  const inviteLink = `${window.location.origin}/signup?ref=${inviteCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: t("inviteLinkCopied") || "Link copied!",
        description: t("inviteLinkCopiedDescription") || "The invite link has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: t("error") || "Error",
        description: t("failedToCopyLink") || "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("inviteFriendsTitle") || "Join me on Saiko!",
          text: t("inviteFriendsMessage") || "Join me on Saiko and let's take on challenges together!",
          url: inviteLink,
        });
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== "AbortError") {
          console.error("Error sharing:", error);
        }
      }
    } else {
      // Fallback to copy if share API is not available
      handleCopyLink();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("inviteFriends") || "Invite Friends"}</CardTitle>
        <CardDescription>
          {t("inviteFriendsDescription") || "Share Saiko with your friends and challenge them to join you!"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-link">{t("yourInviteLink") || "Your Invite Link"}</Label>
          <div className="flex gap-2">
            <Input
              id="invite-link"
              value={inviteLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              title={t("copyLink") || "Copy link"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            {navigator.share && (
              <Button
                type="button"
                variant="outline"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {t("share") || "Share"}
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("inviteFriendsHelp") || "Send this link to your friends. When they sign up using your link, they'll be connected to you!"}
        </p>
        <div className="pt-2 border-t">
          <a
            href="https://chat.whatsapp.com/L00uRWF2FhKF45358lit3i"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors text-sm font-medium w-full sm:w-auto justify-center"
          >
            <MessageCircle className="h-4 w-4" />
            {t("joinWhatsAppCommunity") || "Join WhatsApp Community"}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
