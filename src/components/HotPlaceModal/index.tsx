import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { CafeIcon } from '@/assets/icons/Cafe';
import { DrinkIcon } from '@/assets/icons/Drink';
import { RestaurantIcon } from '@/assets/icons/Restaurant';
import { useHotPlaceQuery } from '@/hooks/query/hot-place';
import { HotPlaceCategory } from '@/services/hot-place/types';
import PlaceItem from './PlaceItem';

interface HotPlaceModalProps {
  x: number;
  y: number;
}

const HOT_PLACE_CATEGORY: { title: string; category: HotPlaceCategory }[] = [
  { title: '맛집', category: 'food' },
  { title: '카페', category: 'cafe' },
  { title: '술집', category: 'drink' },
];

const categoryIcons: Record<HotPlaceCategory, JSX.Element> = {
  food: <RestaurantIcon color="currentColor" width="16" height="16" />,
  cafe: <CafeIcon color="currentColor" width="16" height="16" />,
  drink: <DrinkIcon color="currentColor" width="16" height="16" />,
};

export default function HotPlaceModal({ x, y }: HotPlaceModalProps) {
  const [category, setCategory] = useState<HotPlaceCategory>('food');
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isPending,
    isPlaceholderData,
    isError,
    isFetchNextPageError,
    refetch,
  } = useHotPlaceQuery(category, { x, y });

  const allPlaces = useMemo(
    () => data?.pages.flatMap(page => page.documents) ?? [],
    [data?.pages],
  );
  const isLoadingPlaces = isPending || isPlaceholderData;

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        if (
          entries[0]?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage &&
          !isFetchNextPageError
        ) {
          void fetchNextPage();
        }
      },
      { root: null, rootMargin: '0px 0px 300px', threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  return (
    <Container>
      <Category role="group" aria-label="주변 장소 종류">
        {HOT_PLACE_CATEGORY.map(c => (
          <CategoryButton
            key={c.category}
            type="button"
            $selected={c.category === category}
            aria-pressed={c.category === category}
            onClick={() => setCategory(c.category)}
          >
            <span aria-hidden="true">{categoryIcons[c.category]}</span>
            {c.title}
          </CategoryButton>
        ))}
      </Category>
      {isLoadingPlaces ? (
        <Status role="status">주변 장소를 찾고 있어요.</Status>
      ) : isError && allPlaces.length === 0 ? (
        <Status role="alert">
          주변 장소를 불러오지 못했어요.
          <RetryButton type="button" onClick={() => refetch()}>
            다시 시도
          </RetryButton>
        </Status>
      ) : allPlaces.length === 0 ? (
        <Status role="status">
          주변에서 장소를 찾지 못했어요.
          <span>다른 종류의 장소도 살펴보세요.</span>
        </Status>
      ) : (
        <Places aria-label="주변 장소">
          {allPlaces.map(place => (
            <li key={place.id}>
              <PlaceItem place={place} />
            </li>
          ))}
        </Places>
      )}
      {isFetchingNextPage && (
        <Status role="status">장소를 더 불러오고 있어요.</Status>
      )}
      {isFetchNextPageError && (
        <Status role="alert">
          다음 장소를 불러오지 못했어요.
          <RetryButton type="button" onClick={() => fetchNextPage()}>
            더 불러오기
          </RetryButton>
        </Status>
      )}
      <div ref={loaderRef} aria-hidden="true" style={{ height: '1px' }} />
    </Container>
  );
}

const Container = styled.div`
  --place-muted: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  padding: 4px 4px max(4px, env(safe-area-inset-bottom));
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
  }
`;

const Category = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

const CategoryButton = styled.button<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 76px;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid
    ${({ $selected }) =>
      $selected ? 'var(--primary)' : 'var(--border-strong)'};
  border-radius: 999px;
  background: ${({ $selected }) =>
    $selected ? 'var(--primary)' : 'var(--surface-strong)'};
  color: ${({ $selected }) =>
    $selected ? 'var(--button-text-on-primary)' : 'var(--text-secondary)'};
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  span {
    display: flex;
  }
  &:hover {
    border-color: var(--primary);
  }
`;

const Places = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
  li {
    min-width: 0;
  }
`;

const Status = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 112px;
  gap: 10px;
  padding: 24px 8px;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  color: var(--text-secondary);
  span {
    color: var(--place-muted);
  }
`;

const RetryButton = styled.button`
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 14px;
`;
