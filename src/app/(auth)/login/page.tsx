"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chrome } from "lucide-react";
import { useForm } from "react-hook-form";

import { loginWithEmail, loginWithGoogle } from "@/actions/auth";
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
import { loginSchema, type LoginInput } from "@/lib/validations";
import type { ActionResponse } from "@/types";

const initialState: ActionResponse | null = null;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginWithEmail,
    initialState,
  );
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGooglePending, startGoogleTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    startTransition(() => {
      formAction(formData);
    });
  });

  const onGoogleClick = () => {
    setGoogleError(null);
    startGoogleTransition(async () => {
      const result = await loginWithGoogle();
      if (result?.error) {
        setGoogleError(result.error);
      }
    });
  };

  return (
    <Card className="w-full max-w-md border-border/70 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to manage listings, bookings, and inventory.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {googleError ? (
          <Alert variant="destructive">
            <AlertDescription>{googleError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="email"
                      placeholder="you@example.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </Form>

        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={isGooglePending}
            onClick={onGoogleClick}
            type="button"
            variant="outline"
          >
            <Chrome className="size-4" />
            {isGooglePending ? "Redirecting..." : "Continue with Google"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link className="font-medium text-foreground underline" href="/register">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
