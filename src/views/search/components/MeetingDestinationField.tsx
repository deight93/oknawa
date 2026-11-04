'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useSetAtom } from 'jotai';
import styled from 'styled-components';
import Address from '@/components/Address';
import { bottomSheetState } from '@/jotai/global/store';
import type { MeetingDestination } from '@/types/meetingDestination';
import { getApiErrorMessage } from '@/api/errors';

interface Props {
  destination: MeetingDestination;
  onChange?: (destination: MeetingDestination) => Promise<void> | void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export default function MeetingDestinationField({
  destination,
  onChange,
  disabled,
  onBusyChange,
}: Props) {
  const setSheet = useSetAtom(bottomSheetState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownsSheet = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (ownsSheet.current)
        setSheet(previous => ({ ...previous, isOpen: false, contents: null }));
    };
  }, [setSheet]);

  const edit = () => {
    if (!onChange || disabled || saving) return;
    ownsSheet.current = true;
    setSheet(previous => ({
      ...previous,
      isOpen: true,
      isFullContents: true,
      contents: (
        <Address
          label="모임 장소"
          onSelect={address => {
            if (!active.current) return;
            ownsSheet.current = false;
            setSaving(true);
            setError('');
            onBusyChange?.(true);
            Promise.resolve()
              .then(() =>
                onChange({
                  name: address.regionName,
                  address: address.fullAddress,
                  x: address.longitude,
                  y: address.latitude,
                }),
              )
              .catch(error => {
                if (active.current)
                  setError(
                    getApiErrorMessage(
                      error,
                      '장소를 변경하지 못했어요. 다시 시도해주세요.',
                    ),
                  );
              })
              .finally(() => {
                if (active.current) {
                  setSaving(false);
                  onBusyChange?.(false);
                }
              });
          }}
        />
      ),
    }));
  };
  return (
    <div>
      <Field aria-label="정해진 모임 장소" aria-busy={saving}>
        <MapPin size={22} aria-hidden="true" />
        <Place>
          <Label>모임 장소</Label>
          <strong>{destination.name}</strong>
          <AddressText>{destination.address}</AddressText>
        </Place>
        {onChange && (
          <Change
            type="button"
            onClick={edit}
            disabled={disabled || saving}
            aria-label="모임 장소 변경"
          >
            {saving ? '저장 중' : '변경'}
          </Change>
        )}
      </Field>
      {error && <ErrorText role="alert">{error}</ErrorText>}
    </div>
  );
}

const Field = styled.section`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
  padding: 16px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-muted);
  > svg {
    flex-shrink: 0;
    color: var(--primary);
  }
`;
const Place = styled.div`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  strong {
    display: block;
    font-size: 18px;
    line-height: 1.5;
  }
`;
const Label = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
`;
const AddressText = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 4px;
`;
const Change = styled.button`
  flex-shrink: 0;
  min-height: 44px;
  min-width: 44px;
  font-size: 14px;
  color: var(--text-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
`;
const ErrorText = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
`;
