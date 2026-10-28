import { CircleMinus, Crown, MapPin } from 'lucide-react';
import Avatar, { AVATAR_COLORS } from '@/components/Avatar';
import styled from 'styled-components';
import { TRAVEL_MODE_OPTIONS, TravelMode } from '@/types/recommendationOptions';
import TravelModeSelector from './TravelModeSelector';

interface PeopleCardProps {
  name: string;
  place: string;
  onDeleteIconClick?: () => void;
  index?: number;
  type?: 'individual' | 'together';
  travelMode?: TravelMode;
  onTravelModeChange?: (mode: TravelMode) => void;
}

export default function PeopleCard({
  name,
  place,
  onDeleteIconClick,
  index,
  type = 'individual',
  travelMode,
  onTravelModeChange,
}: PeopleCardProps) {
  const avatarColor = AVATAR_COLORS[index ?? 0] ?? 'var(--primary)';

  return (
    <Container>
      <Wrapper>
        <Avatar name={name} color={avatarColor} size="lg" />
        <Details>
          <Name title={name}>
            {type === 'together' && index === 0 && (
              <Crown size={16} color="var(--primary)" aria-label="방장" />
            )}
            {name}
          </Name>
          <Place title={place}>
            <MapPin size={14} aria-hidden="true" />
            <span>{place}</span>
          </Place>
        </Details>
      </Wrapper>
      <Actions>
        {onTravelModeChange ? (
          <TravelModeSelector
            value={travelMode ?? 'transit'}
            onChange={onTravelModeChange}
            label={`${name} 이동수단`}
            variant="compact"
          />
        ) : (
          travelMode && (
            <ModeText>
              {
                TRAVEL_MODE_OPTIONS.find(option => option.value === travelMode)
                  ?.label
              }
            </ModeText>
          )
        )}
        {onDeleteIconClick && (
          <RemoveButton
            type="button"
            aria-label={`${name} 출발지 삭제`}
            onClick={onDeleteIconClick}
          >
            <CircleMinus size={24} strokeWidth={1.6} aria-hidden="true" />
          </RemoveButton>
        )}
      </Actions>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background-color: var(--surface-raised);
  width: 100%;
  min-height: 82px;
  padding: 14px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
`;

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  > :first-child {
    flex-shrink: 0;
  }

  @media (max-width: 359px) {
    gap: 8px;
    > :first-child {
      width: 36px;
      height: 36px;
    }
  }
`;

const Details = styled.div`
  min-width: 0;
`;

const Name = styled.p`
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 16px;
  overflow-wrap: anywhere;
`;

const Place = styled.p`
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  font-size: 14px;
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  svg {
    flex-shrink: 0;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 359px) {
    svg {
      display: none;
    }
    span {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
`;

const ModeText = styled.span`
  color: var(--text-secondary);
  font-size: 14px;
`;

const RemoveButton = styled.button`
  display: grid;
  place-items: center;
  width: 36px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  &:hover {
    color: var(--text-primary);
    background: var(--surface-muted);
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
  }
`;
