import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';

import BaseLayout from '@/components/layout/BaseLayout';
import PWAIntallGuidance from '@/components/PWAInstallGuidance/PWAIntallGuidance';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  SITE_VERIFICATION,
} from '@/config/seo';

import { Providers } from './providers';

import StyledComponentsRegistry from '@/styles/registry';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.json',
  // Input, invitation and shared-result pages are not public search landing pages.
  // Public pages explicitly opt in, rather than inheriting indexing accidentally.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/images/kakao-share.jpg',
        width: 1200,
        height: 1200,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/images/kakao-share.jpg'],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || SITE_VERIFICATION.google,
    other: {
      'naver-site-verification':
        process.env.NAVER_SITE_VERIFICATION || SITE_VERIFICATION.naver,
    },
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>
          <StyledComponentsRegistry>
            <BaseLayout>{children}</BaseLayout>
            <PWAIntallGuidance />
          </StyledComponentsRegistry>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
