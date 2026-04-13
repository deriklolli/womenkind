import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // We need to forward cookies through the response so Supabase can refresh
  // the session token if it has expired. This is the required pattern for
  // @supabase/ssr in Next.js middleware.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          // Write cookies onto the request first (needed for downstream reads)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Rebuild the response with updated cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // IMPORTANT: Always call getUser() — this refreshes the session if needed.
  // Never use getSession() in middleware as it doesn't validate the JWT server-side.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const hostname = request.headers.get('host') ?? ''

  // --- Coming-soon gate for public domain ---
  // Unauthenticated visitors hitting the root of womenkindhealth.com see the
  // coming-soon page. Authenticated users are always let through so that
  // logging in on the public domain doesn't trap them in a redirect loop.
  const isPublicDomain =
    hostname === 'womenkindhealth.com' || hostname === 'www.womenkindhealth.com'

  if (isPublicDomain && path === '/' && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    return NextResponse.rewrite(url)
  }

  // Protected patient pages — anything under /patient except the login page
  const isPatientProtected =
    path.startsWith('/patient') && !path.startsWith('/patient/login')

  // Protected provider pages — anything under /provider except the login page
  const isProviderProtected =
    path.startsWith('/provider') && !path.startsWith('/provider/login')

  if ((isPatientProtected || isProviderProtected) && !user) {
    const loginPath = isProviderProtected ? '/provider/login' : '/patient/login'
    const loginUrl = new URL(loginPath, request.url)
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  // Return the supabaseResponse (not a plain NextResponse.next()) so that
  // any session cookie refreshes are forwarded to the browser.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder files (images, logos, audio)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav)$).*)',
  ],
}
