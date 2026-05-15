import { MinusIcon } from '@/assets/icons/Minus';
import { Crown } from 'lucide-react';
import Avatar, { AVATAR_COLORS } from '@/components/Avatar';
import styled from 'styled-components';

interface PeopleCardProps {
  name: string;
  place: string;
  onDeleteIconClick?: () => void;
  index?: number;
  type?: 'individual' | 'together';
}

export default function PeopleCard({
  name,
  place,
  onDeleteIconClick,
  index,
  type = 'individual',
}: PeopleCardProps) {
  const avatarColor = AVATAR_COLORS[index ?? 0] ?? 'var(--primary)';

  return (
    <Container>
      <Wrapper>
        <Avatar name={name} color={avatarColor} size="lg" />
        <div>
          <Name>
            {type === 'together' && index === 0 && (
              <Crown color="var(--primary)" />
            )}
            {name}
          </Name>
          <Place>{place}</Place>
        </div>
      </Wrapper>
      {onDeleteIconClick && (
        <IconsBox>
          <Icon onClick={onDeleteIconClick}>
            <MinusIcon width="20" height="20" />
          </Icon>
        </IconsBox>
      )}
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  background-color: var(--surface-raised);
  width: 100%;
  padding: 17px;
  border-radius: 10px;
  border: 1px solid var(--border);
`;

const Wrapper = styled.div`
  display: flex;
  gap: 10px;
`;

const Name = styled.p`
  display: flex;
  gap: 4px;
  color: var(--text-primary);
  font-weight: 600;
`;

const Place = styled.p`
  font-size: 14px;
  color: var(--text-muted);
`;

const IconsBox = styled.div`
  display: flex;
  align-items: center;
  gap: 30px;
`;

const Icon = styled.div`
  cursor: pointer;
`;
