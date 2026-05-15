import { ReactNode } from 'react';
import styled from 'styled-components';

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
  /* padding: 14px 0; */
  padding: 16px;
  height: 44px;

  border-radius: 8px;
  color: ${({ disabled }) =>
    disabled ? 'var(--text-muted)' : 'var(--button-text-on-primary)'};
  background-color: var(--primary);
  cursor: pointer;

  &:hover {
    background-color: ${({ disabled }) =>
      disabled ? 'initial' : 'var(--primary-hover)'};
  }
`;

const Text = styled.h1`
  font-weight: 500;
`;
