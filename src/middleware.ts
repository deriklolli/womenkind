import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Hostnames that should serve the coming soon page
const COMING_SOON_HOSTS = [
  'womenkindhealth.com',
  'www.womenkindhealth.com',
]

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // If the request is from the public-facing domain, serve the coming soon page
  if (COMING_SOON_HOSTS.includes(host)) {
    // Allow the coming soon page itself to load normally (avoids redirect loop)
    if (pathname.startsWith('/coming-soon')) {
      return NextResponse.next()
    }

    // Allow all authenticated app routes through
    if (pathname.startsWith('/patient') || pathname.startsWith('/provider') || pathname.startsWith('/intake') || pathname.startsWith('/signup') || pathname.startsWith('/auth') || pathname.startsWith('/presentation')) {
      return NextResponse.next()
    }

    // Allow Next.js internals and static assets through
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/api') ||
      pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|woff|woff2|ttf|mp3|mp4|wav|ogg)$/) ||
      pathname.startsWith('/audio/')
    ) {
      return NextResponse.next()
    }

    // Rewrite all other paths to /coming-soon (preserves URL in browser)
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals
  matcher: ['/((?!_next/static|_next/image).*)'],
}
