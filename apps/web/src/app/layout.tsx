import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@pop/shared";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "Pay an Instagram or WhatsApp seller. If your order doesn't arrive, you get your money back automatically.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-control focus:bg-bg focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="border-b">
          <div className="mx-auto flex max-w-wide items-center justify-between px-4 py-1 md:px-6">
            <Link href="/" className="flex min-h-11 items-center gap-2 font-bold text-ink no-underline">
              <span className="mark" aria-hidden="true" />
              {APP_NAME}
            </Link>
            <nav aria-label="Main" className="flex items-center">
              <Link href="/onboard" className="inline-flex min-h-11 items-center px-3 text-ink-2 no-underline hover:text-ink">
                Sell with {APP_NAME}
              </Link>
              <Link href="/proof" className="inline-flex min-h-11 items-center px-3 text-ink-2 no-underline hover:text-ink">
                Proof
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t">
          <div className="mx-auto max-w-wide px-4 py-6 text-sm text-muted md:px-6">
            {APP_NAME} is an ETHGlobal Mumbai 2026 project. It runs on a test network: test USDT has no value and no real money moves.
          </div>
        </footer>
      </body>
    </html>
  );
}
