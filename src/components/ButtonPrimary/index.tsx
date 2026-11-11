import { ReactNode } from 'react';
import styled from 'styled-components';
import { buttonFeedback } from '../Button';

interface ButtonProps {
  label?: string;
  disabled?: boolean;
  $widthFull?: boolean;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

export default function ButtonPrimary({
  label = '버튼',
  disabled,
  $widthFull,
  children,
  type = 'button',
  onClick,
}: ButtonProps) {
  return (
    <Container
      disabled={disabled}
      type={type}
      onClick={onClick}
      $widthFull={$widthFull}
    >
      <Text>{label}</Text>
      {children && children}
    </Container>
  );
}

const Container = styled.button<{
  disabled: boolean | undefined;
  $widthFull?: boolean;
}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${({ $widthFull }) => ($widthFull ? '100%' : 'fit-content')};
  gap: 8px;
  padding: 16px;
  height: 44px;

  border-radius: 8px;
  color: ${({ disabled }) =>
    disabled ? 'var(--text-muted)' : 'var(--button-text-on-primary)'};
  background-color: ${({ disabled }) =>
    disabled ? 'var(--surface-strong)' : 'var(--primary)'};
  cursor: pointer;
  ${buttonFeedback}

  @media (hover: hover) and (pointer: fine) {
    &:not(:disabled):hover {
      background-color: var(--primary-hover);
    }
  }
`;

const Text = styled.span`
  font-weight: 500;
`;
