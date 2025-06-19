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

  const x = url.searchParams.get("x");
  const y = url.searchParams.get("y");
  const radius = url.searchParams.get("radius") ?? "500";
  const page = url.searchParams.get("page") ?? "1";
  const size = url.searchParams.get("size") ?? "5";
  const sort = url.searchParams.get("sort") ?? "accuracy";

  if (!x || !y) {
    return responseJson({ error: "x, y 필수" }, 400);
  }

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

  const details = await Promise.all(
      documents.map(async (doc: any) => {
        const placeUrl = doc.place_url;
        if (!placeUrl) return doc;
        const placeId = placeUrl.split("/").pop();
        if (!placeId) return doc;

        const apiUrl = `https://place-api.map.kakao.com/places/panel3/${placeId}`;

        try {
          const res = await fetch(apiUrl, {
            headers: {
              "Accept": "application/json, text/plain, */*",
              "Accept-Encoding": "gzip, deflate, br, zstd",
              "Referer": `https://place.map.kakao.com/${placeId}`,
              pf: "web",
            },
          });
          if (!res.ok) return doc;
          const data = await res.json();

          const mainPhoto =
              data.photos?.photos?.[0]?.url ??
              data.menu?.menus?.photos?.[0]?.url ?? null;

          const dayInfos =
              data.business_hours?.real_time_info?.day_business_hours_infos ?? [];

          return {
            ...doc,
            main_photo_url: mainPhoto,
            day_business_hours_infos: dayInfos,
          };
        } catch {
          return doc;
        }
      }),
  );

  return responseJson({
    documents: details,
    meta,
  }, 200);
});
