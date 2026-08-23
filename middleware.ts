import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicAuthRoute = ["/login", "/update-password", "/auth/callback", "/access-disabled"].includes(pathname);

  if (!user && !isPublicAuthRoute) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.active === false) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Tu acceso a INDEX ONE CRM está desactivado." }, { status: 403 });
      }
      if (pathname !== "/access-disabled") {
        const target = request.nextUrl.clone();
        target.pathname = "/access-disabled";
        target.search = "";
        return NextResponse.redirect(target);
      }
    }

    if (profile?.active !== false && pathname === "/login") {
      const target = request.nextUrl.clone();
      target.pathname = "/dashboard";
      return NextResponse.redirect(target);
    }

    if (profile?.active !== false && pathname === "/access-disabled") {
      const target = request.nextUrl.clone();
      target.pathname = "/dashboard";
      return NextResponse.redirect(target);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/proposals/generate|api/webhooks/resend|api/marketing/google-forms/webhook|api/communications/whatsapp/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
