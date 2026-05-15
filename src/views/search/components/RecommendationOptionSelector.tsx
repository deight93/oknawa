'use client';

import styled from 'styled-components';

import {
  MIDPOINT_BASIS_OPTIONS,
  RecommendationOptions,
  TRAVEL_MODE_OPTIONS,
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
        <Title>이동 방식</Title>
        <OptionList>
          {TRAVEL_MODE_OPTIONS.map(option => (
            <OptionButton
              key={option.value}
              type="button"
              $isActive={value.travelMode === option.value}
              onClick={() =>
                onChange({ ...value, travelMode: option.value })
              }
            >
              {option.label}
            </OptionButton>
          ))}
        </OptionList>
      </OptionGroup>
      <OptionGroup>
        <Title>중간 기준</Title>
        <OptionList>
          {MIDPOINT_BASIS_OPTIONS.map(option => (
            <OptionButton
              key={option.value}
              type="button"
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
  border: 1px solid #28282d;
  border-radius: 12px;
  background-color: #1c1c20;
`;

const OptionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.p`
  color: #f4f4f5;
  font-size: 15px;
  font-weight: 800;
`;

const OptionList = styled.div`
  display: flex;
  gap: 6px;
  overflow-x: auto;
`;

const OptionButton = styled.button<{ $isActive: boolean }>`
  min-width: fit-content;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid ${({ $isActive }) => ($isActive ? '#18c964' : '#34343a')};
  border-radius: 999px;
  background-color: ${({ $isActive }) => ($isActive ? '#123925' : '#202024')};
  color: ${({ $isActive }) => ($isActive ? '#18c964' : '#bdbdbd')};
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
`;
