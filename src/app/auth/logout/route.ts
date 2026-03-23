import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

async function performLogout(request: Request) {
  const requestUrl = new URL(request.url);

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if sign-out fails, we still redirect the user away from protected pages.
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}

export async function GET(request: Request) {
  return performLogout(request);
}

export async function POST(request: Request) {
  return performLogout(request);
}
