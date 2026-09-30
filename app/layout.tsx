import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { LogoutButton } from "@/components/auth/logout-button";
import { RiskFooter } from "@/components/layout/risk-footer";
import { NavLinks } from "@/components/layout/nav-links";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/providers";
import { BackendOfflineBanner } from "@/components/states/backend-offline-banner";
import { authEnabled, isAuthorized, SESSION_COOKIE } from "@/lib/auth";
import { MODE_COOKIE, parseMode } from "@/lib/mode";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Trade Bot · Painel", template: "%s · Trade Bot" },
  description: "Painel de acompanhamento do trade bot (projeto educacional).",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const initialMode = parseMode(cookieStore.get(MODE_COOKIE)?.value);
  // Without a session (only possible when DASHBOARD_PASSWORD is set) the only reachable page is
  // /login: render it bare, without data providers, polling or the SSE connection.
  const authorized = await isAuthorized(cookieStore.get(SESSION_COOKIE)?.value);

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {authorized ? (
          <Providers initialMode={initialMode}>
            <SiteHeader actions={authEnabled() ? <LogoutButton /> : null} />
            <BackendOfflineBanner />
            <div className="flex flex-1">
              <aside className="hidden w-56 shrink-0 border-r p-3 lg:block">
                <div className="sticky top-17">
                  <NavLinks />
                </div>
              </aside>
              <main id="conteudo" className="min-w-0 flex-1 px-4 py-6 sm:px-6">
                <div className="mx-auto max-w-7xl">{children}</div>
              </main>
            </div>
            <RiskFooter />
          </Providers>
        ) : (
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <RiskFooter />
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
