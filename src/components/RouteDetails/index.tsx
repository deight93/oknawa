'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type { TransferSelection } from '@/hooks/result/useRouteInteraction';
import type { ItineraryItem, Participant, RouteStep } from '@/types/location';
import {
  getRouteTransfers,
  getTransitLabel,
  isRoutePoint,
} from '@/utils/routeSteps';
import { Disclosure } from './style';

interface Props {
  participants: Participant[];
  itinerary: (ItineraryItem | null)[];
  selectedParticipantIndex: number;
  onSelectParticipant: (index: number) => void;
  selectedTransfer?: TransferSelection | null;
  onSelectTransfer?: (stepIndex: number) => void;
}

function readableText(value: unknown) {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function formatDuration(seconds: unknown) {
  if (!isNonnegativeNumber(seconds)) return undefined;
  if (seconds > 0 && seconds < 60) return '1분 미만';
  return `${Math.ceil(seconds / 60)}분`;
}

function formatDistance(meters: unknown) {
  if (!isNonnegativeNumber(meters)) return undefined;
  const distance = meters < 1000 ? meters : meters / 1000;
  return `${distance.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}${meters < 1000 ? 'm' : 'km'}`;
}

function StepDetails({
  step,
  transferNumber,
  selected,
  onSelect,
}: {
  step: RouteStep;
  transferNumber?: number;
  selected: boolean;
  onSelect?: () => void;
}) {
  const transit = step.mode === 'transit' ? step.transit : undefined;
  const lineName = readableText(transit?.lineName);
  const direction = readableText(transit?.headsign);
  const departureName = readableText(transit?.departureStop?.name);
  const arrivalName = readableText(transit?.arrivalStop?.name);
  const stopCount = transit?.stopCount;
  const metrics = [
    formatDuration(step.durationSeconds),
    formatDistance(step.distanceMeters),
    isNonnegativeNumber(stopCount) && Number.isInteger(stopCount)
      ? `${stopCount}개 정류장`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  let title: string;
  switch (step.mode) {
    case 'walk':
      title = '도보';
      break;
    case 'car':
      title = '자동차';
      break;
    case 'transit':
      title = `${transferNumber === undefined ? '승차' : `환승 ${transferNumber}`} · ${getTransitLabel(transit?.vehicleType)}${lineName ? ` ${lineName}` : ''}`;
      break;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }

  return (
    <li data-selected={selected || undefined}>
      <h3>
        {onSelect ? (
          <button
            type="button"
            aria-label={`${title} · ${departureName ?? '승차 지점'} 지도에서 보기`}
            aria-pressed={selected}
            onClick={onSelect}
          >
            <span>{title}</span>
            <span className="route-map-label" aria-hidden="true">
              {selected ? '지도에서 보는 중' : '지도 보기'}
            </span>
          </button>
        ) : (
          title
        )}
      </h3>
      {step.mode === 'transit' && (
        <>
          <p>
            {departureName ? `${departureName} 승차` : '승차 정류장 정보 없음'}
            {' → '}
            {arrivalName ? `${arrivalName} 하차` : '하차 정류장 정보 없음'}
          </p>
          {direction && <p>{direction} 방면</p>}
        </>
      )}
      {metrics && <p>{metrics}</p>}
    </li>
  );
}

export default function RouteDetails({
  participants,
  itinerary,
  selectedParticipantIndex,
  onSelectParticipant,
  selectedTransfer,
  onSelectTransfer,
}: Props) {
  const selectId = useId();
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const route = itinerary[selectedParticipantIndex];
  const steps = route?.itinerary.steps;
  const hasSteps =
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every(
      step =>
        step &&
        (step.mode === 'walk' ||
          step.mode === 'transit' ||
          step.mode === 'car'),
    );
  const transfers = getRouteTransfers(hasSteps ? steps : []);
  const hasTransferCoordinates = transfers.some(transfer =>
    isRoutePoint(transfer.transit?.departureStop?.location),
  );
  const selectedStepIndex = transfers.find(
    transfer =>
      transfer.stepIndex === selectedTransfer?.stepIndex &&
      isRoutePoint(transfer.transit?.departureStop?.location),
  )?.stepIndex;

  useEffect(() => {
    if (selectedStepIndex !== undefined) setOpen(true);
  }, [selectedTransfer, selectedStepIndex]);

  useEffect(() => {
    if (
      !open ||
      selectedStepIndex === undefined ||
      selectedTransfer?.source !== 'map'
    )
      return;
    disclosureRef.current?.querySelector('[data-selected]')?.scrollIntoView({
      block: 'nearest',
      behavior: 'instant',
    });
    disclosureRef.current
      ?.querySelector<HTMLButtonElement>('[data-selected] button')
      ?.focus({ preventScroll: true });
  }, [open, selectedTransfer, selectedStepIndex]);

  if (participants.length === 0) return null;

  return (
    <Disclosure
      ref={disclosureRef}
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary>이동 구간·환승 안내</summary>
      <div className="route-details-body">
        <label htmlFor={selectId}>경로를 볼 참가자</label>
        <select
          id={selectId}
          value={selectedParticipantIndex}
          onChange={event => onSelectParticipant(Number(event.target.value))}
        >
          {participants.map((participant, index) => (
            <option key={index} value={index}>
              {index + 1}번 {participant.name}
            </option>
          ))}
        </select>
        {!route ? (
          <p>
            이 참가자의 경로를 불러올 수 없어요. 새로 검색하거나 카카오맵
            길찾기를 확인해주세요.
          </p>
        ) : !hasSteps ? (
          <p>
            이 경로에는 구간 정보가 없어요. 새로 검색하거나 카카오맵 길찾기를
            확인해주세요.
          </p>
        ) : (
          <>
            <ol aria-label="이동 구간">
              {steps.map((step, stepIndex) => (
                <StepDetails
                  key={stepIndex}
                  step={step}
                  selected={selectedStepIndex === stepIndex}
                  onSelect={
                    onSelectTransfer &&
                    transfers.some(
                      transfer =>
                        transfer.stepIndex === stepIndex &&
                        isRoutePoint(transfer.transit?.departureStop?.location),
                    )
                      ? () => onSelectTransfer(stepIndex)
                      : undefined
                  }
                  transferNumber={
                    transfers.find(transfer => transfer.stepIndex === stepIndex)
                      ?.number
                  }
                />
              ))}
            </ol>
            <div className="route-details-notes">
              <p>
                이동 시간과 경로는 상황에 따라 달라질 수 있어요. 전체 이동
                시간에는 대기 시간이 포함될 수 있어요.
              </p>
              <p>지도에서 도보는 점선, 대중교통·자동차는 실선으로 표시돼요.</p>
              {hasTransferCoordinates && (
                <p>
                  좌표가 있는 환승 지점만 선택한 참가자의 지도에 번호로
                  표시돼요.
                  {onSelectTransfer &&
                    ' 환승 번호를 누르면 지도와 상세 안내가 함께 선택돼요.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Disclosure>
  );
}
