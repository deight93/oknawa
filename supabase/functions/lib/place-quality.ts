import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import { getEnv } from './env.ts';
import type {
  MeetingPurpose,
  PopularMeetingLocation,
} from './location-types.ts';
import { fetchJson } from './utils.ts';

type PlaceCategory = 'food' | 'cafe' | 'drink';

interface KakaoPlaceCountResponse {
  meta?: {
    pageable_count?: number;
    total_count?: number;
  };
}

interface PlaceCountByCategory {
  foodCount: number;
  cafeCount: number;
  drinkCount: number;
}

interface PlaceQualityCacheRow extends PlaceCountByCategory {
  cache_key: string;
  radius: number;
}

interface PlaceQualityCacheUpsert extends PlaceQualityCacheRow {
  location_x: number;
  location_y: number;
  station_name: string;
  expires_at: string;
  updated_at: string;
}

const PLACE_QUALITY_CACHE_TTL_DAYS = 14;
const PLACE_QUALITY_CONCURRENCY_LIMIT = 4;
const PLACE_QUALITY_RADIUS_METERS = 500;
const PLACE_QUALITY_KEY_VERSION = 'v1';

const PLACE_CATEGORY_CONFIG: Record<
  PlaceCategory,
  { categoryGroupCode: string; query: string }
> = {
  food: {
    categoryGroupCode: 'FD6',
    query: '음식점',
  },
  cafe: {
    categoryGroupCode: 'CE7',
    query: '카페',
  },
  drink: {
    categoryGroupCode: 'FD6',
    query: '술집',
  },
};

const PLACE_QUALITY_WEIGHTS: Record<
  MeetingPurpose | 'default',
  Record<PlaceCategory, number>
> = {
  default: {
    food: 0.45,
    cafe: 0.4,
    drink: 0.15,
  },
  meal: {
    food: 1,
    cafe: 0.2,
    drink: 0.1,
  },
  cafe: {
    food: 0.2,
    cafe: 1,
    drink: 0.05,
  },
  drink: {
    food: 0.35,
    cafe: 0.1,
    drink: 1,
  },
  study: {
    food: 0.15,
    cafe: 0.9,
    drink: 0,
  },
  date: {
    food: 0.45,
    cafe: 0.45,
    drink: 0.2,
  },
  meeting: {
    food: 0.35,
    cafe: 0.65,
    drink: 0.05,
  },
};

export async function attachPlaceQualities(
  supabase: SupabaseClient,
  stations: PopularMeetingLocation[],
  meetingPurpose?: MeetingPurpose,
): Promise<PopularMeetingLocation[]> {
  if (stations.length === 0) {
    return stations;
  }

  let kakaoRestApiKey = '';
  try {
    kakaoRestApiKey = getEnv('KAKAO_REST_API_KEY');
  } catch (error) {
    console.error('place quality env error:', error);
    return stations.map(station => withPlaceQuality(station));
  }

  const cacheKeys = stations.map(station => buildPlaceQualityCacheKey(station));
  const cachedCounts = await fetchPlaceQualityCacheMap(supabase, cacheKeys);
  const missingStations = stations.filter(
    station => !cachedCounts.has(buildPlaceQualityCacheKey(station)),
  );
  const fetchedRows = await mapWithConcurrency(
    missingStations,
    PLACE_QUALITY_CONCURRENCY_LIMIT,
    station => fetchStationPlaceCounts(station, kakaoRestApiKey),
  );

  const rowsToUpsert = fetchedRows.filter(
    (row): row is PlaceQualityCacheUpsert => Boolean(row),
  );
  if (rowsToUpsert.length > 0) {
    await upsertPlaceQualityCache(supabase, rowsToUpsert);
  }

  const countMap = new Map(cachedCounts);
  rowsToUpsert.forEach(row => {
    countMap.set(row.cache_key, row);
  });

  const rawScores = stations.map(station =>
    getWeightedPlaceQualityScore(
      countMap.get(buildPlaceQualityCacheKey(station)),
      meetingPurpose,
    ),
  );
  const maxScore = Math.max(...rawScores, 0);

  return stations.map((station, index) => {
    const counts = countMap.get(buildPlaceQualityCacheKey(station));
    const score = maxScore > 0 ? rawScores[index] / maxScore : 0;
    return withPlaceQuality(station, counts, score);
  });
}

async function fetchPlaceQualityCacheMap(
  supabase: SupabaseClient,
  cacheKeys: string[],
): Promise<Map<string, PlaceQualityCacheRow>> {
  const uniqueCacheKeys = Array.from(new Set(cacheKeys));
  if (uniqueCacheKeys.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('station_place_quality_cache')
    .select('cache_key,radius,food_count,cafe_count,drink_count')
    .in('cache_key', uniqueCacheKeys)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('place quality cache select error:', error.message);
    return new Map();
  }

  return new Map(
    (
      (data ?? []) as Array<{
        cache_key: string;
        radius: number;
        food_count: number;
        cafe_count: number;
        drink_count: number;
      }>
    ).map(row => [
      row.cache_key,
      {
        cache_key: row.cache_key,
        radius: row.radius,
        foodCount: row.food_count,
        cafeCount: row.cafe_count,
        drinkCount: row.drink_count,
      },
    ]),
  );
}

async function upsertPlaceQualityCache(
  supabase: SupabaseClient,
  rows: PlaceQualityCacheUpsert[],
) {
  const { error } = await supabase.from('station_place_quality_cache').upsert(
    rows.map(row => ({
      cache_key: row.cache_key,
      station_name: row.station_name,
      location_x: row.location_x,
      location_y: row.location_y,
      radius: row.radius,
      food_count: row.foodCount,
      cafe_count: row.cafeCount,
      drink_count: row.drinkCount,
      expires_at: row.expires_at,
      updated_at: row.updated_at,
    })),
    { onConflict: 'cache_key' },
  );

  if (error) {
    console.error('place quality cache upsert error:', error.message);
  }
}

async function fetchStationPlaceCounts(
  station: PopularMeetingLocation,
  kakaoRestApiKey: string,
): Promise<PlaceQualityCacheUpsert | null> {
  const countEntries = await Promise.all(
    (['food', 'cafe', 'drink'] as const).map(async category => {
      try {
        return [
          category,
          await fetchKakaoPlaceCount(station, category, kakaoRestApiKey),
        ] as const;
      } catch (error) {
        console.error(
          `place quality ${category} error (${station.name}):`,
          error,
        );
        return [category, 0] as const;
      }
    }),
  );
  const countMap = new Map(countEntries);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PLACE_QUALITY_CACHE_TTL_DAYS);

  return {
    cache_key: buildPlaceQualityCacheKey(station),
    station_name: station.name,
    location_x: Number(station.location_x),
    location_y: Number(station.location_y),
    radius: PLACE_QUALITY_RADIUS_METERS,
    foodCount: countMap.get('food') ?? 0,
    cafeCount: countMap.get('cafe') ?? 0,
    drinkCount: countMap.get('drink') ?? 0,
    expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
  };
}

async function fetchKakaoPlaceCount(
  station: PopularMeetingLocation,
  category: PlaceCategory,
  kakaoRestApiKey: string,
): Promise<number> {
  const config = PLACE_CATEGORY_CONFIG[category];
  const params = new URLSearchParams({
    x: String(station.location_x),
    y: String(station.location_y),
    radius: String(PLACE_QUALITY_RADIUS_METERS),
    page: '1',
    size: '1',
    sort: 'accuracy',
    category_group_code: config.categoryGroupCode,
    query: config.query,
  });
  const data = await fetchJson<KakaoPlaceCountResponse>(
    `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${kakaoRestApiKey}`,
      },
      errorMessage: '카카오 장소 밀도 조회 실패',
    },
  );

  return data.meta?.pageable_count ?? data.meta?.total_count ?? 0;
}

function getWeightedPlaceQualityScore(
  counts: PlaceCountByCategory | undefined,
  meetingPurpose?: MeetingPurpose,
): number {
  if (!counts) {
    return 0;
  }

  const weights = PLACE_QUALITY_WEIGHTS[meetingPurpose ?? 'default'];

  return (
    Math.log1p(counts.foodCount) * weights.food +
    Math.log1p(counts.cafeCount) * weights.cafe +
    Math.log1p(counts.drinkCount) * weights.drink
  );
}

function withPlaceQuality(
  station: PopularMeetingLocation,
  counts: PlaceCountByCategory = {
    foodCount: 0,
    cafeCount: 0,
    drinkCount: 0,
  },
  score = 0,
): PopularMeetingLocation {
  return {
    ...station,
    place_quality: {
      radius: PLACE_QUALITY_RADIUS_METERS,
      foodCount: counts.foodCount,
      cafeCount: counts.cafeCount,
      drinkCount: counts.drinkCount,
      score,
    },
  };
}

function buildPlaceQualityCacheKey(station: PopularMeetingLocation): string {
  return [
    PLACE_QUALITY_KEY_VERSION,
    PLACE_QUALITY_RADIUS_METERS,
    normalizeCoordinate(station.location_x),
    normalizeCoordinate(station.location_y),
  ].join(':');
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrencyLimit: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrencyLimit, items.length) }, () =>
      worker(),
    ),
  );

  return results;
}

function normalizeCoordinate(value: number | string): string {
  return Number(value).toFixed(5);
}
