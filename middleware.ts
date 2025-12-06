import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// Admin-only routes - these require ADMIN role to access
const ADMIN_ONLY_ROUTES = [
  '/billing',
  '/import',
  '/import-v2',
  '/settings',
  '/team-overview',
]

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
    const isRootPage = req.nextUrl.pathname === '/'
    const pathname = req.nextUrl.pathname

    // Redirect root to sign-in for unauthenticated users, contacts for authenticated
    if (isRootPage) {
      if (isAuth) {
        // All authenticated users go to /contacts (unified entry point)
        return NextResponse.redirect(new URL('/contacts', req.url))
      }
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // If user is authenticated and trying to access auth pages, redirect to contacts
    if (isAuth && isAuthPage) {
      return NextResponse.redirect(new URL('/contacts', req.url))
    }

    // Allow access to auth pages for unauthenticated users
    if (!isAuth && isAuthPage) {
      return NextResponse.next()
    }

    // Redirect unauthenticated users to sign-in page
    if (!isAuth) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Role-based access control for admin-only routes
    if (isAuth && token.role !== 'ADMIN') {
      // Check if trying to access an admin-only route
      const isAdminOnlyRoute = ADMIN_ONLY_ROUTES.some(route =>
        pathname === route || pathname.startsWith(route + '/')
      )

      if (isAdminOnlyRoute) {
        // Redirect non-admin users to contacts page
        return NextResponse.redirect(new URL('/contacts', req.url))
      }
    }

    // Legacy team-dashboard redirect - send to unified layout
    if (pathname.startsWith('/team-dashboard')) {
      return NextResponse.redirect(new URL('/contacts', req.url))
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
