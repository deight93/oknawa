'use client';

import { ArrowLeft, Home } from 'lucide-react';
import { ReactNode } from 'react';
import styled from 'styled-components';
import ThemeToggle from '@/components/ThemeToggle';

interface Props {
  onBack?: () => void;
  backLabel?: string;
  home?: boolean;
  children?: ReactNode;
  className?: string;
}

export default function PageHeader({
  onBack,
  backLabel = '홈으로 돌아가기',
  home = false,
  children,
  className,
}: Props) {
  const Icon = home ? Home : ArrowLeft;
  return (
    <Header className={className}>
      {onBack ? (
        <BackButton type="button" aria-label={backLabel} onClick={onBack}>
          <Icon size={20} aria-hidden="true" />
        </BackButton>
      ) : (
        <Brand>OKNAWA</Brand>
      )}
      <Actions>
        {children}
        <ThemeToggle />
      </Actions>
    </Header>
  );
}

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
  width: 100%;
  min-height: 44px;
`;

const BackButton = styled.button`
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  height: 44px;
  margin-left: -10px;
  border-radius: 10px;
  color: var(--text-secondary);
  &:hover {
    background: var(--surface-muted);
  }
`;

const Brand = styled.span`
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;
