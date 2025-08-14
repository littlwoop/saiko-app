import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { UserRound, Upload } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import imageCompression from "browser-image-compression";
import { Challenge, UserChallenge } from "@/types";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { getUserChallenges } = useChallenges();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isUploading, setIsUploading] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  });
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);

  const loadChallenges = async () => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);

      // Get all challenges from Supabase
      const { data: challengesData, error: challengesError } = await supabase
        .from("challenges")
        .select("*");

      if (challengesError) throw challengesError;

      // Get user's challenges
      const userChallengesData = await getUserChallenges();

      setChallenges(challengesData || []);
      setUserChallenges(userChallengesData);
    } catch (error) {
      console.error("Error loading challenges:", error);
      toast({
        title: t("error"),
        description: t("error"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load challenges when the user changes
  useEffect(() => {
    if (user) {
      loadChallenges();
    }
  }, [user]);

  // Get user's joined challenges
  const userJoinedChallenges = user
    ? challenges.filter((challenge) => challenge.participants.includes(user.id))
    : [];

  // Get challenges created by the user
  const userCreatedChallenges = user
    ? challenges.filter((challenge) => challenge.createdById === user.id)
    : [];

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("error"),
        description: t("fileTooLarge"),
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: t("error"),
        description: t("invalidFileType"),
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setCropDialogOpen(true);
  };

  const getCroppedImg = async (
    image: HTMLImageElement,
    crop: Crop,
  ): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate the actual pixel values for the crop
    const pixelCrop = {
      x: crop.x * scaleX,
      y: crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY,
    };

    // Set canvas dimensions to match the crop size
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.95,
      ); // Increased quality to 0.95
    });
  };

  const handleCropComplete = async () => {
    if (!selectedFile || !imageRef || !user) return;

    try {
      setIsUploading(true);
      setCropDialogOpen(false);

      // Get cropped image
      const croppedImageBlob = await getCroppedImg(imageRef, crop);
      const croppedFile = new File([croppedImageBlob], selectedFile.name, {
        type: "image/jpeg",
      });

      // Compress the cropped image with better quality settings
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.9, // Increased initial quality
      };

      const compressedFile = await imageCompression(croppedFile, options);

      // Upload to Supabase Storage
      const fileExt = "jpg";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, compressedFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl,
        },
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: t("success"),
        description: t("avatarUpdated"),
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: t("error"),
        description: t("avatarUpdateFailed"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

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
      console.error("Error updating profile:", error);
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
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    {user.avatarUrl && (
                      <AvatarImage
                        src={user.avatarUrl}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <AvatarFallback>
                      <UserRound className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 select-none"
                  >
                    <Upload className="h-4 w-4" />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                <CardTitle className="mt-4">{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("joinedChallenges")}
                  </span>
                  <span>{userJoinedChallenges.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("createdChallenges")}
                  </span>
                  <span>{userCreatedChallenges.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">
                  {t("profileInformation")}
                </TabsTrigger>
                <TabsTrigger value="challenges">
                  {t("myChallenges")}
                </TabsTrigger>
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
                          onChange={(e) => setName(e.target.value)}
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
                        <Button type="submit" onClick={handleUpdateProfile}>
                          {t("saveChanges")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={logout}
                        >
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
                    <h3 className="text-lg font-medium">
                      {t("joinedChallenges")}
                    </h3>
                    {isLoading ? (
                      <p className="mt-2 text-muted-foreground">
                        {t("loading")}
                      </p>
                    ) : userJoinedChallenges.length > 0 ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {userJoinedChallenges.map((challenge) => {
                          const userChallenge = userChallenges.find(
                            (uc) =>
                              uc.userId === user.id &&
                              uc.challengeId === challenge.id,
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
                    <h3 className="text-lg font-medium">
                      {t("createdChallenges")}
                    </h3>
                    {isLoading ? (
                      <p className="mt-2 text-muted-foreground">
                        {t("loading")}
                      </p>
                    ) : userCreatedChallenges.length > 0 ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {userCreatedChallenges.map((challenge) => {
                          const userChallenge = userChallenges.find(
                            (uc) =>
                              uc.userId === user.id &&
                              uc.challengeId === challenge.id,
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

      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cropImage")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={1}
                className="max-h-[400px] w-full"
                style={{ maxWidth: "100%", height: "auto" }}
              >
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Crop preview"
                  ref={setImageRef}
                  className="max-h-[400px] w-full object-contain"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              </ReactCrop>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCropDialogOpen(false);
                  setSelectedFile(null);
                }}
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleCropComplete} disabled={isUploading}>
                {isUploading ? t("uploading") : t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
