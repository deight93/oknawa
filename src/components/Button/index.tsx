import { ReactNode } from 'react';
import styled, { css } from 'styled-components';

export const buttonFeedback = css`
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 100ms ease;

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }

  &:disabled {
    cursor: not-allowed;
    transform: none;
    transition: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    &:not(:disabled):active {
      transform: scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &,
    &:active,
    &[data-pressed='true'] {
      transform: none;
    }
  }
`;

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
  cursor: pointer;
  ${buttonFeedback}

  @media (hover: hover) and (pointer: fine) {
    &:not(:disabled):hover {
      background-color: var(--surface-raised);
      border-color: var(--text-muted);
    }
  }
`;

const Text = styled.span`
  font-weight: 500;
`;
