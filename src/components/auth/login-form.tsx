"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chrome, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  loginWithEmail,
  loginWithGoogle,
  sendPasswordResetEmail,
} from "@/actions/auth";
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

export function LoginForm() {
  const [loginState, loginAction, isPending] = useActionState(
    loginWithEmail,
    initialState,
  );
  const [resetState, resetAction, isResetPending] = useActionState(
    sendPasswordResetEmail,
    initialState,
  );
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
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
      loginAction(formData);
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
    <Card className="w-full max-w-md border-border/70 bg-white shadow">
      <CardHeader className="space-y-2 text-center">
        <p className="text-brand-navy text-2xl font-bold">RentHub</p>
        <CardTitle className="text-2xl text-brand-navy">Welcome back</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to manage listings, bookings, and inventory.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loginState?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{loginState.error}</AlertDescription>
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

            <div className="flex justify-end">
              <button
                className="text-brand-sky hover:text-brand-navy text-sm font-medium underline-offset-4 hover:underline"
                onClick={() => {
                  setShowForgotPassword((current) => !current);
                  setResetEmail(form.getValues("email"));
                }}
                type="button"
              >
                Forgot password?
              </button>
            </div>

            {showForgotPassword ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-brand-light p-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="text-brand-sky size-4" />
                    Reset your password
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send you a password reset link.
                  </p>
                </div>

                {resetState?.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{resetState.error}</AlertDescription>
                  </Alert>
                ) : null}

                {resetState?.success ? (
                  <Alert>
                    <AlertDescription>{resetState.success}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                  <Input
                    autoComplete="email"
                    name="email"
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    value={resetEmail}
                  />
                  <Button
                    className="w-full border-brand-navy text-brand-navy hover:bg-brand-light"
                    disabled={isResetPending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("email", resetEmail || form.getValues("email"));
                      startTransition(() => {
                        resetAction(formData);
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    {isResetPending ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              </div>
            ) : null}

            <Button
              className="w-full bg-brand-navy text-white hover:bg-brand-steel"
              disabled={isPending}
              type="submit"
            >
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
            className="w-full bg-white hover:bg-brand-light"
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
          <Link className="text-brand-sky hover:text-brand-navy font-medium underline" href="/register">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
