import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();

  function setCookie(name: string, value: string, options?: Record<string, unknown>) {
    try {
      cookieStore.set(name, value, options);
    } catch {
      // Server Components cannot always write cookies. Middleware refreshes sessions.
    }
  }

  function removeCookie(name: string, options?: Record<string, unknown>) {
    try {
      cookieStore.set(name, "", { ...options, maxAge: 0 });
    } catch {
      // Server Components cannot always write cookies. Middleware refreshes sessions.
    }
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options?.maxAge === 0) {
              removeCookie(name, options);
              return;
            }

            setCookie(name, value, options);
          });
        },
      },
    },
  );
}
