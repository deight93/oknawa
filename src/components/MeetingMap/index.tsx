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
import { waitForKakaoMaps } from '@/utils/kakaoMapsReady';
import toast from 'react-hot-toast';

interface MeetingMapProps {
  stationName: string;
  endX: unknown;
  endY: unknown;
  focusMode?: 'destination' | 'overview';
  participants?: Participant[];
  // Each slot belongs to the participant at the same index, even without a route.
  itinerary?: (ItineraryItem | null)[];
}

interface MapPoint {
  lat: number;
  lng: number;
}

interface ParticipantMarker extends Participant {
  point: MapPoint;
  participantIndex: number;
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
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(
    null,
  );

  const center = useMemo(() => toMapPoint(endY, endX), [endX, endY]);
  const validParticipants = useMemo(
    () =>
      participants
        .map((participant, participantIndex) => {
          const point = toMapPoint(participant.start_y, participant.start_x);
          return point ? { ...participant, point, participantIndex } : null;
        })
        .filter((participant): participant is ParticipantMarker =>
          Boolean(participant),
        ),
    [participants],
  );
  const polylines = useMemo(
    () =>
      itinerary.map(user =>
        toValidPolyline(user?.itinerary?.total_polyline ?? []),
      ),
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
    polylines.forEach(polyline => {
      polyline.forEach(point =>
        bounds.extend(new kakao.maps.LatLng(point.lat, point.lng)),
      );
    });

    return bounds;
  }, [center, map, validParticipants, polylines]);

  const handleMarkerClick = (marker: kakao.maps.Marker, index: number) => {
    if (!map) return;
    map.panTo(marker.getPosition());
    setSelectedParticipant(index);
  };

  useEffect(() => {
    if (!map || !center) return;

    if (focusMode === 'destination') {
      map.setLevel(6);
      map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
      return;
    }

    const bounds = getMapBounds();
    if (!bounds) return;

    map.setBounds(bounds);
  }, [center, focusMode, getMapBounds, map]);

  useEffect(() => {
    let active = true;
    void waitForKakaoMaps()
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch(() => {
        if (active)
          toast.error('지도를 불러오지 못했어요. 화면을 새로고침해주세요.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (!canRenderMap || !center) {
    return null;
  }

  return (
    <Map center={center} level={6} isPanto onCreate={setMap}>
      {validParticipants.map(user => (
        <MapMarker
          key={user.participantIndex}
          position={user.point}
          image={{
            src: `/images/marker${user.participantIndex % 10}.svg`,
            size: { width: 30, height: 39 },
          }}
          onClick={marker => handleMarkerClick(marker, user.participantIndex)}
        />
      ))}
      <CustomOverlayMap position={center}>
        <CenterMarker>{stationName}</CenterMarker>
      </CustomOverlayMap>
      {polylines.map(
        (polyline, index) =>
          polyline.length > 0 && (
            <Polyline
              key={index}
              path={polyline}
              strokeWeight={selectedParticipant === index ? 7 : 6}
              strokeOpacity={1}
              strokeColor={getStrokeColor(index)}
              zIndex={selectedParticipant === index ? 1 : 0}
            />
          ),
      )}
    </Map>
  );
}

const Map = styled(KakaoMap)`
  width: 100%;
  height: 100%;
`;
