import styled from 'styled-components';

interface ExpandProps {
  $isExpand?: boolean;
}
interface disabledProps {
  isDisabled?: boolean;
}

export const Container = styled.div`
  --confirm-accent: var(--primary);
  .light & {
    --confirm-accent: color-mix(
      in srgb,
      var(--primary) 45%,
      var(--text-primary)
    );
  }
  button:focus-visible {
    outline: 2px solid var(--confirm-accent);
    outline-offset: 3px;
  }
  position: absolute;
  background-color: var(--surface);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 3;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 64px 20px 0 12px;
`;

export const HomeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-primary);
  border-radius: 8px;
  svg path {
    fill: currentColor;
  }
`;

export const SharingButton = styled.button`
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 44px;
  font-size: 16px;
  color: var(--text-secondary);
  border-radius: 8px;
  svg path {
    fill: currentColor;
  }
`;

export const ExpandBody = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 20px 20px;
  gap: 12px;
`;

export const ContentWrapper = styled.div<ExpandProps>`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
`;

export const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const StationName = styled.h1<ExpandProps>`
  font-size: ${({ $isExpand }) => ($isExpand ? '24px' : '18px')};
  font-weight: ${({ $isExpand }) => ($isExpand ? '700' : '600')};
  line-height: 1.35;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

export const AverageArrivalTime = styled.p`
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: keep-all;
`;

export const ConfirmedLabel = styled.p`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--confirm-accent);
  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    color: var(--button-text-on-primary);
  }
`;

export const SummaryRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
`;

export const RetrySelectButton = styled.button`
  flex: 0 0 auto;
  min-width: 88px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  background-color: transparent;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background-color: var(--primary-soft);
  }
`;

export const ArrivalTime = styled.span<ExpandProps>`
  color: ${({ $isExpand }) =>
    $isExpand ? 'var(--confirm-accent)' : 'var(--text-secondary)'};
  font-weight: ${({ $isExpand }) => ($isExpand ? '700' : '500')};
  font-size: ${({ $isExpand }) => ($isExpand ? '18px' : ' 14px')};
`;

export const HostControlPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background-color: var(--surface);
`;

export const HostControlTitle = styled.p`
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
`;

export const HostControlDescription = styled.p`
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
`;

export const HostControlButtonWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 2px;
`;

export const IndicatorWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin-top: 17px;
`;

export const Indicator = styled.div`
  color: var(--text-subtle);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.003em;
`;

export const ChevronButton = styled.div`
  cursor: pointer;
`;

export const PreffertWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

export const VoteWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 106px;
  gap: 8px;
`;

export const VoteTitle = styled.div`
  display: flex;
  flex-direction: row;
  gap: 4px;
`;
export const Label = styled.p`
  font-size: 13px;
  color: var(--text-subtle);
`;
export const Count = styled.p`
  font-size: 13px;
`;

export const LikeWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  /* width: 106px; */
`;

export const LikeItem = styled.div`
  /* flex: 1 0 20%; */
`;

export const ButtonWrapper = styled.div<ExpandProps>`
  display: flex;
  width: fit-content;
  flex-direction: row;
  align-items: center;
  gap: ${({ $isExpand }) => ($isExpand ? '8px' : '12px')};
`;

export const FoldBody = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 0 8px 20px;
`;

export const FoldLabel = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

export const FoldLabelWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;
export const DividerVertical = styled.div`
  width: 1px;
  height: 8px;
  background-color: var(--border);
`;

export const ChevronWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  cursor: pointer;
`;

export const LeftWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

export const RightWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
`;

export const LikeButton = styled.div<disabledProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: 1000px;
  background-color: var(--border);
  cursor: pointer;
`;

export const ConfirmButton = styled.div<disabledProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: 1000px;
  background-color: var(--primary);
  cursor: pointer;
`;

export const TailWrapper = styled.div`
  position: absolute;
  bottom: -16px;
  display: flex;
  justify-content: center;
  width: 100%;
  height: 16px;
`;

export const Tail = styled.div`
  display: flex;
  justify-content: center;
  width: 64px;
  background-color: var(--surface);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  cursor: pointer;
  position: relative;

  svg {
    position: absolute;
    bottom: 0px;
  }
`;

ContentWrapper.defaultProps = {
  $isExpand: true,
};

StationName.defaultProps = {
  $isExpand: true,
};
ArrivalTime.defaultProps = {
  $isExpand: true,
};

ButtonWrapper.defaultProps = {
  $isExpand: true,
};
