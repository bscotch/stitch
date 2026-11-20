import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { channels } from './channels.ts';
import {
  buildReleasesFeed,
  fetchFeedSources,
  type FeedSources,
} from './compute.ts';
import { parseFeed, type FeedEntry } from './rss.ts';
import {
  releasesFeedJsonSchema,
  releasesFeedSchema,
  type ChannelInfo,
} from './schemas.ts';

const channel = (name: string) =>
  channels.find((c) => c.name === name)! as ChannelInfo;

const entry = (
  version: string,
  publishedAt: string,
  feedUrl = 'https://example.com/feed.rss',
): FeedEntry => ({
  version,
  publishedAt: new Date(publishedAt).toISOString(),
  link: `https://example.com/${version}`,
  feedUrl,
});

describe('GameMaker RSS feeds', function () {
  it('can parse IDE feed items', function () {
    const entries = parseFeed(
      `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0"><channel><title>Feed</title>
        <item>
          <title>Version 2024.06.2.162</title>
          <pubDate>Wed, 12 Feb 2025 08:55:42 Z</pubDate>
          <link>https://gms.yoyogames.com/GameMaker-Installer-2024.6.2.162.exe</link>
        </item>
        <item>
          <title>Version 2026.1.0.27</title>
          <pubDate>Mon, 16 Nov 2026 11:29:41 +0000</pubDate>
          <enclosure url="https://gms.yoyogames.com/GameMaker-2026.1.0.27.pkg" type="application/octet-stream" length="1" />
        </item>
      </channel></rss>`,
      'https://example.com/feed.rss',
    );
    assert.deepEqual(entries, [
      {
        version: '2024.6.2.162',
        publishedAt: '2025-02-12T08:55:42.000Z',
        link: 'https://gms.yoyogames.com/GameMaker-Installer-2024.6.2.162.exe',
        feedUrl: 'https://example.com/feed.rss',
      },
      {
        version: '2026.1.0.27',
        publishedAt: '2026-11-16T11:29:41.000Z',
        link: 'https://gms.yoyogames.com/GameMaker-2026.1.0.27.pkg',
        feedUrl: 'https://example.com/feed.rss',
      },
    ]);
  });

  it('rejects unexpected feed content', function () {
    assert.throws(() =>
      parseFeed(
        `<rss><channel><item><title>Something else</title><pubDate>x</pubDate></item></channel></rss>`,
        'https://example.com/feed.rss',
      ),
    );
  });
});

describe('Unified releases feed', function () {
  const lts = channel('lts2026');
  const lts2022 = channel('lts2022');
  const beta = channel('beta');
  const unstable = channel('unstable');
  const monthly = channel('monthly');

  const sources: FeedSources = {
    ide: [
      {
        // Listed first to ensure that channel order doesn't depend on source order
        channel: lts2022,
        platform: 'windows',
        entries: [
          entry('2022.0.3.85', '2024-12-03'),
          entry('2026.0.0.16', '2026-06-02'),
        ],
      },
      {
        channel: lts,
        platform: 'windows',
        entries: [
          entry('2026.0.0.16', '2026-06-01'),
          entry('2026.1.0.27', '2026-11-16'),
        ],
      },
      {
        channel: lts,
        platform: 'linux',
        // Same version, different date
        entries: [entry('2026.1.0.27', '2026-11-15')],
      },
      {
        channel: beta,
        platform: 'windows',
        entries: [entry('2026.100.0.1199', '2026-11-04')],
      },
      {
        channel: unstable,
        platform: 'windows',
        entries: [
          entry('2026.100.0.1199', '2026-11-04'),
          entry('2026.100.0.1206', '2026-11-18'),
        ],
      },
      {
        channel: monthly,
        platform: 'windows',
        entries: [
          // Excluded by the channel's minVersion
          entry('2.3.7.606', '2021-01-01'),
          entry('2024.6.1.160', '2024-07-09'),
          // IDE-only patch release
          entry('2024.6.2.162', '2024-07-15'),
        ],
      },
    ],
    runtime: [
      {
        channel: lts2022,
        entries: [
          entry('2022.0.3.99', '2024-12-01', 'https://example.com/lts2022.rss'),
        ],
      },
      {
        channel: lts,
        entries: [
          entry('2026.0.0.23', '2026-05-15', 'https://example.com/lts.rss'),
          entry('2026.1.0.28', '2026-11-05', 'https://example.com/lts.rss'),
        ],
      },
      {
        channel: unstable,
        entries: [
          entry(
            '2026.100.0.1133',
            '2026-10-31',
            'https://example.com/unstable.rss',
          ),
          // Unstable-only runtime that came out before the Beta IDE
          entry(
            '2026.100.0.1134',
            '2026-11-02',
            'https://example.com/unstable.rss',
          ),
          entry(
            '2026.100.0.1137',
            '2026-11-17',
            'https://example.com/unstable.rss',
          ),
        ],
      },
      {
        channel: beta,
        entries: [
          entry(
            '2026.100.0.1133',
            '2026-10-31',
            'https://example.com/beta.rss',
          ),
        ],
      },
      {
        channel: monthly,
        entries: [
          entry(
            '2024.6.1.208',
            '2024-07-08',
            'https://example.com/monthly.rss',
          ),
        ],
      },
    ],
  };

  it('merges, pairs, and sorts releases', function () {
    const feed = buildReleasesFeed(sources, {
      overrides: {},
      generatedAt: new Date('2026-11-20'),
    });
    releasesFeedSchema.parse(feed);
    assert.deepEqual(
      feed.releases.map((r) => r.version),
      [
        '2026.100.0.1206',
        '2026.1.0.27',
        '2026.100.0.1199',
        '2026.0.0.16',
        '2022.0.3.85',
        '2024.6.2.162',
        '2024.6.1.160',
      ],
    );
    const byVersion = (v: string) =>
      feed.releases.find((r) => r.version === v)!;

    // Merged across platforms, with the earliest date
    const lts1 = byVersion('2026.1.0.27');
    assert.deepEqual(Object.keys(lts1.downloads).sort(), ['linux', 'windows']);
    assert.equal(lts1.publishedAt, '2026-11-15T00:00:00.000Z');
    assert.deepEqual(lts1.runtime, {
      kind: 'gms2',
      version: '2026.1.0.28',
      publishedAt: '2026-11-05T00:00:00.000Z',
      channels: ['lts2026'],
      feedUrl: 'https://example.com/lts.rss',
    });

    // Channels are sorted from most to least stable
    assert.deepEqual(byVersion('2026.0.0.16').channels, ['lts2026', 'lts2022']);
    assert.equal(byVersion('2026.0.0.16').runtime.version, '2026.0.0.23');

    // Merged across channels, preferring the most stable channel's feed,
    // and preferring runtimes on the IDE's most stable channel
    const beta1199 = byVersion('2026.100.0.1199');
    assert.deepEqual(beta1199.channels, ['beta', 'unstable']);
    assert.equal(beta1199.runtime.version, '2026.100.0.1133');
    assert.deepEqual(beta1199.runtime.channels, ['beta', 'unstable']);
    assert.equal(beta1199.runtime.feedUrl, 'https://example.com/beta.rss');

    // Unstable picks the newest runtime published before it
    assert.equal(
      byVersion('2026.100.0.1206').runtime.version,
      '2026.100.0.1137',
    );

    // IDE-only patch releases fall back to the previous patch's runtimes
    assert.equal(byVersion('2024.6.2.162').runtime.version, '2024.6.1.208');
  });

  it('applies overrides', function () {
    const feed = buildReleasesFeed(sources, {
      overrides: { '2026.100.0.1199': '2026.100.0.1134' },
    });
    const release = feed.releases.find((r) => r.version === '2026.100.0.1199')!;
    assert.equal(release.runtime.version, '2026.100.0.1134');
  });

  it('rejects overrides for unknown versions', function () {
    assert.throws(
      () =>
        buildReleasesFeed(sources, {
          overrides: { '2026.1.0.27': '2026.1.0.99' },
        }),
      /unknown IDE or runtime/,
    );
  });

  it('fails if an IDE cannot be paired', function () {
    assert.throws(
      () =>
        buildReleasesFeed(
          {
            ...sources,
            runtime: sources.runtime.filter(
              (r) => r.channel.name !== 'lts2026',
            ),
          },
          { overrides: {} },
        ),
      /Could not find a runtime/,
    );
  });

  it('fails if a channel has no releases', function () {
    assert.throws(
      () =>
        buildReleasesFeed(
          {
            ...sources,
            ide: sources.ide.filter((r) => r.channel.name !== 'beta'),
          },
          { overrides: {} },
        ),
      /Channel "beta" has no IDE releases/,
    );
  });

  it('can generate a JSON Schema', function () {
    const schema = releasesFeedJsonSchema();
    assert.equal(schema.type, 'object');
    assert.ok(schema.properties?.releases);
  });

  it(
    'can build the feed from live GameMaker data',
    {
      // Makes ~20 requests to GameMaker's servers. The publish-stitch-site
      // workflow exercises this daily.
      skip: process.env.CI ? 'Too network-heavy for CI' : false,
    },
    async function () {
      const feed = buildReleasesFeed(await fetchFeedSources());
      assert.ok(feed.releases.length > 0);
    },
  );
});
