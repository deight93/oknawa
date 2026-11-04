import styled from 'styled-components';
import PageHeader from '@/components/PageHeader';

export const Container = styled.section`
  --confirm-accent: var(--primary);
  .light & {
    --confirm-accent: color-mix(
      in srgb,
      var(--primary) 45%,
      var(--text-primary)
    );
  }
  position: relative;
  min-height: 0;
  max-height: 60%;
  flex-shrink: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
  background: var(--surface);
  width: 100%;
  border-bottom: 1px solid var(--border);
`;

export const Header = styled(PageHeader)`
  padding: max(8px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right)) 0 max(20px, env(safe-area-inset-left));
`;

export const SharingButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: var(--font-body);
  &:hover {
    color: var(--text-primary);
  }
`;

export const ExpandBody = styled.div`
  padding: 20px max(20px, env(safe-area-inset-right)) 24px
    max(20px, env(safe-area-inset-left));
`;

export const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const StationName = styled.h1`
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

export const ConfirmedLabel = styled.p`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-label);
  font-weight: 600;
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
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
`;

export const AverageArrivalTime = styled.p`
  font-size: var(--font-body);
  line-height: 1.6;
  color: var(--text-secondary);
  word-break: keep-all;
`;

export const ArrivalTime = styled.span`
  color: var(--text-primary);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

export const RetrySelectButton = styled.button`
  flex-shrink: 0;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: var(--font-body);
  font-weight: 500;
  &:hover {
    background: var(--surface-muted);
    color: var(--text-primary);
  }
`;
