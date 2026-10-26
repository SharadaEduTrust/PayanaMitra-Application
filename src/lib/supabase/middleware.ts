import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and, critically,
 * re-applies the RLS context so `auth.uid()` resolves correctly in Postgres.
 * Skipping this is the usual cause of "empty results despite having data".
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Before Supabase is configured there is no session to refresh. Let public
  // pages render so the app is still viewable; anything that touches the
  // database will fail loudly in its own route.
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and getUser, it can cause
  // hard-to-debug session problems.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const signedIn = Boolean(user);
  const isAuthRoute = path === "/login" || path === "/signup";
  const needsAuth = path.startsWith("/dashboard") || path.startsWith("/admin") || path === "/change-password";
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  if (path === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (signedIn) {
    const lastActiveCookie = request.cookies.get("payana_last_active")?.value;
    const lastActive = lastActiveCookie ? parseInt(lastActiveCookie, 10) : NaN;
    const now = Date.now();

    if (!isNaN(lastActive) && now - lastActive > INACTIVITY_TIMEOUT_MS) {
      // Inactivity timeout exceeded (more than 30 mins)
      await supabase.auth.signOut().catch(() => null);

      if (path.startsWith("/api/") && path !== "/api/login" && path !== "/api/logout") {
        const jsonResponse = NextResponse.json(
          { error: "Session timed out due to 30 minutes of inactivity. Please log in again.", timeout: true },
          { status: 401 }
        );
        jsonResponse.cookies.delete("payana_last_active");
        request.cookies.getAll().forEach((cookie) => {
          if (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")) {
            jsonResponse.cookies.delete(cookie.name);
          }
        });
        return jsonResponse;
      }

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("timeout", "1");
      if (needsAuth) {
        redirectUrl.searchParams.set("next", path);
      }

      const redirectResponse = NextResponse.redirect(redirectUrl);
      redirectResponse.cookies.delete("payana_last_active");

      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")) {
          redirectResponse.cookies.delete(cookie.name);
        }
      });

      return redirectResponse;
    }

    // Still active: update the payana_last_active cookie
    response.cookies.set("payana_last_active", String(now), {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    });
  }

  if (!signedIn && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (signedIn && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}