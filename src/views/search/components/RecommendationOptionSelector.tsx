'use client';

import styled from 'styled-components';

import {
  MIDPOINT_BASIS_OPTIONS,
  RecommendationOptions,
} from '@/types/recommendationOptions';

interface RecommendationOptionSelectorProps {
  value: RecommendationOptions;
  onChange: (value: RecommendationOptions) => void;
}

export default function RecommendationOptionSelector({
  value,
  onChange,
}: RecommendationOptionSelectorProps) {
  return (
    <Container>
      <OptionGroup>
        <Title>중간 기준</Title>
        <OptionList>
          {MIDPOINT_BASIS_OPTIONS.map(option => (
            <OptionButton
              key={option.value}
              type="button"
              aria-pressed={value.midpointBasis === option.value}
              $isActive={value.midpointBasis === option.value}
              onClick={() =>
                onChange({ ...value, midpointBasis: option.value })
              }
            >
              {option.label}
            </OptionButton>
          ))}
        </OptionList>
      </OptionGroup>
    </Container>
  );
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-raised);
`;

const OptionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h2`
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
`;

const OptionList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const OptionButton = styled.button<{ $isActive: boolean }>`
  min-width: fit-content;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid
    ${({ $isActive }) =>
      $isActive ? 'var(--primary)' : 'var(--border-strong)'};
  border-radius: 999px;
  background-color: ${({ $isActive }) =>
    $isActive ? 'var(--primary-soft)' : 'var(--surface-muted)'};
  color: ${({ $isActive }) =>
    $isActive ? 'var(--primary)' : 'var(--text-secondary)'};
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    border-color: var(--primary);
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
  .light & {
    color: ${({ $isActive }) =>
      $isActive
        ? 'color-mix(in srgb, var(--primary) 40%, var(--text-primary))'
        : 'var(--text-secondary)'};
  }
`;
