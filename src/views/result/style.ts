import styled from 'styled-components';
import PageHeader from '@/components/PageHeader';

interface ExpandProps {
  $isExpand?: boolean;
}

export const Container = styled.div`
  --result-muted: color-mix(
    in srgb,
    var(--text-muted) 75%,
    var(--text-primary)
  );
  --result-accent: var(--primary);
  .light & {
    --result-accent: color-mix(
      in srgb,
      var(--primary) 45%,
      var(--text-primary)
    );
  }
  button:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
  }
  button {
    -webkit-tap-highlight-color: transparent;
  }

  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: var(--surface);
  width: 100%;
  max-height: 88vh;
  max-height: min(88dvh, calc(100dvh - max(64px, env(safe-area-inset-top))));
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border);
  border-bottom: 0;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  box-shadow: var(--shadow-panel);
  z-index: 8888;
`;

export const Header = styled(PageHeader)`
  padding: 8px max(20px, env(safe-area-inset-right)) 0
    max(20px, env(safe-area-inset-left));
`;

export const SharingButton = styled.button`
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 44px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  &:hover {
    color: var(--text-primary);
  }
`;

export const ExpandBody = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 0 max(20px, env(safe-area-inset-right)) 0
    max(20px, env(safe-area-inset-left));
  gap: 20px;
  padding-bottom: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;

  > * {
    flex-shrink: 0;
  }
`;

export const ContentWrapper = styled.div<ExpandProps>`
  display: flex;
  width: 100%;
  justify-content: space-between;
  flex-direction: ${({ $isExpand = true }) => ($isExpand ? 'column' : 'row')};
  align-items: ${({ $isExpand = true }) => ($isExpand ? 'stretch' : 'center')};
  gap: ${({ $isExpand = true }) => ($isExpand ? '4px' : '0')};
`;

export const CandidateMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const TitleWrapper = styled.div`
  min-width: 0;
  flex: 1 1 13rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const StationName = styled.h2<ExpandProps>`
  word-break: keep-all;
  overflow-wrap: anywhere;
  line-height: 1.4;
  font-size: ${({ $isExpand = true }) => ($isExpand ? '28px' : '18px')};
  font-weight: ${({ $isExpand = true }) => ($isExpand ? '700' : '600')};
`;

export const ArrivalTime = styled.span<ExpandProps>`
  color: ${({ $isExpand = true }) =>
    $isExpand ? 'var(--result-accent)' : 'var(--text-secondary)'};
  font-weight: ${({ $isExpand = true }) => ($isExpand ? '700' : '500')};
  font-size: ${({ $isExpand = true }) => ($isExpand ? '18px' : ' 14px')};
`;

export const IndicatorWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  margin-left: auto;
`;

export const Indicator = styled.div`
  color: var(--result-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
`;

export const ChevronButton = styled.button`
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    background: var(--surface-muted);
  }
`;

export const PreffertWrapper = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px max(20px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  border-top: 1px solid var(--border);
  background: var(--surface);
  > div:last-child {
    width: 100%;
  }
  > div:last-child > button {
    flex: 1;
    min-height: 48px;
  }
`;

export const HostControlPanel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
`;

export const HostControlTitle = styled.p`
  color: var(--result-muted);
  font-size: 13px;
  font-weight: 500;
`;

export const SortWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px 12px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  > label {
    font-size: 14px;
    font-weight: 600;
  }
  > p {
    grid-column: 1 / -1;
  }
`;

export const SortSelect = styled.select`
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
`;

export const PreferenceDescription = styled.p`
  color: var(--result-muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.55;
`;

export const ConditionBadgeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const ConditionBadge = styled.span`
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--primary);
  border-radius: 999px;
  background-color: var(--primary-soft);
  color: var(--result-accent);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
`;

export const SummaryMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
`;

export const SummaryMetric = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  &:not(:first-child) {
    padding-left: 16px;
    border-left: 1px solid var(--border);
  }
`;

export const SummaryMetricLabel = styled.span`
  color: var(--result-muted);
  font-size: 12px;
  font-weight: 600;
`;

export const SummaryMetricValue = styled.span`
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  word-break: keep-all;
`;

export const DetailToggleButton = styled.button`
  display: inline-flex;
  width: fit-content;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--result-muted);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  &:hover {
    background: var(--surface-muted);
    color: var(--text-primary);
  }
`;

export const DetailPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background-color: var(--surface-inset);
`;

export const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const DetailSectionTitle = styled.h3`
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
`;

export const QualityMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
  gap: 8px;
`;

export const QualityMetric = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
`;

export const QualityMetricLabel = styled.span`
  color: var(--result-muted);
  font-size: 11px;
  font-weight: 600;
`;

export const QualityMetricValue = styled.span`
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const CompareHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const CompareTitle = styled.p`
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
`;

export const CompareList = styled.div`
  display: grid;
  gap: 8px;
  overflow: visible;
`;

export const CompareCard = styled.div<{
  $isActive: boolean;
}>`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid
    ${({ $isActive }) => ($isActive ? 'var(--primary)' : 'var(--border)')};
  border-radius: 10px;
  background-color: ${({ $isActive }) =>
    $isActive ? 'var(--primary-soft)' : 'var(--surface-raised)'};
  color: var(--text-primary);
  text-align: left;
`;

export const CompareSelectButton = styled.button`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  text-align: left;
  border-radius: 6px;
`;

export const CompareStationName = styled.p`
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
`;

export const CompareBadgeList = styled.div`
  display: flex;
  min-height: 24px;
  flex-wrap: wrap;
  gap: 4px;
`;

export const CompareMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: auto;
`;

export const CompareMetric = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
`;

export const CompareMetricLabel = styled.span`
  color: var(--result-muted);
  font-size: 11px;
  font-weight: 500;
`;

export const CompareMetricValue = styled.span`
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ParticipantSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

export const ParticipantList = styled.ul`
  display: flex;
  flex-direction: column;
`;

export const ParticipantRow = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem 6rem;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  &:last-child {
    border-bottom: 0;
  }
  @media (max-width: 359px) {
    gap: 8px;
  }
`;

export const ParticipantIdentity = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  > span:first-child {
    flex-shrink: 0;
  }
  @media (max-width: 359px) {
    gap: 8px;
  }
`;

export const ParticipantName = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
`;

export const ParticipantMode = styled.span`
  text-align: right;
  color: var(--result-muted);
  font-size: 13px;
  white-space: nowrap;
`;

export const ParticipantTime = styled.span`
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
`;

export const ParticipantStats = styled.span`
  color: var(--result-muted);
  font-size: 13px;
  line-height: 1.5;
  text-align: right;
  word-break: keep-all;
`;

export const ComparisonToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  svg {
    flex-shrink: 0;
    color: var(--result-muted);
  }
  &:hover {
    background: var(--surface-muted);
  }
`;

export const VoteWrapper = styled.div`
  width: 100%;
`;

export const VoteTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
export const Label = styled.p`
  font-size: 13px;
  color: var(--result-muted);
`;
export const Count = styled.p`
  font-size: 13px;
`;

export const ButtonWrapper = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
`;

export const FoldBody = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  min-height: 0;
  overflow-y: auto;
  padding: 0 max(8px, env(safe-area-inset-right))
    max(18px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
`;

export const FoldLabel = styled.div`
  display: flex;
  flex-shrink: 0;
  white-space: nowrap;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

export const FoldLabelWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;
export const DividerVertical = styled.div`
  width: 1px;
  height: 8px;
  background-color: var(--border);
`;

export const ChevronWrapper = styled.button`
  flex-shrink: 0;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  cursor: pointer;
`;

export const LeftWrapper = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

export const RightWrapper = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  @media (max-width: 359px) {
    gap: 0;
  }
`;

export const LikeButton = styled.button`
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: 1000px;
  background-color: var(--border);
  cursor: pointer;
`;

export const ConfirmButton = styled.button`
  flex-shrink: 0;
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
  top: -16px;
  display: flex;
  justify-content: center;
  width: 100%;
  height: 16px;
`;

export const Tail = styled.button`
  height: 32px;
  border: 0;
  display: flex;
  justify-content: center;
  width: 64px;
  background-color: var(--surface);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  cursor: pointer;
  position: relative;

  svg {
    position: absolute;
    top: 0px;
  }
  svg path {
    stroke: currentColor;
  }
`;
