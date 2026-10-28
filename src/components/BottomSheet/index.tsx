import { useAtom } from 'jotai';
import styled from 'styled-components';
import { useResetAtom } from 'jotai/utils';
import { useCallback, useEffect, useId, useRef } from 'react';

import { bottomSheetState } from '@/jotai/global/store';

import { CloseIcon } from '@/assets/icons/Close';
import { media } from '@/styles/commonStyles';
import ThemeToggle from '@/components/ThemeToggle';

export default function BottomSheet() {
  const [bottomSheet] = useAtom(bottomSheetState);
  const reset = useResetAtom(bottomSheetState);
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  const { isOpen, title, contents, height, isFullContents } = bottomSheet;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        reset();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? [],
      ).filter(
        element => element.getClientRects().length > 0 && element.tabIndex >= 0,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        sheetRef.current?.focus();
      } else if (!sheetRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === sheetRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [reset],
  );

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    const initialFocus = isFullContents
      ? sheetRef.current?.querySelector<HTMLElement>('input')
      : sheetRef.current?.querySelector<HTMLElement>('button');
    (initialFocus ?? sheetRef.current)?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen, isFullContents, handleKeyDown]);

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseBtnClick();
    }
  };

  const handleCloseBtnClick = () => {
    reset();
  };

  if (isOpen === false) return null;

  return (
    <Container onClick={handleOutsideClick}>
      <Wrapper
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : '주소 검색'}
        tabIndex={-1}
        $height={height}
        $isFullContents={isFullContents}
      >
        {isFullContents && <ThemeToggle />}
        <TitleBox>
          <Title id={titleId}>{title}</Title>
          {!isFullContents && (
            <CloseBtnBox
              type="button"
              aria-label="닫기"
              onClick={handleCloseBtnClick}
            >
              <CloseIcon color="currentColor" />
            </CloseBtnBox>
          )}
        </TitleBox>
        <Contents>{contents}</Contents>
      </Wrapper>
    </Container>
  );
}

const Container = styled.section`
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-color: var(--overlay-bg);
  /* Keep the sheet above the existing fixed theme toggle and map panels. */
  z-index: 100000001;
  animation: fadeIn_ani 0.3s both;

  @keyframes fadeIn_ani {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

const Wrapper = styled.div<{ $height: number; $isFullContents: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 500px;
  padding: 1rem;
  border-radius: 0.8rem 0.8rem 0 0;
  background-color: ${({ $isFullContents }) =>
    $isFullContents ? 'var(--app-bg)' : 'var(--surface-muted)'};
  color: var(--text-primary);
  height: ${({ $isFullContents, $height }) =>
    $isFullContents ? '100%' : `${$height}%`};
  max-height: 100dvh;
  outline: none;
  animation: slide_up 0.4s both;

  @keyframes slide_up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  ${media.mobile} {
    min-width: 100%;
  }
`;

const TitleBox = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
  margin-bottom: 1.2rem;
`;

const Title = styled.div`
  min-width: 0;
  font-size: 19px;
  font-weight: 500;
`;

const CloseBtnBox = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  height: 44px;
  margin: -8px 0;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: -2px;
  }
`;

const Contents = styled.div`
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
`;
