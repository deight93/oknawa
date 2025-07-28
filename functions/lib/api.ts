import { getEnv } from "./env.ts";

const KAKAO_API_KEY = getEnv("KAKAO_REST_API_KEY")!;
const OPEN_DATA_API_URL = getEnv("OPEN_DATA_API_URL")!;

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
    const resp = await fetch(url);
    const data = await resp.json();
    const apiResponse = data.CardSubwayStatsNew.row as any[];
    const totalPassenger: Record<string, number> = {};

    for (const subway of apiResponse) {
        const subwayName: string = subway.SBWY_STNS_NM;
        const ride = Number(subway.GTON_TNOPE) || 0;
        const alight = Number(subway.GTOFF_TNOPE) || 0;
        if (!totalPassenger[subwayName]) totalPassenger[subwayName] = 0;
        totalPassenger[subwayName] += ride + alight;
    }

    const subwayList = Object.entries(totalPassenger)
        .map(([subway_name, total_passenger]) => ({ subway_name, total_passenger }))
        .sort((a, b) => b.total_passenger - a.total_passenger)
        .slice(0, 100);

    return subwayList.map(({ subway_name, total_passenger }) => {
        let name = subway_name.split("(")[0].trim();
        if (!name.endsWith("역")) name += "역";
        return name;
    });
}

export async function fetchStationData(subway_name: string) {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(subway_name)}`;
    const resp = await fetch(url, {
        headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    });
    const json = await resp.json();
    return (json.documents as any[]).filter(
        (doc) => doc.category_group_name === "지하철역"
    );
}