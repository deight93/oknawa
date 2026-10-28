import styled from 'styled-components';
import Link from 'next/link';
import { ReactNode } from 'react';

interface SearchTypeSelectorProps {
  type: 'individual' | 'together';
  icon: ReactNode;
}

export default function SearchTypeSelector({
  type,
  icon,
}: SearchTypeSelectorProps) {
  const titleText = type === 'individual' ? '직접' : '함께';
  const description =
    type === 'individual'
      ? '모든 구성원의\n출발지를 입력해요'
      : '각각 자신의\n출발지를 입력해요';

  return (
    <Container href={`/search/${type}`}>
      <AvatarBox aria-hidden="true">{icon}</AvatarBox>
      <Title>{`${titleText}\n입력하기`}</Title>
      <Description>{description}</Description>
    </Container>
  );
}

const Container = styled(Link)`
  display: block;
  min-width: 0;
  background-color: var(--surface-strong);
  color: var(--text-primary);
  padding: 16px 22px;
  border-radius: 9px;
  text-decoration: none;
  white-space: pre-line;
  word-break: keep-all;
  cursor: pointer;

  &:hover {
    background-color: var(--surface-muted);
  }

  &:focus-visible {
    outline: 2px solid var(--text-primary);
    outline-offset: 4px;
  }

  @media (max-width: 359px) {
    padding-inline: 14px;
  }
`;

const Title = styled.span`
  display: block;
  margin-bottom: 10px;
  font-size: 20px;
  font-weight: 600;
`;

const Description = styled.span`
  display: block;
  font-size: 15px;
  line-height: 20px;
  font-weight: 500;
  color: var(--text-secondary);
  color: color-mix(in srgb, var(--text-muted) 85%, var(--text-primary));
`;

const AvatarBox = styled.div`
  display: flex;
  justify-content: flex-end;
`;
