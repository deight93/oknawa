'use client';

import { useId } from 'react';
import styled from 'styled-components';
import {
  isTravelMode,
  TRAVEL_MODE_OPTIONS,
  TravelMode,
} from '@/types/recommendationOptions';

interface Props {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  label?: string;
}

export default function TravelModeSelector({
  value,
  onChange,
  label = '이동수단',
}: Props) {
  const id = useId();
  return (
    <Field>
      <label htmlFor={id}>{label}</label>
      <Select
        id={id}
        value={value}
        onChange={event => {
          if (isTravelMode(event.target.value)) onChange(event.target.value);
        }}
      >
        {TRAVEL_MODE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const Field = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 13px;
`;

const Select = styled.select`
  min-height: 40px;
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--surface-muted);
  font-size: 16px;
`;
