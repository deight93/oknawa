import { ReactNode } from 'react';
import styled from 'styled-components';

interface ButtonProps {
  label?: string;
  'aria-pressed'?: boolean;
  disabled?: boolean;
  $widthFull?: boolean;
  size?: 'small' | 'medium' | 'large';
  type?: 'button' | 'submit' | 'reset';
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Button({
  label = '버튼',
  disabled,
  $widthFull,
  children,
  size = 'medium',
  type = 'button',
  onClick,
  className,
  'aria-pressed': ariaPressed,
}: ButtonProps) {
  return (
    <Container
      aria-pressed={ariaPressed}
      disabled={disabled}
      type={type}
      onClick={onClick}
      className={className}
      $widthFull={$widthFull}
      size={size}
    >
      {children && children}
      <Text>{label}</Text>
    </Container>
  );
}

const Container = styled.button<{
  disabled: boolean | undefined;
  $widthFull?: boolean;
  size: 'small' | 'medium' | 'large';
}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${({ $widthFull }) => ($widthFull ? '100%' : 'fit-content')};
  height: ${({ size }) => {
    switch (size) {
      case 'small':
        return '32px';
      case 'medium':
        return '44px';
      case 'large':
        return '56px';
      default:
        return '44px';
    }
  }};
  gap: 8px;
  padding: 16px 12px 16px 16px;
  border: ${({ disabled }) =>
    disabled
      ? '1px solid var(--text-muted)'
      : '1px solid var(--border-strong)'};
  border-radius: 8px;
  color: ${({ disabled }) =>
    disabled ? 'var(--text-muted)' : 'var(--text-primary)'};
`;

const Text = styled.span`
  font-weight: 500;
`;
