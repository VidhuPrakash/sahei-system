import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const onboardingUrl = new URL("/org/new", request.url);

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/organizations/me/onboarding-status`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });

    // A non-2xx response (403 with no active org yet, or an api error) fails
    // closed: the dashboard can't render real data from a broken api anyway,
    // so redirecting to the wizard is strictly less broken than a flash of an
    // empty shell for an org that never finished setup.
    if (!response.ok) {
      return NextResponse.redirect(onboardingUrl);
    }

    const status: { complete: boolean } = await response.json();
    if (!status.complete) {
      return NextResponse.redirect(onboardingUrl);
    }
  } catch {
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
