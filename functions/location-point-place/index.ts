import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getEnv } from "../lib/env.ts";
import { responseJson } from "../lib/utils.ts";
import { corsHeaders } from "../lib/cors.ts";

const KAKAO_REST_API_KEY = getEnv("KAKAO_REST_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return responseJson("ok");
  }

  if (req.method !== "GET") {
    return responseJson({ error: "Method Not Allowed" }, 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  let category = pathParts[pathParts.length - 1];

  if (category === "location-point-place") {
    category = "food";
  } else if (!["food", "cafe", "drink"].includes(category)) {
    return responseJson({ error: "Invalid category" }, 400);
  }

  // 쿼리스트링 파라미터 파싱
  const x = url.searchParams.get("x");
  const y = url.searchParams.get("y");
  const radius = url.searchParams.get("radius") ?? "500";
  const page = url.searchParams.get("page") ?? "1";
  const size = url.searchParams.get("size") ?? "5";
  const sort = url.searchParams.get("sort") ?? "accuracy";

  if (!x || !y) {
    return responseJson({ error: "x, y 필수" }, 400);
  }

  // 카카오 API 파라미터 세팅
  let category_group_code = "";
  let query = "";
  if (category === "food") {
    category_group_code = "FD6";
    query = "음식점";
  } else if (category === "drink") {
    category_group_code = "FD6";
    query = "술집";
  } else if (category === "cafe") {
    category_group_code = "CE7";
    query = "카페";
  }

  const kakaoUrl = "https://dapi.kakao.com/v2/local/search/keyword.json";
  const kakaoParams = new URLSearchParams({
    x,
    y,
    radius,
    page,
    size,
    sort,
    category_group_code,
    query,
  });

  const kakaoHeaders = {
    Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
  };

  // 1. 키워드 검색 (카카오)
  const kakaoRes = await fetch(`${kakaoUrl}?${kakaoParams.toString()}`, {
    method: "GET",
    headers: kakaoHeaders,
  });
  if (!kakaoRes.ok) {
    return responseJson({ error: "카카오 API 에러" }, 500);
  }

  const kakaoData = await kakaoRes.json();
  const documents = kakaoData.documents ?? [];
  const meta = kakaoData.meta ?? {};

  // 2. 각 장소의 상세정보(사진/오픈시간) 병렬조회
  const details = await Promise.all(
      documents.map(async (doc: any) => {
        const place_url = doc.place_url;
        if (!place_url) return doc;
        const place_url_id = place_url.split("/").pop();
        if (!place_url_id) return doc;
        const detail_url = place_url.replace(
            place_url_id,
            `main/v/${place_url_id}`,
        );
        try {
          const detailRes = await fetch(detail_url);
          if (!detailRes.ok) return doc;
          const detailJson = await detailRes.json();
          const basicInfo = detailJson?.basicInfo ?? {};
          return {
            ...doc,
            main_photo_url: basicInfo.mainphotourl ?? null,
            open_hour: basicInfo.openHour ?? null,
          };
        } catch {
          return doc;
        }
      }),
  );

  // 3. 응답
  return responseJson({
    documents: details,
    meta,
  }, 200);
});
