'use client';

import { useId } from 'react';
import {
  Car,
  Check,
  ChevronDown,
  PersonStanding,
  TrainFront,
} from 'lucide-react';
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
  variant?: 'cards' | 'compact';
}

const modeIcons = {
  transit: TrainFront,
  car: Car,
  walk: PersonStanding,
} satisfies Record<TravelMode, typeof Car>;

export default function TravelModeSelector({
  value,
  onChange,
  label = '이동수단',
  variant = 'cards',
}: Props) {
  const id = useId();

  if (variant === 'compact') {
    return (
      <SelectWrapper>
        <Select
          aria-label={label}
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
        <ChevronDown size={16} aria-hidden="true" />
      </SelectWrapper>
    );
  }

  return (
    <Field>
      <legend>{label}</legend>
      <Choices>
        {TRAVEL_MODE_OPTIONS.map(option => {
          const Icon = modeIcons[option.value];
          return (
            <Choice key={option.value}>
              <Radio
                type="radio"
                name={id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <ChoiceContent>
                <SelectedMark aria-hidden="true">
                  <Check size={12} />
                </SelectedMark>
                <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
                <span>{option.label}</span>
              </ChoiceContent>
            </Choice>
          );
        })}
      </Choices>
    </Field>
  );
}

const Field = styled.fieldset`
  min-width: 0;
  border: 0;
  legend {
    margin-bottom: 10px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
  }
`;

const Choices = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
`;

const Choice = styled.label`
  position: relative;
  cursor: pointer;
`;

const SelectedMark = styled.span`
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: var(--button-text-on-primary);
  background: var(--primary);
  visibility: hidden;
`;

const ChoiceContent = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 88px;
  padding: 14px 4px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
  @media (max-width: 480px) and (max-height: 640px) {
    min-height: 80px;
    padding-block: 10px;
  }
`;

const Radio = styled.input`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;

  &:checked + ${ChoiceContent} {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 1px var(--primary);
    background: var(--primary-soft);
  }
  &:checked + ${ChoiceContent} ${SelectedMark} {
    visibility: visible;
  }
  &:focus-visible + ${ChoiceContent} {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 4px;
  }
  &:hover + ${ChoiceContent} {
    border-color: var(--primary);
  }
`;

const SelectWrapper = styled.div`
  position: relative;
  width: 112px;
  flex-shrink: 0;

  > svg {
    position: absolute;
    top: 50%;
    right: 9px;
    transform: translateY(-50%);
    pointer-events: none;
  }

  @media (max-width: 359px) {
    width: 104px;
  }
`;

const Select = styled.select`
  appearance: none;
  width: 100%;
  min-height: 44px;
  padding: 8px 27px 8px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  color: var(--text-primary);
  background: var(--surface-muted);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }

  @media (max-width: 359px) {
    padding-left: 7px;
  }
`;
