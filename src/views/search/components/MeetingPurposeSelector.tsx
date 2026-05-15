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
          $isActive={!value}
          onClick={() => onChange(undefined)}
        >
          기본
        </OptionButton>
        {MEETING_PURPOSE_OPTIONS.map(option => (
          <OptionButton
            key={option.value}
            type="button"
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

const Title = styled.p`
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
`;

const Description = styled.p`
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
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
  border: 1px solid
    ${({ $isActive }) =>
      $isActive ? 'var(--primary)' : 'var(--border-strong)'};
  border-radius: 999px;
  background-color: ${({ $isActive }) =>
    $isActive ? 'var(--primary-soft)' : 'var(--surface-muted)'};
  color: ${({ $isActive }) =>
    $isActive ? 'var(--primary)' : 'var(--text-muted)'};
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
`;
