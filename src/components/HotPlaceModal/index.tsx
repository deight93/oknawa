import { Chip } from '@nextui-org/react';
import { useQueryClient } from '@tanstack/react-query';
import { useResetAtom } from 'jotai/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import styled from 'styled-components';

import { CafeIcon } from '@/assets/icons/Cafe';
import { DrinkIcon } from '@/assets/icons/Drink';
import { RestaurantIcon } from '@/assets/icons/Restaurant';
import useModal from '@/hooks/common/useModal';
import {
  useConfirmHotPlaceMutation,
  useVoteHotPlaceMutation,
} from '@/hooks/mutation/hot-place';
import {
  useHotPlaceQuery,
  useHotPlaceVotesQuery,
} from '@/hooks/query/hot-place';
import { modalState } from '@/jotai/global/store';
import { HotPlace, HotPlaceCategory } from '@/services/hot-place/types';
import { getVotedHotPlaceId, setVotedHotPlace } from '@/utils/voteStorage';
import PlaceItem from './PlaceItem';
import { HotPlaceConfirmConfig, HotPlaceVoteConfig } from './types';

interface HotPlaceModalProps {
  x: number;
  y: number;
  confirmConfig?: HotPlaceConfirmConfig;
  voteConfig?: HotPlaceVoteConfig;
}

const HOT_PLACE_CATEGORY: { title: string; category: HotPlaceCategory }[] = [
  { title: '맛집', category: 'food' },
  { title: '카페', category: 'cafe' },
  { title: '술집', category: 'drink' },
];

const categoryIcons: Record<HotPlaceCategory, JSX.Element> = {
  food: <RestaurantIcon />,
  cafe: <CafeIcon color="black" />,
  drink: <DrinkIcon color="black" />,
};

export default function HotPlaceModal({
  x,
  y,
  confirmConfig,
  voteConfig,
}: HotPlaceModalProps) {
  const [category, setCategory] = useState<HotPlaceCategory>('food');
  const [confirmingPlaceId, setConfirmingPlaceId] = useState('');
  const [votingPlaceId, setVotingPlaceId] = useState('');
  const [votedPlaceId, setVotedPlaceId] = useState('');
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const resetModal = useResetAtom(modalState);
  const { setModalContents } = useModal();
  const { mutate: confirmHotPlace } = useConfirmHotPlaceMutation();
  const { mutate: voteHotPlace } = useVoteHotPlaceMutation();
  const voteRound = voteConfig?.voteRound ?? 1;

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useHotPlaceQuery(category, { x, y });
  const { data: hotPlaceVotes = [] } = useHotPlaceVotesQuery(
    voteConfig?.mapId,
    voteConfig?.shareKey,
    voteConfig ? voteRound : undefined,
    category,
  );

  const allPlaces = useMemo(
    () => data?.pages.flatMap(page => page.documents) ?? [],
    [data?.pages],
  );
  const voteByPlaceId = useMemo(
    () =>
      new Map(
        hotPlaceVotes.map(vote => [vote.kakao_place_id, vote.vote] as const),
      ),
    [hotPlaceVotes],
  );
  const sortedPlaces = useMemo(
    () =>
      [...allPlaces].sort(
        (a, b) =>
          (voteByPlaceId.get(b.id) ?? 0) - (voteByPlaceId.get(a.id) ?? 0),
      ),
    [allPlaces, voteByPlaceId],
  );

  useEffect(() => {
    if (!voteConfig) {
      setVotedPlaceId('');
      return;
    }

    setVotedPlaceId(
      getVotedHotPlaceId(voteConfig.mapId, voteConfig.shareKey, voteRound),
    );
  }, [voteConfig, voteRound]);

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];

        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 300px',
        threshold: 0.1,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const confirmPlace = (place: HotPlace) => {
    if (!confirmConfig) {
      return;
    }

    resetModal();
    setConfirmingPlaceId(place.id);
    confirmHotPlace(
      {
        ...confirmConfig,
        category,
        place,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['confirmedHotPlace', confirmConfig.shareKey],
          });
          toast.success('최종 장소가 확정되었습니다.');
        },
        onError: () => {
          toast.error('최종 장소 확정에 실패했습니다.');
        },
        onSettled: () => {
          setConfirmingPlaceId('');
        },
      },
    );
  };

  const requestConfirmPlace = (place: HotPlace) => {
    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '확정하기',
      contents: `${place.place_name}을 최종 장소로 확정할까요?`,
      onConfirm: () => confirmPlace(place),
    });
  };

  const votePlace = (place: HotPlace) => {
    if (!voteConfig || votedPlaceId) {
      return;
    }

    resetModal();
    setVotingPlaceId(place.id);
    voteHotPlace(
      {
        ...voteConfig,
        voteRound,
        category,
        place,
      },
      {
        onSuccess: () => {
          setVotedHotPlace(
            voteConfig.mapId,
            voteConfig.shareKey,
            place.id,
            voteRound,
          );
          setVotedPlaceId(place.id);
          queryClient.invalidateQueries({
            queryKey: [
              'hotPlaceVotes',
              voteConfig.mapId,
              voteConfig.shareKey,
              voteRound,
              category,
            ],
          });
          toast.success('최종 장소에 투표했습니다.');
        },
        onError: () => {
          toast.error('최종 장소 투표에 실패했습니다.');
        },
        onSettled: () => {
          setVotingPlaceId('');
        },
      },
    );
  };

  const requestVotePlace = (place: HotPlace) => {
    if (votedPlaceId) {
      return;
    }

    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '투표하기',
      contents: `${place.place_name}에 투표할까요?\n투표 후 수정이 어렵습니다.`,
      onConfirm: () => votePlace(place),
    });
  };

  return (
    <Container>
      <Contents>
        <Category>
          {HOT_PLACE_CATEGORY.map(c => {
            const isSelected = c.category === category;
            return (
              <Chip
                key={c.category}
                color={isSelected ? 'success' : 'default'}
                onClick={() => setCategory(c.category)}
              >
                <ChipItem>
                  {categoryIcons[c.category]}
                  {c.title}
                </ChipItem>
              </Chip>
            );
          })}
        </Category>
        {voteConfig && (
          <VoteGuide>
            함께 갈 최종 장소에 투표하세요. 방장은 표를 보고 장소를 확정할 수
            있어요.
          </VoteGuide>
        )}
        {sortedPlaces.map(place => (
          <PlaceItem
            key={place.id}
            place={place}
            voteCount={voteByPlaceId.get(place.id) ?? 0}
            isVoted={votedPlaceId === place.id}
            isVoteDisabled={Boolean(votedPlaceId)}
            isVoting={votingPlaceId === place.id}
            isConfirming={confirmingPlaceId === place.id}
            onVotePlace={voteConfig ? () => requestVotePlace(place) : undefined}
            onConfirmPlace={
              confirmConfig ? () => requestConfirmPlace(place) : undefined
            }
          />
        ))}
      </Contents>
      <div ref={loaderRef} style={{ height: '10px' }} />
    </Container>
  );
}

const Container = styled.div``;

const Contents = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Category = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
`;

const VoteGuide = styled.p`
  color: #a1a1aa;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
`;

const ChipItem = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
`;
