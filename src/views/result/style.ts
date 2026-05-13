import styled from 'styled-components';

interface ExpandProps {
  $isExpand?: boolean;
}
interface disabledProps {
  isDisabled?: boolean;
}

export const Container = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: #151518;
  width: 100%;
  max-height: 88dvh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #28282d;
  border-bottom: 0;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.32);
  z-index: 8888;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 16px 20px 0 8px;
`;

export const HomeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
`;

export const SharingButton = styled.button`
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 16px;
  color: #d9d9d9;
`;

export const ExpandBody = styled.div`
  display: flex;
  max-height: calc(88dvh - 64px);
  flex-direction: column;
  padding: 0 20px 20px;
  gap: 20px;
  overflow-y: auto;
`;

export const ContentWrapper = styled.div<ExpandProps>`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
  padding-bottom: ${({ $isExpand }) => $isExpand && '20px'};
  border-bottom: ${({ $isExpand }) => $isExpand && '1px solid #1c1c20;'};
`;

export const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const StationName = styled.p<ExpandProps>`
  display: flex;
  justify-content: space-between;
  font-size: ${({ $isExpand }) => ($isExpand ? '24px' : '18px')};
  font-weight: ${({ $isExpand }) => ($isExpand ? '700' : '600')};
`;

export const AverageArrivalTime = styled.p`
  font-size: 18px;
`;

export const ArrivalTime = styled.span<ExpandProps>`
  color: ${({ $isExpand }) => ($isExpand ? 'var(--primary)' : '#D0D0D0')};
  font-weight: ${({ $isExpand }) => ($isExpand ? '700' : '500')};
  font-size: ${({ $isExpand }) => ($isExpand ? '18px' : ' 14px')};
`;

export const IndicatorWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin-top: 17px;
`;

export const Indicator = styled.div`
  color: #777781;
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

export const HostControlPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #28282d;
  border-radius: 8px;
  background-color: #1c1c20;
`;

export const HostControlTitle = styled.p`
  color: #f4f4f5;
  font-size: 15px;
  font-weight: 700;
`;

export const HostControlButtonWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

export const SortWrapper = styled.div`
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
`;

export const SortButton = styled.button<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: fit-content;
  height: 32px;
  padding: 0 12px;
  border: 1px solid ${({ $isActive }) => ($isActive ? '#18c964' : '#28282d')};
  border-radius: 999px;
  background-color: ${({ $isActive }) => ($isActive ? '#123925' : '#1c1c20')};
  color: ${({ $isActive }) => ($isActive ? '#18c964' : '#bdbdbd')};
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
`;

export const PreferencePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #28282d;
  border-radius: 8px;
  background-color: #1c1c20;
`;

export const PreferenceHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

export const PreferenceTitle = styled.p`
  color: #f4f4f5;
  font-size: 15px;
  font-weight: 700;
`;

export const PreferenceDescription = styled.p`
  color: #bdbdbd;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
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
  border: 1px solid #18c964;
  border-radius: 999px;
  background-color: #123925;
  color: #18c964;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
`;

export const SummaryMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
`;

export const SummaryMetric = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid #28282d;
  border-radius: 8px;
  background-color: #1c1c20;
`;

export const SummaryMetricLabel = styled.span`
  color: #777780;
  font-size: 12px;
  font-weight: 600;
`;

export const SummaryMetricValue = styled.span`
  overflow: hidden;
  color: #f4f4f5;
  font-size: 18px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const DetailToggleWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const DetailToggleButton = styled.button`
  display: inline-flex;
  width: fit-content;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid #34343a;
  border-radius: 999px;
  background-color: #202024;
  color: #d9d9d9;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
`;

export const DetailPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid #28282d;
  border-radius: 8px;
  background-color: #111113;
`;

export const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const DetailSectionTitle = styled.p`
  color: #f4f4f5;
  font-size: 13px;
  font-weight: 800;
`;

export const QualityMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
  gap: 8px;
`;

export const QualityMetric = styled.div`
  display: flex;
  min-width: 74px;
  flex-direction: column;
  gap: 4px;
  padding: 10px 8px;
  border: 1px solid #28282d;
  border-radius: 8px;
  background-color: #1c1c20;
`;

export const QualityMetricLabel = styled.span`
  color: #777780;
  font-size: 11px;
  font-weight: 600;
`;

export const QualityMetricValue = styled.span`
  overflow: hidden;
  color: #f4f4f5;
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
  color: #f4f4f5;
  font-size: 15px;
  font-weight: 700;
`;

export const CompareList = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
`;

export const CompareCard = styled.div<{
  $isActive: boolean;
  $isExpanded?: boolean;
}>`
  display: flex;
  flex: 0 0 154px;
  min-height: ${({ $isExpanded }) => ($isExpanded ? '126px' : '92px')};
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid ${({ $isActive }) => ($isActive ? '#18c964' : '#28282d')};
  border-radius: 8px;
  background-color: ${({ $isActive }) => ($isActive ? '#123925' : '#1c1c20')};
  color: #f4f4f5;
  text-align: left;
  cursor: pointer;
`;

export const CompareStationName = styled.p`
  overflow: hidden;
  color: #f4f4f5;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: #777780;
  font-size: 11px;
  font-weight: 500;
`;

export const CompareMetricValue = styled.span`
  overflow: hidden;
  color: #d9d9d9;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const CompareMetricBar = styled.span`
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background-color: #34343a;
`;

export const CompareMetricBarFill = styled.span<{ $ratio: number }>`
  display: block;
  width: ${({ $ratio }) => `${Math.max(0, Math.min($ratio, 100))}%`};
  height: 100%;
  border-radius: inherit;
  background-color: #18c964;
`;

export const ParticipantList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const ParticipantRow = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #202024;

  &:last-child {
    border-bottom: 0;
  }
`;

export const ParticipantName = styled.span`
  overflow: hidden;
  color: #f4f4f5;
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ParticipantStats = styled.span`
  overflow: hidden;
  color: #bdbdbd;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: #777780;
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
  padding: 0 8px 18px;
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
  background-color: #28282d;
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
  background-color: #28282d;
  cursor: pointer;
`;

export const ConfirmButton = styled.div<disabledProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: 1000px;
  background-color: #18c964;
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

export const Tail = styled.div`
  display: flex;
  justify-content: center;
  width: 64px;
  background-color: #151518;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  cursor: pointer;
  position: relative;

  svg {
    position: absolute;
    top: 0px;
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
