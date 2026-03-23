function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseUrl() {
  return getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function getSupabaseAnonKey() {
  return getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getAppUrl() {
  return getRequiredEnv("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
}

export function getServiceRoleKey() {
  return getRequiredEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getHitPayApiUrl() {
  return (
    process.env.NEXT_PUBLIC_HITPAY_API_URL ??
    "https://api.sandbox.hit-pay.com/v1"
  );
}

export const env = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  HITPAY_API_KEY: process.env.HITPAY_API_KEY,
  HITPAY_WEBHOOK_SALT: process.env.HITPAY_WEBHOOK_SALT,
  NEXT_PUBLIC_HITPAY_API_URL: getHitPayApiUrl(),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
} as const;
