import { getEnv } from './env.ts';
import { fetchJson } from './utils.ts';

const KAKAO_API_KEY = getEnv('KAKAO_REST_API_KEY')!;
const OPEN_DATA_API_URL = getEnv('OPEN_DATA_API_URL')!;
const BUS_TERMINAL_DATA_API_URL = getEnv('BUS_TERMINAL_DATA_API_URL')!;

interface SubwayStatsRow {
  SBWY_STNS_NM?: string;
  GTON_TNOPE?: string | number;
  GTOFF_TNOPE?: string | number;
}

interface SubwayStatsResponse {
  CardSubwayStatsNew?: {
    row?: SubwayStatsRow[];
  };
}

interface KakaoKeywordDocument {
  place_name: string;
  place_url: string;
  road_address_name?: string;
  x: string;
  y: string;
  category_group_name?: string;
  category_name?: string;
}

interface KakaoKeywordResponse {
  documents?: KakaoKeywordDocument[];
}

interface TerminalItem {
  terminalNm?: string;
}

interface TerminalListResponse {
  response?: {
    body?: {
      items?: {
        item?: TerminalItem[] | TerminalItem;
      };
    };
  };
}

function getLastWeekSameDayString() {
  const today = new Date();
  today.setDate(today.getDate() - 7);
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export async function fetchPopularSubwayList(): Promise<string[]> {
  const targetDate = getLastWeekSameDayString();
  const url = `${OPEN_DATA_API_URL}/json/CardSubwayStatsNew/1/1000/${targetDate}`;
  const data = await fetchJson<SubwayStatsResponse>(url, {
    errorMessage: '서울 열린데이터 지하철 이용량 조회 실패',
  });
  const apiResponse = data.CardSubwayStatsNew?.row;

  if (!Array.isArray(apiResponse)) {
    throw new Error('서울 열린데이터 응답에 지하철 이용량 목록이 없습니다');
  }

  const totalPassenger: Record<string, number> = {};

  for (const subway of apiResponse) {
    const subwayName = subway.SBWY_STNS_NM?.trim();
    if (!subwayName) continue;

    const ride = Number(subway.GTON_TNOPE) || 0;
    const alight = Number(subway.GTOFF_TNOPE) || 0;
    if (!totalPassenger[subwayName]) totalPassenger[subwayName] = 0;
    totalPassenger[subwayName] += ride + alight;
  }

  const subwayList = Object.entries(totalPassenger)
    .map(([subway_name, total_passenger]) => ({ subway_name, total_passenger }))
    .sort((a, b) => b.total_passenger - a.total_passenger)
    .slice(0, 100);

  return subwayList.map(({ subway_name }) => {
    let name = subway_name.split('(')[0].trim();
    if (!name.endsWith('역')) name += '역';
    return name;
  });
}

export async function fetchStationData(
  subway_name: string,
): Promise<KakaoKeywordDocument[]> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(subway_name)}`;
  const json = await fetchJson<KakaoKeywordResponse>(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    errorMessage: '카카오 지하철역 검색 실패',
  });
  return (json.documents ?? []).filter(
    doc => doc.category_group_name === '지하철역',
  );
}

export async function fetchTerminalList(): Promise<string[]> {
  const url = `${BUS_TERMINAL_DATA_API_URL}`;
  const data = await fetchJson<TerminalListResponse>(url, {
    errorMessage: '고속버스 터미널 목록 조회 실패',
  });
  const apiItems = data.response?.body?.items?.item;
  const terminalItems = Array.isArray(apiItems)
    ? apiItems
    : apiItems
      ? [apiItems]
      : null;

  if (!terminalItems) {
    throw new Error('터미널 API 응답에 터미널 목록이 없습니다');
  }

  return terminalItems
    .map(item => item.terminalNm?.replace(/\(.*?\)/g, '').trim())
    .filter((terminalNm): terminalNm is string => Boolean(terminalNm))
    .map(terminalNm => `${terminalNm}고속버스터미널`);
}

export async function fetchTerminalData(
  terminal_name: string,
): Promise<KakaoKeywordDocument[]> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(terminal_name)}`;
  const json = await fetchJson<KakaoKeywordResponse>(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    errorMessage: '카카오 터미널 검색 실패',
  });
  return (json.documents ?? []).filter(doc =>
    doc.category_name?.includes('고속,시외버스터미널'),
  );
}
