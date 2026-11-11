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
import { getRouteTransfers, isRoutePoint } from '@/utils/routeSteps';

interface MeetingMapProps {
  stationName: string;
  endX: unknown;
  endY: unknown;
  focusMode?: 'destination' | 'overview';
  participants?: Participant[];
  // Each slot belongs to the participant at the same index, even without a route.
  itinerary?: (ItineraryItem | null)[];
  selectedParticipantIndex?: number;
  onSelectParticipant?: (index: number) => void;
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

  if (
    parsedLat === null ||
    parsedLng === null ||
    Math.abs(parsedLat) > 90 ||
    Math.abs(parsedLng) > 180
  ) {
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
  selectedParticipantIndex,
  onSelectParticipant,
}: MeetingMapProps) {
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState<kakao.maps.Map | undefined>(undefined);
  const [localParticipant, setSelectedParticipant] = useState<number | null>(
    null,
  );
  const selectedParticipant = selectedParticipantIndex ?? localParticipant;
  const transfers = useMemo(() => {
    if (selectedParticipant === null) return [];
    return getRouteTransfers(
      itinerary[selectedParticipant]?.itinerary.steps,
    ).flatMap(transfer => {
      const point = transfer.transit?.departureStop?.location;
      return isRoutePoint(point) ? [{ ...transfer, point }] : [];
    });
  }, [itinerary, selectedParticipant]);

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
  const routeLines = useMemo(
    () =>
      itinerary.map((user, participantIndex) => {
        const segments = user?.itinerary?.segments;
        if (segments?.length) {
          const lines = segments.map(segment => ({
            mode: segment.mode,
            path: toValidPolyline(segment.polyline),
          }));
          if (
            lines.every(
              (line, index) =>
                ['walk', 'transit', 'car'].includes(line.mode) &&
                line.path.length >= 2 &&
                line.path.length === segments[index].polyline.length,
            )
          )
            return lines;
        }

        const path = toValidPolyline(user?.itinerary?.total_polyline ?? []);
        const mode =
          user?.travel_mode ??
          participants[participantIndex]?.travel_mode ??
          'transit';
        return path.length >= 2 ? [{ mode, path }] : [];
      }),
    [itinerary, participants],
  );
  const canRenderMap = loaded && Boolean(center);

  const getMapBounds = useCallback(() => {
    if (!map || !center) return null;

    const bounds = new kakao.maps.LatLngBounds();

    validParticipants.forEach(user => {
      bounds.extend(new kakao.maps.LatLng(user.point.lat, user.point.lng));
    });

    bounds.extend(new kakao.maps.LatLng(center.lat, center.lng));
    routeLines.forEach(lines =>
      lines.forEach(line =>
        line.path.forEach(point =>
          bounds.extend(new kakao.maps.LatLng(point.lat, point.lng)),
        ),
      ),
    );
    transfers.forEach(({ point }) =>
      bounds.extend(new kakao.maps.LatLng(point.lat, point.lng)),
    );

    return bounds;
  }, [center, map, validParticipants, routeLines, transfers]);

  const handleMarkerClick = (marker: kakao.maps.Marker, index: number) => {
    if (!map) return;
    map.panTo(marker.getPosition());
    setSelectedParticipant(index);
    onSelectParticipant?.(index);
  };

  const updateViewport = useCallback(() => {
    if (!map || !center) return;

    if (focusMode === 'destination' && selectedParticipantIndex === undefined) {
      map.setLevel(6);
      map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
      return;
    }

    const bounds = getMapBounds();
    if (!bounds) return;

    map.setBounds(bounds);
  }, [center, focusMode, getMapBounds, map, selectedParticipantIndex]);

  useEffect(updateViewport, [updateViewport]);

  useEffect(() => {
    if (!map || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      map.relayout();
      updateViewport();
    });
    observer.observe(map.getNode());
    return () => observer.disconnect();
  }, [map, updateViewport]);

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
      {routeLines.flatMap((lines, participantIndex) =>
        lines.map((line, segmentIndex) => (
          <Polyline
            key={`${participantIndex}-${segmentIndex}`}
            path={line.path}
            strokeStyle={line.mode === 'walk' ? 'shortdash' : 'solid'}
            strokeWeight={selectedParticipant === participantIndex ? 7 : 6}
            strokeOpacity={1}
            strokeColor={getStrokeColor(participantIndex)}
            zIndex={selectedParticipant === participantIndex ? 1 : 0}
          />
        )),
      )}
      {selectedParticipant !== null &&
        transfers.map(transfer => {
          const label = `${selectedParticipant + 1}번 ${participants[selectedParticipant]?.name ?? ''} 환승 ${transfer.number}: ${transfer.transit?.departureStop?.name ?? '승차 지점'} · ${transfer.transit?.lineName ?? '대중교통'}`;
          return (
            <CustomOverlayMap
              key={transfer.stepIndex}
              position={transfer.point}
              zIndex={2}
              yAnchor={1}
            >
              <TransferMarker
                data-route-transfer={transfer.number}
                role="img"
                aria-label={label}
                title={label}
                $color={getStrokeColor(selectedParticipant)}
              >
                환승 {transfer.number}
              </TransferMarker>
            </CustomOverlayMap>
          );
        })}
    </Map>
  );
}

const Map = styled(KakaoMap)`
  width: 100%;
  height: 100%;
`;

const TransferMarker = styled.span<{ $color: string }>`
  display: block;
  padding: 5px 8px;
  border: 3px solid ${({ $color }) => $color};
  border-radius: 16px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
`;
