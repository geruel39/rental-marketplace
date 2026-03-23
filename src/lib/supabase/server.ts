import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

export async function createClient() {
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
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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
