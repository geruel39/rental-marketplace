"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        setError("Could not reset your password. Please try the recovery link again.");
        return;
      }

      await supabase.auth.signOut();
      setSuccess("Your password has been updated. Redirecting to login...");
      form.reset();
      router.replace("/login");
      router.refresh();
    });
  });

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-md border-border/70 shadow-sm">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your new password below to finish recovering your account.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {success ? (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}

            <Form {...form}>
              <form className="space-y-4" onSubmit={onSubmit}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="new-password"
                          placeholder="Create a new password"
                          type="password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="new-password"
                          placeholder="Repeat your new password"
                          type="password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button className="w-full" disabled={isPending} type="submit">
                  {isPending ? "Saving..." : "Update Password"}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-muted-foreground">
              Back to{" "}
              <Link className="font-medium text-foreground underline" href="/login">
                sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
