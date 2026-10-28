import { MouseEventHandler, ReactNode } from 'react';
import styled from 'styled-components';

export default function Place({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <PlaceContainer>
      <PlaceButton type="button" onClick={onClick}>
        {children}
      </PlaceButton>
    </PlaceContainer>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <TitleContainer>{children}</TitleContainer>;
}

function SubTitle({ children }: { children: ReactNode }) {
  return <SubTitleContainer>{children}</SubTitleContainer>;
}

Place.Title = Title;
Place.SubTitle = SubTitle;

const PlaceContainer = styled.li`
  border-bottom: 1px solid var(--border);
  &:last-child {
    border-bottom: 0;
  }
`;

const PlaceButton = styled.button`
  display: flex;
  width: 100%;
  gap: 18px;
  align-items: center;
  min-height: 80px;
  padding: 18px 0;
  text-align: left;
  border-radius: 4px;
  svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }
  &:hover {
    background: var(--surface);
  }
`;

const TitleContainer = styled.span`
  display: block;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  color: var(--text-primary);
`;

const SubTitleContainer = styled.span`
  display: block;
  margin-top: 3px;
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
`;
