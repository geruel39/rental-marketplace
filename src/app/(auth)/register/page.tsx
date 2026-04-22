"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  User2,
} from "lucide-react";
import type {
  Control,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { useForm } from "react-hook-form";

import {
  registerBusiness,
  registerIndividual,
} from "@/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  businessRegisterSchema,
  individualRegisterSchema,
  type BusinessRegisterInput,
  type IndividualRegisterInput,
} from "@/lib/validations";
import type { ActionResponse } from "@/types";

type SignupStep = "select" | "individual" | "business";

const initialState: ActionResponse | null = null;

function PasswordField<TFieldValues extends FieldValues>(props: {
  control: Control<TFieldValues>;
  description?: string;
  label: string;
  name: FieldPath<TFieldValues>;
  placeholder: string;
  showPassword: boolean;
  togglePassword: () => void;
}) {
  const { control, description, label, name, placeholder, showPassword, togglePassword } =
    props;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                autoComplete={name === "password" ? "new-password" : "new-password"}
                placeholder={placeholder}
                type={showPassword ? "text" : "password"}
                {...field}
              />
              <Button
                className="absolute top-1/2 right-1 h-7 -translate-y-1/2 px-2"
                onClick={togglePassword}
                type="button"
                variant="ghost"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function IndividualRegistrationForm(props: { onBack: () => void }) {
  const { onBack } = props;
  const [state, formAction, isPending] = useActionState(
    registerIndividual,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const form = useForm<IndividualRegisterInput>({
    resolver: zodResolver(individualRegisterSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      display_name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("first_name", values.first_name);
    formData.set("last_name", values.last_name);
    formData.set("display_name", values.display_name);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("confirm_password", values.confirm_password);
    formData.set("terms_agreed", values.terms_agreed ? "true" : "false");
    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <Card className="border-border/70 bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <Button
          className="w-fit"
          onClick={onBack}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="space-y-1">
          <CardTitle className="text-2xl text-brand-navy">
            Create Individual Account
          </CardTitle>
          <CardDescription>
            Set up your personal RentHub account to rent and list items.
          </CardDescription>
        </div>
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

        <Form {...form}>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="given-name" placeholder="Juan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="family-name" placeholder="Dela Cruz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="How other users will know you" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is how you appear to other users
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
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

            <PasswordField
              control={form.control}
              description="Password must be at least 8 characters, contain 1 uppercase, 1 number"
              label="Password"
              name="password"
              placeholder="Create a password"
              showPassword={showPassword}
              togglePassword={() => setShowPassword((current) => !current)}
            />

            <PasswordField
              control={form.control}
              label="Confirm Password"
              name="confirm_password"
              placeholder="Repeat your password"
              showPassword={showConfirmPassword}
              togglePassword={() => setShowConfirmPassword((current) => !current)}
            />

            <FormField
              control={form.control}
              name="terms_agreed"
              render={({ field }) => (
                <FormItem className="rounded-xl border border-border/70 bg-brand-light/40 p-4">
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value === true}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? true : undefined)
                        }
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-sm leading-6 font-medium">
                        I agree to the{" "}
                        <Link className="underline" href="/terms">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link className="underline" href="/privacy">
                          Privacy Policy
                        </Link>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button
              className="w-full bg-brand-navy text-white hover:bg-brand-steel"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function BusinessRegistrationForm(props: { onBack: () => void }) {
  const { onBack } = props;
  const [state, formAction, isPending] = useActionState(
    registerBusiness,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const form = useForm<BusinessRegisterInput>({
    resolver: zodResolver(businessRegisterSchema),
    defaultValues: {
      representative_first_name: "",
      representative_last_name: "",
      display_name: "",
      business_name: "",
      business_registration: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set(
      "representative_first_name",
      values.representative_first_name,
    );
    formData.set(
      "representative_last_name",
      values.representative_last_name,
    );
    formData.set("display_name", values.display_name);
    formData.set("business_name", values.business_name);
    formData.set("business_registration", values.business_registration);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("confirm_password", values.confirm_password);
    formData.set("terms_agreed", values.terms_agreed ? "true" : "false");
    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <Card className="border-border/70 bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <Button
          className="w-fit"
          onClick={onBack}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="space-y-1">
          <CardTitle className="text-2xl text-brand-navy">
            Create Business Account
          </CardTitle>
          <CardDescription>
            Register your organization and unlock business verification on RentHub.
          </CardDescription>
        </div>
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

        <Form {...form}>
          <form className="space-y-6" onSubmit={onSubmit}>
            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-wide text-brand-navy uppercase">
                  Representative Information
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="representative_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Representative First Name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" placeholder="Maria" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="representative_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Representative Last Name</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" placeholder="Santos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Public business profile name" {...field} />
                    </FormControl>
                    <FormDescription>
                      Your business display name on the platform
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-wide text-brand-navy uppercase">
                  Business Details
                </h2>
              </div>

              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Legal registered business name" {...field} />
                    </FormControl>
                    <FormDescription>
                      Legal registered name
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_registration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Registration Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Registration or incorporation number" {...field} />
                    </FormControl>
                    <FormDescription>
                      Company registration number from your country&apos;s registry
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-wide text-brand-navy uppercase">
                  Account Credentials
                </h2>
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Email</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="email"
                        placeholder="business@example.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <PasswordField
                control={form.control}
                description="Password must be at least 8 characters, contain 1 uppercase, 1 number"
                label="Password"
                name="password"
                placeholder="Create a password"
                showPassword={showPassword}
                togglePassword={() => setShowPassword((current) => !current)}
              />

              <PasswordField
                control={form.control}
                label="Confirm Password"
                name="confirm_password"
                placeholder="Repeat your password"
                showPassword={showConfirmPassword}
                togglePassword={() => setShowConfirmPassword((current) => !current)}
              />
            </section>

            <FormField
              control={form.control}
              name="terms_agreed"
              render={({ field }) => (
                <FormItem className="rounded-xl border border-border/70 bg-brand-light/40 p-4">
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value === true}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? true : undefined)
                        }
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-sm leading-6 font-medium">
                        I agree to the{" "}
                        <Link className="underline" href="/terms">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link className="underline" href="/privacy">
                          Privacy Policy
                        </Link>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button
              className="w-full bg-brand-navy text-white hover:bg-brand-steel"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Creating Business Account..." : "Create Business Account"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  const [step, setStep] = useState<SignupStep>("select");
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (isMounted && user) {
          router.replace("/listings");
        }
      } catch {
        // Keep the register page usable even if the session lookup fails.
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(18,52,86,0.10),_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef4f8_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {step === "select" ? (
            <div className="space-y-8">
              <div className="space-y-3 text-center">
                <p className="text-sm font-semibold tracking-[0.24em] text-brand-steel uppercase">
                  RentHub
                </p>
                <h1 className="text-3xl font-semibold text-brand-navy sm:text-4xl">
                  Create your RentHub account
                </h1>
                <p className="mx-auto max-w-2xl text-base text-muted-foreground">
                  Choose how you want to use RentHub
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-brand-navy/10 bg-white shadow-sm">
                  <CardHeader className="space-y-4">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand-navy">
                      <User2 className="size-7" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl text-brand-navy">
                        Individual
                      </CardTitle>
                      <CardDescription>For personal use</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3 text-sm text-foreground">
                      <li>• Rent items from others</li>
                      <li>• Earn by renting your belongings</li>
                      <li>• Quick account setup</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      ID and selfie verification required before listing
                    </p>
                    <Button
                      className="w-full bg-brand-navy text-white hover:bg-brand-steel"
                      onClick={() => setStep("individual")}
                      type="button"
                    >
                      Sign up as Individual
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-brand-steel/15 bg-white shadow-sm">
                  <CardHeader className="space-y-4">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand-steel">
                      <Building2 className="size-7" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl text-brand-navy">
                        Business
                      </CardTitle>
                      <CardDescription>
                        For companies &amp; organizations
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3 text-sm text-foreground">
                      <li>• List items as a registered business</li>
                      <li>• Business verification badge</li>
                      <li>• Enhanced credibility</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      Business documents required before listing
                    </p>
                    <Button
                      className="w-full border-brand-navy text-brand-navy hover:bg-brand-light"
                      onClick={() => setStep("business")}
                      type="button"
                      variant="outline"
                    >
                      Sign up as Business
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link className="font-medium text-brand-navy underline" href="/login">
                  Sign in
                </Link>
              </p>
            </div>
          ) : null}

          {step === "individual" ? (
            <IndividualRegistrationForm onBack={() => setStep("select")} />
          ) : null}

          {step === "business" ? (
            <BusinessRegistrationForm onBack={() => setStep("select")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
