import type { Participant, StationInfo } from '@/types/location';
import type { MeetingDestination } from '@/types/meetingDestination';
import { isTravelMode } from '@/types/recommendationOptions';
import type {
  RecommendationOptions,
  TravelMode,
} from '@/types/recommendationOptions';

export interface KakaoDirections {
  webUrl: string;
  appUrl: string;
  travelMode: TravelMode;
}

const MODES = {
  transit: { web: 'traffic', app: 'publictransit' },
  car: { web: 'car', app: 'car' },
  walk: { web: 'walk', app: 'foot' },
} satisfies Record<TravelMode, { web: string; app: string }>;

const validCoordinates = (x: number, y: number) =>
  Number.isFinite(x) &&
  Number.isFinite(y) &&
  Math.abs(x) <= 180 &&
  Math.abs(y) <= 90;

export function buildKakaoDirections(
  origin: Participant,
  destination: MeetingDestination,
  travelMode: TravelMode,
): KakaoDirections | null {
  if (
    !validCoordinates(origin.start_x, origin.start_y) ||
    !validCoordinates(destination.x, destination.y)
  )
    return null;

  const mode = MODES[travelMode];
  const start = `${origin.start_y},${origin.start_x}`;
  const end = `${destination.y},${destination.x}`;
  const originName =
    origin.full_address?.trim() || origin.region_name || '출발지';
  return {
    travelMode,
    webUrl: `https://map.kakao.com/link/by/${mode.web}/${encodeURIComponent(originName)},${start}/${encodeURIComponent(destination.name)},${end}`,
    appUrl: `kakaomap://route?sp=${start}&ep=${end}&by=${mode.app}`,
  };
}

export function getParticipantDirections(
  station: StationInfo,
  index: number,
  groupMode: RecommendationOptions['travelMode'] | undefined = station
    .request_info?.recommendationOptions?.travelMode,
): KakaoDirections | null {
  const participants = station.request_info?.participant;
  const route = station.itinerary[index];
  const origin = participants?.[index];
  // The backend preserves participant order. Names are not unique, so never
  // match by name or guess an origin for incomplete legacy results.
  if (
    !route ||
    !origin ||
    participants.length !== station.itinerary.length ||
    !station.itinerary.every(
      (item, i) =>
        item.name === participants[i]?.name &&
        item.region_name === participants[i]?.region_name,
    )
  )
    return null;

  const travelMode =
    [route.travel_mode, origin.travel_mode, groupMode].find(isTravelMode) ??
    'transit';
  return buildKakaoDirections(
    origin,
    {
      name: station.station_name,
      address: station.address_name,
      x: station.end_x,
      y: station.end_y,
    },
    travelMode,
  );
}

export function getKakaoAppLaunchUrl(
  directions: KakaoDirections,
  device: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>,
): string | null {
  if (/Android/i.test(device.userAgent)) {
    return `${directions.appUrl.replace('kakaomap:', 'intent:')}#Intent;scheme=kakaomap;S.browser_fallback_url=${encodeURIComponent(directions.webUrl)};end`;
  }
  if (
    /iPhone|iPad|iPod/i.test(device.userAgent) ||
    (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1)
  ) {
    return directions.appUrl;
  }
  return null;
}
