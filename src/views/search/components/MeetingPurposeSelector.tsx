'use client';

import styled from 'styled-components';

import {
  MEETING_PURPOSE_OPTIONS,
  MeetingPurpose,
} from '@/types/meetingPurpose';

interface MeetingPurposeSelectorProps {
  value?: MeetingPurpose;
  onChange: (value?: MeetingPurpose) => void;
}

export default function MeetingPurposeSelector({
  value,
  onChange,
}: MeetingPurposeSelectorProps) {
  return (
    <Container>
      <Header>
        <Title>약속 목적</Title>
        <Description>선택하지 않으면 기본 추천으로 계산해요.</Description>
      </Header>
      <OptionList>
        <OptionButton
          type="button"
          aria-pressed={!value}
          $isActive={!value}
          onClick={() => onChange(undefined)}
        >
          기본
        </OptionButton>
        {MEETING_PURPOSE_OPTIONS.map(option => (
          <OptionButton
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            $isActive={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </OptionButton>
        ))}
      </OptionList>
    </Container>
  );
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-raised);
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h2`
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
`;

const Description = styled.p`
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  font-size: 13px;
  line-height: 1.5;
`;

const OptionList = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  @media (max-width: 359px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const OptionButton = styled.button<{ $isActive: boolean }>`
  min-width: 0;
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
