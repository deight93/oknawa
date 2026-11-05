import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';

// Match next build's production .env loading, including pnpm's dependency layout.
const nextRequire = createRequire(import.meta.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd(), false);

// Verify crawler-visible output, including dynamic invitation/result URLs.
const build = '.next/server/app';
const origin = 'https://www.oknawa.com';
const read = file => readFileSync(join(build, file), 'utf8');
const tags = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map(([markup]) =>
    Object.fromEntries(
      [...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        value,
      ]),
    ),
  );

function checkPage(html, label, isHome = false) {
  const head = html.split('</head>')[0];
  const meta = tags(head, 'meta');
  const robots = meta
    .filter(tag => tag.name === 'robots')
    .flatMap(tag => tag.content.split(/,\s*/));
  const canonical = tags(head, 'link').filter(tag => tag.rel === 'canonical');
  // Next's built-in 404 adds its own title alongside the inherited metadata.
  // It is a noindex error page, not a search landing page.
  if (label !== '_not-found.html') {
    assert.equal((head.match(/<title>/g) ?? []).length, 1, `${label}: one title`);
  }
  for (const name of ['description', 'viewport']) {
    assert.equal(
      meta.filter(tag => tag.name === name).length,
      1,
      `${label}: one ${name}`,
    );
  }
  if (!isHome) {
    assert.ok(
      robots.includes('noindex') && !robots.includes('index'),
      `${label}: input/invitation/result pages must be noindex`,
    );
    assert.equal(
      canonical.length,
      0,
      `${label}: must not canonicalize to the public home`,
    );
    return;
  }
  assert.ok(
    robots.includes('index') && !robots.includes('noindex'),
    'Home must be indexable',
  );
  assert.deepEqual(
    canonical.map(tag => tag.href),
    [origin],
  );
  assert.match(
    head,
    /<title>중간지점 찾기·약속장소 정하기 \| 오케이나와<\/title>/,
  );
  assert.equal(meta.find(tag => tag.property === 'og:url')?.content, origin);
  assert.equal(
    meta.find(tag => tag.property === 'og:image')?.content,
    `${origin}/images/kakao-share.jpg`,
  );
  assert.ok(!meta.some(tag => tag.name === 'keywords'));
  for (const [name, value] of [
    [
      'google-site-verification',
      process.env.GOOGLE_SITE_VERIFICATION ||
        'JQYWgbKYPxbkRzm_dkJ_y4KRSZQ1Gxx3n0qILpXZyeM',
    ],
    [
      'naver-site-verification',
      process.env.NAVER_SITE_VERIFICATION ||
        '02a15a0a0a7875f3a3d11b0b134c68f1a55a5075',
    ],
  ]) {
    assert.deepEqual(
      meta.filter(tag => tag.name === name).map(tag => tag.content),
      [value],
      `${name}: render the configured ownership token`,
    );
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)?.[1];
  assert.ok(body, 'Home must include a server-rendered body');
  const visible = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  assert.equal((visible.match(/<h1\b/g) ?? []).length, 1);
  const guide = visible.match(
    /<section\b[^>]*aria-labelledby="meeting-guide-title"[^>]*>([\s\S]*?)<\/section>/,
  )?.[1];
  assert.ok(guide, 'Home must include the server-rendered meeting guide');
  const guideText = guide.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const copy of [
    '중간지점 찾기',
    '약속장소 정하기',
    '회원가입 없이',
    '대중교통·자동차·도보',
    '모임 링크를 공유해 각자 입력해요',
    '추천 후보에 투표해 약속장소를 확정하고',
    '지도에서 딱 가운데인 곳을 추천하나요?',
    '위치 기준과 이동시간 기준 중에서 선택할 수 있어요',
    '이미 약속장소를 정했다면요?',
    '그 장소까지의 예상 이동시간과 경로를 확인할 수 있어요',
    '이동시간은 실제와 같나요?',
    '출발 시각과 교통 상황에 따라 달라질 수 있어요',
  ]) {
    assert.ok(
      guideText.includes(copy),
      `Server-rendered home explanation: ${copy}`,
    );
  }
  const jsonLd = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(jsonLd);
  const website = JSON.parse(jsonLd[1]);
  assert.equal(website['@type'], 'WebSite');
  assert.equal(website.url, origin);
  assert.equal(website.name, '오케이나와');
  assert.ok(
    !html.includes('dapi.kakao.com/v2/maps/sdk.js'),
    'Home must not load the map SDK',
  );
}

const pages = readdirSync(build, { recursive: true }).filter(file =>
  file.endsWith('.html'),
);
assert.ok(pages.includes('index.html'));
for (const page of pages) checkPage(read(page), page, page === 'index.html');
const robots = read('robots.txt.body');
assert.match(robots, /Allow: \//);
assert.ok(
  !robots.includes('Disallow:'),
  'Crawlers must be able to read noindex',
);
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
const sitemap = read('sitemap.xml.body');
assert.deepEqual(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url),
  [origin],
);
assert.ok(
  !sitemap.includes('<lastmod>'),
  'Do not claim content changes on every build',
);

// Query-string routes render on request rather than producing .html build files.
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const { port } = portProbe.address();
await new Promise(resolve => portProbe.close(resolve));
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '';
server.stdout.on('data', chunk => {
  output += chunk;
});
server.stderr.on('data', chunk => {
  output += chunk;
});
const base = `http://127.0.0.1:${port}`;
const routes = [
  '/',
  '/?utm_source=seo-check',
  '/search/together?roomId=seo-check',
  '/result?mapId=seo-check',
  '/result/confirm?sharekey=seo-check',
];
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Next server exited: ${output}`);
    try {
      const response = await fetch(`${base}/robots.txt`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Server is still starting. */
    }
    await delay(100);
  }
  assert.ok(ready, `Next server did not become ready: ${output}`);
  for (const userAgent of ['Mozilla/5.0', 'Googlebot', 'Yeti']) {
    for (const route of routes) {
      const response = await fetch(`${base}${route}`, {
        headers: { 'user-agent': userAgent },
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 200, route);
      checkPage(
        await response.text(),
        `${userAgent} ${route}`,
        route === '/' || route.startsWith('/?'),
      );
    }
  }
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    const forceExit = setTimeout(() => server.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(forceExit);
  }
}
console.log(
  `SEO checks passed: ${pages.length} static pages, ${routes.length} HTTP routes x 3 user agents, robots.txt and sitemap.xml.`,
);
