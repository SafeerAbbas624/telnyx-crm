import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
    const isRootPage = req.nextUrl.pathname === '/'

    // Redirect root to sign-in for unauthenticated users, dashboard for authenticated
    if (isRootPage) {
      if (isAuth) {
        if (token.role === 'ADMIN') {
          return NextResponse.redirect(new URL('/contacts', req.url))
        } else if (token.role === 'TEAM_USER') {
          return NextResponse.redirect(new URL('/team-dashboard', req.url))
        }
      }
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (isAuth && isAuthPage) {
      if (token.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/contacts', req.url))
      } else if (token.role === 'TEAM_USER') {
        return NextResponse.redirect(new URL('/team-dashboard', req.url))
      }
    }

    // Allow access to auth pages for unauthenticated users
    if (!isAuth && isAuthPage) {
      return NextResponse.next()
    }

    // Redirect unauthenticated users to sign-in page
    if (!isAuth) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Role-based access control
    if (isAuth) {
      const pathname = req.nextUrl.pathname

      // Admin-only routes
      if (pathname.startsWith('/dashboard') && token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/team-dashboard', req.url))
      }

      // Team user-only routes
      if (pathname.startsWith('/team-dashboard') && token.role !== 'TEAM_USER') {
        return NextResponse.redirect(new URL('/contacts', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: () => true, // Let the middleware function handle authorization
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (uploaded files like CSVs)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|uploads).*)',
  ],
}
