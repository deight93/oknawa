import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import type {
  KakaoKeywordDocument,
  PopularLocationType,
} from './location-types.ts';
import { normalizeStationName } from './normalize.ts';
import { responseJson } from './utils.ts';

interface SyncPopularLocationsOptions {
  supabase: SupabaseClient;
  type: PopularLocationType;
  sourceNames: string[];
  fetchLocationData: (sourceName: string) => Promise<KakaoKeywordDocument[]>;
  successMessage: string;
}

const TABLE_NAME = 'popular_meeting_location';

const toUpsertItem = (
  location: KakaoKeywordDocument,
  type: PopularLocationType,
  now: string,
) => ({
  name: location.place_name,
  type,
  url: location.place_url,
  address: location.road_address_name ?? '',
  location_x: Number(location.x),
  location_y: Number(location.y),
  created_at: now,
  updated_at: now,
  deleted_at: null,
});

type PopularLocationUpsertItem = ReturnType<typeof toUpsertItem>;

const uniqueByName = <T extends { name: string }>(items: T[]) =>
  Array.from(new Map(items.map(item => [item.name, item])).values());

export async function syncPopularMeetingLocations({
  supabase,
  type,
  sourceNames,
  fetchLocationData,
  successMessage,
}: SyncPopularLocationsOptions): Promise<Response> {
  const now = new Date().toISOString();

  if (sourceNames.length === 0) {
    return responseJson({ error: '동기화할 원본 장소 목록이 없습니다' }, 502);
  }

  const { data: existingList, error: existingListError } = await supabase
    .from(TABLE_NAME)
    .select('name, type')
    .is('deleted_at', null)
    .eq('type', type);

  if (existingListError) {
    console.error('DB 조회 실패:', existingListError);
    return responseJson({ msg: 'DB 조회 실패' }, 500);
  }

  const upsertItems: PopularLocationUpsertItem[] = [];

  for (const sourceName of sourceNames) {
    const locations = await fetchLocationData(sourceName);
    if (!locations.length) continue;

    upsertItems.push(toUpsertItem(locations[0], type, now));
  }

  const uniqueUpsertItems = uniqueByName(upsertItems);

  if (uniqueUpsertItems.length > 0) {
    const { error: upsertError } = await supabase
      .from(TABLE_NAME)
      .upsert(uniqueUpsertItems, { onConflict: 'name' });

    if (upsertError) {
      console.error('Upsert Error:', upsertError);
      return responseJson(
        { msg: 'DB upsert 실패', detail: upsertError.message },
        500,
      );
    }
  }

  const sourceNameSet = new Set(sourceNames);
  const existingNames = (existingList ?? []).map(item => item.name);
  const namesToDelete = existingNames.filter(
    name => !sourceNameSet.has(normalizeStationName(name)),
  );

  if (namesToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .update({ deleted_at: now })
      .eq('type', type)
      .in('name', namesToDelete)
      .is('deleted_at', null);

    if (deleteError) {
      console.error('Soft delete error:', deleteError);
    }
  }

  return responseJson({ msg: successMessage });
}
