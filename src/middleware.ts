import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware — runs on every matched request.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session (rotate the access token if needed)
 *  2. Protect routes: redirect unauthenticated users to /login
 *  3. Redirect already-authenticated users away from /login
 */

const PUBLIC_PATHS = ['/login', '/api/login']

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  // Guard: skip auth checks if Supabase credentials are not real yet.
  // This lets the login page render during initial project setup.
  const isConfigured =
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('<') &&
    supabaseAnonKey.length > 20 &&
    !supabaseAnonKey.includes('<')

  if (!isConfigured) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Create a Supabase client that can read + set cookies via the middleware response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session — IMPORTANT: use getUser() not getSession()
  // getSession() reads from the cookie without verifying with Supabase.
  // getUser() makes a network call to verify the token is still valid.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // API routes handle their own auth responses (401/403 JSON) rather than HTML redirects
  if (pathname.startsWith('/api/')) {
    return response
  }

  // Redirect unauthenticated users to /login for page requests
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from /login
  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimisation)
     *  - favicon.ico
     *  - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
