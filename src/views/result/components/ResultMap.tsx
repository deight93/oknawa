'use client';

import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  CustomOverlayMap,
  Map as KakaoMap,
  MapMarker,
  Polyline,
} from 'react-kakao-maps-sdk';

import CenterMarker from './CenterMarker';

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAOMAP_APP_KEY;

const getStrokeColor = (index: number) => {
  switch (index) {
    case 0:
      return '#2E7FFF';
    case 1:
      return '#8B5CCC';
    case 2:
      return '#FF46CB';
    case 3:
      return '#FF5D02';
    default:
      return '#2E7FFF';
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export default function ResultMap({
  station,
  stationName,
  itinerary,
  participants,
}: any) {
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState<kakao.maps.Map | undefined>(undefined);
  const destination = station?.station ?? station;
  const center = {
    lat: Number(destination?.end_y),
    lng: Number(destination?.end_x),
  };
  const validParticipants = (participants ?? []).filter(
    (user: any) =>
      Number.isFinite(Number(user.start_y)) &&
      Number.isFinite(Number(user.start_x)),
  );
  const polylines = (itinerary ?? [])
    .map((user: any) => user.itinerary?.total_polyline ?? [])
    .map((polyline: any[]) =>
      polyline.filter(
        path => Number.isFinite(Number(path.lat)) && Number.isFinite(Number(path.lng)),
      ),
    )
    .filter((polyline: any[]) => polyline.length > 0);
  const canRenderMap =
    loaded && isFiniteNumber(center.lat) && isFiniteNumber(center.lng);

  const getMapBounds = useCallback(() => {
    if (!map) return;

    const bounds = new kakao.maps.LatLngBounds();

    validParticipants.forEach((user: any) => {
      const { start_y, start_x } = user;
      const position = new kakao.maps.LatLng(start_y, start_x);
      bounds.extend(position);
    });

    bounds.extend(new kakao.maps.LatLng(center.lat, center.lng));

    return bounds;
  }, [center.lat, center.lng, validParticipants, map]);

  const handleMarkerClick = (marker: kakao.maps.Marker, index: number) => {
    if (!map) return;
    const polyline = polylines[index];
    if (!polyline) return;

    map.panTo(marker.getPosition());

    const strokeColor = getStrokeColor(index);
    new kakao.maps.Polyline({
      map: map,
      path: polyline.map((path: any) => {
        return new kakao.maps.LatLng(path.lat, path.lng);
      }),
      strokeWeight: 7,
      strokeOpacity: 1,
      strokeColor,
    });
  };

  useEffect(() => {
    if (!map) return;

    const bounds = getMapBounds();
    if (!bounds) return;

    map.setBounds(bounds);
  }, [map, station, getMapBounds]);

  useEffect(() => {
    const loadKakaoMapScript = () => {
      const script = document.createElement('script');
      script.onload = () => window.kakao.maps.load(() => setLoaded(true));
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
      document.head.appendChild(script);
    };

    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => setLoaded(true));
    } else {
      loadKakaoMapScript();
    }
  }, [station]);

  return (
    <>
      {canRenderMap && (
        <Map
          center={center}
          level={3}
          isPanto
          onCreate={setMap}
        >
          {validParticipants.map((user: any, index: number) => {
            return (
              <MapMarker
                key={index}
                position={{
                  lat: user.start_y,
                  lng: user.start_x,
                }}
                image={{
                  src: `/images/marker${index}.svg`,
                  size: { width: 30, height: 39 },
                }}
                onClick={marker => handleMarkerClick(marker, index)}
              />
            );
          })}
          <CustomOverlayMap position={center}>
            <CenterMarker>{stationName}</CenterMarker>
          </CustomOverlayMap>
          {polylines.map((polyline: any, index: number) => {
            return (
              <Polyline
                key={index}
                path={polyline}
                strokeWeight={6}
                strokeOpacity={1}
                strokeColor={getStrokeColor(index)}
              />
            );
          })}
        </Map>
      )}
    </>
  );
}

const Map = styled(KakaoMap)`
  width: 100%;
  height: 100vh;
`;
