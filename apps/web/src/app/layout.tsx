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
const DESCRIPTION = "A USDT checkout for social sellers and small online stores. No parcel, no payout. Late orders are refunded automatically. Test network.";

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
              <Link href="/onboard" className="inline-flex min-h-11 items-center px-2 text-ink-2 no-underline hover:text-ink sm:px-3">
                Start selling
              </Link>
              <Link href="/merchants" className="inline-flex min-h-11 items-center px-2 text-ink-2 no-underline hover:text-ink sm:px-3">
                For websites
              </Link>
              <Link href="/proof" className="inline-flex min-h-11 items-center px-2 text-ink-2 no-underline hover:text-ink sm:px-3">
                Proof
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t">
          <div className="mx-auto stack-sm max-w-wide px-4 py-6 text-sm text-muted md:px-6">
            <p>PoP stands for Proof of Purchase. This is a test network: test USDT has no value.</p>
            <p>
              For judges:{" "}
              <Link href="/dashboard" className="text-muted">
                seller dashboard
              </Link>
              ,{" "}
              <Link href="/courier" className="text-muted">
                simulated courier
              </Link>
              ,{" "}
              <Link href="/arbiter" className="text-muted">
                arbiter
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
