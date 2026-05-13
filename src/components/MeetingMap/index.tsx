'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  CustomOverlayMap,
  Map as KakaoMap,
  MapMarker,
  Polyline,
} from 'react-kakao-maps-sdk';

import { ItineraryItem, Participant, PolylinePoint } from '@/types/location';
import CenterMarker from './CenterMarker';

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAOMAP_APP_KEY;
const KAKAO_MAP_SCRIPT_ID = 'kakao-map-sdk';

interface MeetingMapProps {
  stationName: string;
  endX: unknown;
  endY: unknown;
  focusMode?: 'destination' | 'overview';
  participants?: Participant[];
  itinerary?: ItineraryItem[];
}

interface MapPoint {
  lat: number;
  lng: number;
}

interface ParticipantMarker extends Participant {
  point: MapPoint;
}

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

const toFiniteNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toMapPoint = (lat: unknown, lng: unknown): MapPoint | null => {
  const parsedLat = toFiniteNumber(lat);
  const parsedLng = toFiniteNumber(lng);

  if (parsedLat === null || parsedLng === null) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
};

const toValidPolyline = (polyline: PolylinePoint[] = []) =>
  polyline
    .map(path => toMapPoint(path.lat, path.lng))
    .filter((path): path is MapPoint => Boolean(path));

export default function MeetingMap({
  stationName,
  endX,
  endY,
  focusMode = 'destination',
  participants = [],
  itinerary = [],
}: MeetingMapProps) {
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState<kakao.maps.Map | undefined>(undefined);

  const center = useMemo(() => toMapPoint(endY, endX), [endX, endY]);
  const validParticipants = useMemo(
    () =>
      participants
        .map(participant => {
          const point = toMapPoint(participant.start_y, participant.start_x);
          return point ? { ...participant, point } : null;
        })
        .filter((participant): participant is ParticipantMarker =>
          Boolean(participant),
        ),
    [participants],
  );
  const polylines = useMemo(
    () =>
      itinerary
        .map(user => toValidPolyline(user.itinerary?.total_polyline ?? []))
        .filter(polyline => polyline.length > 0),
    [itinerary],
  );
  const canRenderMap = loaded && Boolean(center);

  const getMapBounds = useCallback(() => {
    if (!map || !center) return null;

    const bounds = new kakao.maps.LatLngBounds();

    validParticipants.forEach(user => {
      bounds.extend(new kakao.maps.LatLng(user.point.lat, user.point.lng));
    });

    bounds.extend(new kakao.maps.LatLng(center.lat, center.lng));

    return bounds;
  }, [center, map, validParticipants]);

  const handleMarkerClick = (marker: kakao.maps.Marker, index: number) => {
    if (!map) return;
    const polyline = polylines[index];
    if (!polyline) return;

    map.panTo(marker.getPosition());

    new kakao.maps.Polyline({
      map,
      path: polyline.map(path => new kakao.maps.LatLng(path.lat, path.lng)),
      strokeWeight: 7,
      strokeOpacity: 1,
      strokeColor: getStrokeColor(index),
    });
  };

  useEffect(() => {
    if (!map || !center) return;

    if (focusMode === 'destination') {
      map.setLevel(5);
      map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
      return;
    }

    const bounds = getMapBounds();
    if (!bounds) return;

    map.setBounds(bounds);
  }, [center, focusMode, getMapBounds, map]);

  useEffect(() => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => setLoaded(true));
      return;
    }

    const existingScript = document.getElementById(KAKAO_MAP_SCRIPT_ID);
    const handleLoad = () => window.kakao.maps.load(() => setLoaded(true));

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    const script = document.createElement('script');
    script.id = KAKAO_MAP_SCRIPT_ID;
    script.onload = handleLoad;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
    document.head.appendChild(script);
  }, []);

  if (!canRenderMap || !center) {
    return null;
  }

  return (
    <Map center={center} level={3} isPanto onCreate={setMap}>
      {validParticipants.map((user, index) => (
        <MapMarker
          key={`${user.name}-${index}`}
          position={user.point}
          image={{
            src: `/images/marker${index}.svg`,
            size: { width: 30, height: 39 },
          }}
          onClick={marker => handleMarkerClick(marker, index)}
        />
      ))}
      <CustomOverlayMap position={center}>
        <CenterMarker>{stationName}</CenterMarker>
      </CustomOverlayMap>
      {polylines.map((polyline, index) => (
        <Polyline
          key={index}
          path={polyline}
          strokeWeight={6}
          strokeOpacity={1}
          strokeColor={getStrokeColor(index)}
        />
      ))}
    </Map>
  );
}

const Map = styled(KakaoMap)`
  width: 100%;
  height: 100vh;
`;
