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

  // The admin sign-in page sits outside the admin guard but still starts with
  // /admin, so it has to be excluded by name or it would redirect to /login
  // and bounce straight back here.
  const isAdminLogin = path === "/admin/login";
  const isAuthRoute = path === "/login" || path === "/signup" || isAdminLogin;

  const needsAuth =
    path.startsWith("/dashboard") || (path.startsWith("/admin") && !isAdminLogin);

  if (!signedIn && needsAuth) {
    const url = request.nextUrl.clone();
    // Admin routes belong back to the admin sign-in page; sending them to the
    // traveller login would show a form that can never satisfy the role check.
    url.pathname = path.startsWith("/admin") ? "/admin/login" : "/login";
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