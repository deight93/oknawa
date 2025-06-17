// location-types.ts

// Hotplace 정보
export interface Hotplace {
    addressName: string;           // 주소 이름
    categoryGroupCode: string;
    categoryGroupName: string;
    categoryName: string;
    distance: string;
    id: string;
    phone: string;
    placeName: string;             // 장소 이름
    placeUrl: string;              // 장소 URL
    roadAddressName: string;
    x: string;
    y: string;
    mainPhotoUrl?: string;         // 이미지 URL (nullable)
    openHour?: Record<string, any>;// 운영 시간 (nullable, 객체)
}

// Kakao 등에서 넘어오는 메타 정보
export interface Meta {
    isEnd: boolean;
    pageableCount: number;
    totalCount: number;
}

// 참여자 정보
export interface Participant {
    name: string;
    regionName: string;
    startX: number;
    startY: number;
}

// 요청 - 추천받기(중간지점 계산) 참여자 목록
export interface PostLocationPointRequest {
    participant: Participant[];
}

// 역/장소 한 개의 추천 결과 정보
export interface PostLocationPoint {
    stationName: string;
    addressName: string;
    endX: number;
    endY: number;
    shareKey: string;
    vote: number;
    itinerary: any[]; // 외부 MAP API 데이터, 상세 타입 필요시 수정
    requestInfo: PostLocationPointRequest;
}

// 여러 지점 추천 결과의 응답 (map_id 기준)
export interface PostLocationPointsResponse {
    mapId: string;
    mapHostId: string;
}

// GET /location/points (투표 현황 등 포함)
export interface GetLocationPointsResponse {
    mapId: string;
    stationInfo: PostLocationPoint[];
    requestInfo: PostLocationPointRequest;
    confirmed?: string; // 확정된 중간지점역 share_key (nullable)
}

// 투표 요청
export interface LocationPointsVoteRequest {
    vote: string;
    userId: string;
}

// 투표/확정 응답 공통
export interface MsgResponse {
    msg: string;
}

// 인기장소 POST/GET 응답
export interface PopularMeetingLocationResponse {
    msg: string;
}

// GetPointPlace (핫플레이스/역 검색 결과)
export interface GetPointPlaceResponse {
    documents: Hotplace[];
    meta: Meta;
}

// 함께 참여자 정보
export interface TogetherParticipant {
    name: string;
    regionName: string;
    startX: number;
    startY: number;
}

// GET /location/together 응답
export interface GetTogetherLocationResponse {
    roomId: string;
    participant: TogetherParticipant[];
}

// 함께 입력방 호스트 등록 요청
export interface PostTogetherHostRequest {
    roomId: string;
    roomHostId: string;
}

// 함께 입력방 클라이언트 등록 응답
export interface PostTogetherClientResponse {
    msg: string;
}

// PUT /location/together/host 응답
export interface PutTogetherHostResponse {
    msg: string;
}

// supabase/functions/lib/response.ts
export interface Success<T> {
    code: number;          // 0
    msg:  string;          // "success"
    data: T;
}
export interface Fail {
    code: number;          // 4xx, 5xx
    msg:  string;
}

export function json<T>(payload: Success<T> | Fail, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
