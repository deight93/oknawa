'use client';

import { useRouter } from 'next/navigation';

import useModal from '@/hooks/common/useModal';
import useHostControlFlow from '@/hooks/result/useHostControlFlow';
import useKakaoShare from '@/hooks/result/useKakaoShare';

import { convertToKoreanTime } from '@/utils/date';

import { ShareIcon } from '@/assets/icons/Share';
import { HomeIcon } from '@/assets/icons/Home';
import Button from '@/components/Button';

import { useResetAtom } from 'jotai/utils';
import { modalState } from '@/jotai/global/store';
import { ConfirmedHotPlace } from '@/services/hot-place/types';

import {
  Container,
  ArrivalTime,
  AverageArrivalTime,
  ExpandBody,
  ContentWrapper,
  Header,
  HomeButton,
  SharingButton,
  StationName,
  TitleWrapper,
  FinalPlaceAddress,
  FinalPlaceLink,
  FinalPlaceMeta,
  FinalPlacePanel,
  FinalPlaceTitle,
  HostControlButtonWrapper,
  HostControlPanel,
  HostControlTitle,
} from '../style';

interface DistanceSummaryProps {
  activeMapId: string;
  confirmedPlace?: ConfirmedHotPlace | null;
  stationName: string;
  shareKey: string;
  averageTravelTime: number;
}

export default function DistanceSummary({
  activeMapId,
  confirmedPlace,
  stationName,
  shareKey,
  averageTravelTime,
}: DistanceSummaryProps) {
  const router = useRouter();

  const { shareConfirmedResult } = useKakaoShare();
  const { canManage, requestCancelConfirm, requestResetVote } =
    useHostControlFlow(activeMapId, shareKey);

  const reset = useResetAtom(modalState);

  const { setModalContents } = useModal();

  const handleKakaoSharingBtnClick = () => {
    shareConfirmedResult(stationName, shareKey, {
      addressName:
        confirmedPlace?.road_address_name || confirmedPlace?.address_name,
      imageUrl: confirmedPlace?.main_photo_url,
      placeName: confirmedPlace?.place_name,
    });
  };

  const clickHome = () => {
    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '확인',
      contents: '홈으로 돌아가시겠어요?',
      onConfirm: goToHome,
    });
  };

  const goToHome = () => {
    router.push('/');
    reset();
  };
  const title = confirmedPlace
    ? `${confirmedPlace.place_name}에서 만나요`
    : `${stationName}을 추천해요`;
  const finalPlaceAddress =
    confirmedPlace?.road_address_name || confirmedPlace?.address_name;

  return (
    <Container>
      <Header>
        <HomeButton onClick={clickHome}>
          <HomeIcon />
        </HomeButton>
        <SharingButton onClick={handleKakaoSharingBtnClick}>
          <ShareIcon />
          공유하기
        </SharingButton>
      </Header>
      <ExpandBody>
        <ContentWrapper>
          <TitleWrapper>
            <StationName>{title}</StationName>
            <AverageArrivalTime>
              {confirmedPlace
                ? `${stationName} 근처, 평균 `
                : '도착하는데 평균 '}
              <ArrivalTime>
                {convertToKoreanTime(averageTravelTime)}
              </ArrivalTime>{' '}
              걸려요!
            </AverageArrivalTime>
          </TitleWrapper>
        </ContentWrapper>
        {confirmedPlace && (
          <FinalPlacePanel>
            <FinalPlaceMeta>
              {confirmedPlace.category_group_name || '최종 장소'}
            </FinalPlaceMeta>
            <FinalPlaceTitle>{confirmedPlace.place_name}</FinalPlaceTitle>
            {finalPlaceAddress && (
              <FinalPlaceAddress>{finalPlaceAddress}</FinalPlaceAddress>
            )}
            {confirmedPlace.place_url && (
              <FinalPlaceLink
                href={confirmedPlace.place_url}
                target="_blank"
                rel="noreferrer"
              >
                장소 자세히 보기
              </FinalPlaceLink>
            )}
          </FinalPlacePanel>
        )}
        {canManage && (
          <HostControlPanel>
            <HostControlTitle>방장 관리</HostControlTitle>
            <HostControlButtonWrapper>
              <Button
                label="재투표 시작"
                size="small"
                onClick={requestResetVote}
                $widthFull
              />
              <Button
                label="확정 취소"
                size="small"
                onClick={requestCancelConfirm}
                $widthFull
              />
            </HostControlButtonWrapper>
          </HostControlPanel>
        )}
      </ExpandBody>
    </Container>
  );
}
