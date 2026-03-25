"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProfile } from "@/actions/profile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validations";
import { getInitials } from "@/lib/utils";
import type { ActionResponse, Profile } from "@/types";

interface ProfileSettingsFormProps {
  profile: Profile;
}

const initialState: ActionResponse | null = null;

export function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateProfile, initialState);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      display_name: profile.display_name ?? "",
      bio: profile.bio ?? "",
      phone: profile.phone ?? "",
      location: profile.location ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      country: profile.country ?? "",
      website_url: profile.website_url ?? "",
    },
  });

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    toast.success(state.success);
    router.refresh();
  }, [router, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }

    toast.error(state.error);
  }, [state?.error]);

  const avatarPreview = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }

    return profile.avatar_url ?? null;
  }, [avatarFile, profile.avatar_url]);

  function onSubmit(values: ProfileUpdateInput) {
    const formData = new FormData();

    formData.set("full_name", values.full_name ?? "");
    formData.set("display_name", values.display_name ?? "");
    formData.set("bio", values.bio ?? "");
    formData.set("phone", values.phone ?? "");
    formData.set("location", values.location ?? "");
    formData.set("city", values.city ?? "");
    formData.set("state", values.state ?? "");
    formData.set("country", values.country ?? "");
    formData.set("website_url", values.website_url ?? "");

    if (avatarFile) {
      formData.set("avatar", avatarFile);
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={profile.display_name || profile.full_name}
              className="h-full w-full object-cover"
              src={avatarPreview}
            />
          ) : (
            getInitials(profile.display_name || profile.full_name || profile.email)
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="avatar">Avatar</Label>
          <input
            accept="image/*"
            className="hidden"
            id="avatar"
            onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          <Button asChild type="button" variant="outline">
            <label htmlFor="avatar">
              <Upload className="size-4" />
              Change Avatar
            </label>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input id="full_name" {...form.register("full_name")} />
          {form.formState.errors.full_name ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.full_name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input id="display_name" {...form.register("display_name")} />
          {form.formState.errors.display_name ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.display_name.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Account Type</Label>
        <Badge variant="secondary">
          {profile.account_type === "business" ? "Business" : "Individual"}
        </Badge>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={5} {...form.register("bio")} />
        {form.formState.errors.bio ? (
          <p className="text-sm text-destructive">{form.formState.errors.bio.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...form.register("phone")} />
          {form.formState.errors.phone ? (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="website_url">Website URL</Label>
          <Input id="website_url" {...form.register("website_url")} />
          {form.formState.errors.website_url ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.website_url.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...form.register("location")} />
          {form.formState.errors.location ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.location.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" {...form.register("city")} />
          {form.formState.errors.city ? (
            <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" {...form.register("state")} />
          {form.formState.errors.state ? (
            <p className="text-sm text-destructive">{form.formState.errors.state.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...form.register("country")} />
          {form.formState.errors.country ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.country.message}
            </p>
          ) : null}
        </div>
      </div>

      <Button disabled={isPending} type="submit">
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
    </form>
  );
}
