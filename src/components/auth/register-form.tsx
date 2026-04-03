"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, UserRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { registerWithEmail } from "@/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ActionResponse } from "@/types";

const initialState: ActionResponse | null = null;
const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const registerFormSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6).max(72),
    confirmPassword: z.string(),
    full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
    display_name: z.preprocess(
      emptyStringToUndefined,
      z.string().min(2).max(50).optional(),
    ),
    account_type: z.enum(["individual", "business"]).default("individual"),
    business_name: z.preprocess(
      emptyStringToUndefined,
      z.string().min(2).max(200).optional(),
    ),
    business_registration: z.preprocess(
      emptyStringToUndefined,
      z.string().optional(),
    ),
    acceptTerms: z.boolean().refine((value) => value, {
      message: "You must agree to the Terms of Service",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => data.account_type !== "business" || Boolean(data.business_name),
    {
      message: "Business name is required",
      path: ["business_name"],
    },
  );
type RegisterFormValues = z.input<typeof registerFormSchema>;
type RegisterFormOutput = z.output<typeof registerFormSchema>;

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerWithEmail,
    initialState,
  );
  const form = useForm<RegisterFormValues, undefined, RegisterFormOutput>({
    resolver: zodResolver(registerFormSchema),
    mode: "onSubmit",
    defaultValues: {
      full_name: "",
      display_name: "",
      email: "",
      password: "",
      confirmPassword: "",
      account_type: "individual",
      business_name: "",
      business_registration: "",
      acceptTerms: false,
    },
  });
  const accountType = useWatch({
    control: form.control,
    name: "account_type",
  }) ?? "individual";
  const acceptTerms = useWatch({
    control: form.control,
    name: "acceptTerms",
  }) ?? false;
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("full_name", values.full_name);
    if (values.display_name) formData.set("display_name", values.display_name);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("confirmPassword", values.confirmPassword);
    formData.set("account_type", values.account_type ?? "individual");
    if (values.business_name) formData.set("business_name", values.business_name);
    if (values.business_registration) {
      formData.set("business_registration", values.business_registration);
    }
    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <Card className="w-full max-w-2xl border-border/70 bg-white shadow">
      <CardHeader className="space-y-2 text-center">
        <p className="text-brand-navy text-2xl font-bold">RentHub</p>
        <CardTitle className="text-brand-navy text-2xl">Create your account</CardTitle>
        <p className="text-sm text-muted-foreground">
          Join RentHub to list items, accept bookings, and rent from others.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {state?.success ? (
          <Alert>
            <AlertDescription>{state.success}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="full_name">
                Full Name
              </label>
              <Input
                id="full_name"
                placeholder="Jane Doe"
                {...form.register("full_name")}
              />
              {errors.full_name ? (
                <p className="text-sm text-destructive">
                  {errors.full_name.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="display_name">
                Display Name
              </label>
              <Input
                id="display_name"
                placeholder="Optional public name"
                {...form.register("display_name")}
              />
              {errors.display_name ? (
                <p className="text-sm text-destructive">
                  {String(errors.display_name.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Account Type</label>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  accountType === "individual"
                    ? "border-brand-navy bg-brand-navy/5"
                    : "border-border hover:bg-brand-light",
                )}
                onClick={() =>
                  form.setValue("account_type", "individual", {
                    shouldValidate: true,
                  })
                }
                type="button"
              >
                <UserRound className="text-brand-steel mb-3 size-5" />
                <div className="font-medium">Individual</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rent and list as a personal account.
                </p>
              </button>
              <button
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  accountType === "business"
                    ? "border-brand-navy bg-brand-navy/5"
                    : "border-border hover:bg-brand-light",
                )}
                onClick={() =>
                  form.setValue("account_type", "business", {
                    shouldValidate: true,
                  })
                }
                type="button"
              >
                <Building2 className="text-brand-steel mb-3 size-5" />
                <div className="font-medium">Business</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showcase inventory as a company or shop.
                </p>
              </button>
            </div>
            <input type="hidden" {...form.register("account_type")} />
            {errors.account_type ? (
              <p className="text-sm text-destructive">
                {errors.account_type.message}
              </p>
            ) : null}
          </div>

          {accountType === "business" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="business_name">
                  Business Name
                </label>
                <Input
                  id="business_name"
                  placeholder="RentHub Rentals LLC"
                  {...form.register("business_name")}
                />
                {errors.business_name ? (
                  <p className="text-sm text-destructive">
                    {String(errors.business_name.message)}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="business_registration"
                >
                  Registration Number
                </label>
                <Input
                  id="business_registration"
                  placeholder="Optional registration ID"
                  {...form.register("business_registration")}
                />
                {errors.business_registration ? (
                  <p className="text-sm text-destructive">
                    {String(errors.business_registration.message)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              autoComplete="email"
              placeholder="you@example.com"
              type="email"
              {...form.register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                autoComplete="new-password"
                placeholder="Create a password"
                type="password"
                {...form.register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat your password"
                type="password"
                {...form.register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-white p-4">
            <Checkbox
              checked={acceptTerms}
              onCheckedChange={(checked) =>
                form.setValue("acceptTerms", Boolean(checked), {
                  shouldValidate: true,
                })
              }
            />
            <div className="space-y-1">
              <div className="text-sm font-medium">
                I agree to the Terms of Service
              </div>
              {errors.acceptTerms ? (
                <p className="text-sm text-destructive">
                  {errors.acceptTerms.message}
                </p>
              ) : null}
            </div>
          </label>

          <Button
            className="w-full bg-brand-navy text-white hover:bg-brand-steel"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-brand-sky hover:text-brand-navy font-medium underline" href="/login">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
