import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/listings/new", "/admin"];
const authRoutes = ["/login", "/register"];
const adminRoutes = ["/admin"];
const maintenanceBypassRoutes = ["/maintenance"];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  function setCookie(name: string, value: string, options?: Record<string, unknown>) {
    request.cookies.set(name, value);
    response.cookies.set(name, value, options);
  }

  function removeCookie(name: string, options?: Record<string, unknown>) {
    request.cookies.set(name, "");
    response.cookies.set(name, "", { ...options, maxAge: 0 });
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean }>();

    isAdmin = profile?.is_admin === true;
  }

  const { data: maintenanceSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle<{ value: boolean | string | number | null }>();

  const maintenanceMode =
    maintenanceSetting?.value === true ||
    maintenanceSetting?.value === 1 ||
    maintenanceSetting?.value === "1" ||
    maintenanceSetting?.value === "true";

  if (
    maintenanceMode &&
    !isAdmin &&
    !matchesRoute(pathname, maintenanceBypassRoutes)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/maintenance";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && matchesRoute(pathname, protectedRoutes)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && matchesRoute(pathname, authRoutes)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.searchParams.delete("redirectedFrom");
    return NextResponse.redirect(redirectUrl);
  }

  if (user && matchesRoute(pathname, adminRoutes)) {
    if (!isAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.searchParams.delete("redirectedFrom");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks(?:/.*)?$).*)",
  ],
};
