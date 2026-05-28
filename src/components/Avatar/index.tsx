import styled from 'styled-components';

interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  color: AvatarColor;
}

type AvatarColor = '#2E7FFF' | '#8B5CCC' | '#FF46CB' | '#FF5D02' | string;

export const AVATAR_COLORS: AvatarColor[] = [
  '#2E7FFF',
  '#8B5CCC',
  '#FF46CB',
  '#FF5D02',
  '#FFA500',
  '#B1DB08',
  '#F01616',
  '#18C964',
  '#7B420E',
  '#00FFFF',
];

const generateContainerSize = (size: string) => {
  switch (size) {
    case 'sm':
      return '36px';
    case 'md':
      return '38px';
    case 'lg':
      return '42px';
    default:
      return '36px';
  }
};

const generateFontSize = (size: string, textLength: number) => {
  const isCompact = textLength > 1;

  switch (size) {
    case 'sm':
      return isCompact ? '12px' : '16px';
    case 'md':
      return isCompact ? '14px' : '16px';
    case 'lg':
      return isCompact ? '18px' : '24px';
    default:
      return isCompact ? '14px' : '16px';
  }
};

const getAvatarLabel = (name: string) =>
  Array.from(name.trim().replace(/\s+/g, '')).slice(0, 2).join('');

export default function Avatar({ name = '', size = 'sm', color }: AvatarProps) {
  const userName = getAvatarLabel(name);

  return (
    <Container $size={size} $color={color}>
      {userName && (
        <Name $size={size} $textLength={Array.from(userName).length}>
          {userName}
        </Name>
      )}
    </Container>
  );
}

const Container = styled.div<{ $size: string; $color: AvatarColor }>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${({ $size }) => generateContainerSize($size)};
  height: ${({ $size }) => generateContainerSize($size)};
  border-radius: 50%;
  background-color: ${({ $color }) => $color};
`;

const Name = styled.span<{ $size: string; $textLength: number }>`
  display: block;
  max-width: calc(100% - 8px);
  overflow: hidden;
  font-size: ${({ $size, $textLength }) =>
    generateFontSize($size, $textLength)};
  font-weight: 700;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  color: #ffffff;
`;
