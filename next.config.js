/** @type {import('next').NextConfig} */

const nextConfig = {
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
