/** @type {import('next').NextConfig} */

const nextConfig = {
  // This app uses static metadata. Include it in the initial head for every
  // crawler, including Yeti, and keep noindex visible on dynamic room URLs.
  htmlLimitedBots: /.*/,
  compiler: {
    styledComponents: {
      ssr: true,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 't1.kakaocdn.net',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 't1.daumcdn.net',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
