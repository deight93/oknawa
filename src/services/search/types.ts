export interface SubmitDeparturePointRequestBody {
  room_id: string;
  name: string;
  region_name: string;
  full_address: string;
  start_x: number;
  start_y: number;
}

export interface MapIdType {
  mapId: string;
  mapHostId: string;
}
