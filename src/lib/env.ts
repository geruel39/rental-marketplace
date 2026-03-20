const requiredPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

function getRequiredEnv(
  name: keyof typeof requiredPublicEnv,
  value: string | undefined,
) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    requiredPublicEnv.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    requiredPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  NEXT_PUBLIC_APP_URL: getRequiredEnv(
    "NEXT_PUBLIC_APP_URL",
    requiredPublicEnv.NEXT_PUBLIC_APP_URL,
  ),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  HITPAY_API_KEY: process.env.HITPAY_API_KEY,
  HITPAY_WEBHOOK_SALT: process.env.HITPAY_WEBHOOK_SALT,
  NEXT_PUBLIC_HITPAY_API_URL:
    process.env.NEXT_PUBLIC_HITPAY_API_URL ?? "https://api.sandbox.hit-pay.com/v1",
  RESEND_API_KEY: process.env.RESEND_API_KEY,
} as const;

export function getServiceRoleKey() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return env.SUPABASE_SERVICE_ROLE_KEY;
}
