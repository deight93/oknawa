import type { Metadata } from 'next';
import MainView from '@/views/main/MainView';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/config/seo';

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
};

const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: ['OKNAWA', 'Ok, 나와!'],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: 'ko-KR',
};

export default function MainPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(website).replace(/</g, '\\u003c'),
        }}
      />
      <MainView />
    </>
  );
}
