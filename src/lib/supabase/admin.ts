import { createClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabaseUrl } from "@/lib/env";

export function createAdminClient() {
  // ONLY use this in webhooks and server-side admin operations
  return createClient(
    getSupabaseUrl(),
    getServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
