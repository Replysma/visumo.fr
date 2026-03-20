import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Use Clerk middleware only when a valid publishable key is configured.
 * Falls back to a passthrough when keys are placeholder/missing,
 * so the app remains usable before Clerk is set up.
 */
const hasClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('XXXX')

export default hasClerkKeys
  ? clerkMiddleware()
  : (_req: NextRequest) => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
