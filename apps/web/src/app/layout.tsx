import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@pop/shared";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

// Absolute base for the share image and icon URLs (WhatsApp and Instagram need absolute links).
const SITE =
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL ? "https://pop-web-six.vercel.app" : "http://localhost:3000");
const TITLE = `${APP_NAME}: ${APP_TAGLINE}`;
const DESCRIPTION = "Pay an Instagram seller with a protected checkout: if it is not shipped in time, the money comes back automatically. Test network.";

// The icons (icon.png, apple-icon.png, favicon.ico) and the share image (opengraph-image.png, twitter-image.png) are picked up from this folder.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: APP_NAME, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
            <Link href="/" aria-label={APP_NAME} className="flex min-h-11 items-center no-underline">
              <Image src="/brand/pop-logo-256.png" alt={APP_NAME} width={36} height={36} priority />
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
