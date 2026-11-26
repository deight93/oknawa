import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { RestaurantIcon } from '@/assets/icons/Restaurant';
import { CafeIcon } from '@/assets/icons/Cafe';
import { DrinkIcon } from '@/assets/icons/Drink';
import { Check, ChevronDown } from 'lucide-react';
import {
  activityGroups,
  type ActivityGroup,
  type Activity,
} from '../../../supabase/functions/lib/nearby-activities';
import { useHotPlaceQuery } from '@/hooks/query/hot-place';
import { HotPlaceCategory } from '@/services/hot-place/types';
import PlaceItem from './PlaceItem';

interface HotPlaceModalProps {
  x: number;
  y: number;
}

const categoryIcons = {
  food: <RestaurantIcon color="currentColor" />,
  cafe: <CafeIcon color="currentColor" />,
  drink: <DrinkIcon color="currentColor" />,
  sport: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M1.1 5a5 5 0 0 1 3.9-3.9A4.5 4.5 0 0 1 1.1 5ZM1 6.2A5.7 5.7 0 0 0 6.2 1a5 5 0 0 1 4.8 4.8A5.7 5.7 0 0 0 5.8 11 5 5 0 0 1 1 6.2ZM7 10.9A4.5 4.5 0 0 1 10.9 7 5 5 0 0 1 7 10.9Z" />
    </svg>
  ),
  play: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3 1h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm.5 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2.5 2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
      />
    </svg>
  ),
};

const HOT_PLACE_CATEGORY: { title: string; category: HotPlaceCategory }[] = [
  { title: '맛집', category: 'food' },
  { title: '카페', category: 'cafe' },
  { title: '술집', category: 'drink' },
  { title: '운동', category: 'sport' },
  { title: '놀거리', category: 'play' },
];

export default function HotPlaceModal({ x, y }: HotPlaceModalProps) {
  const [category, setCategory] = useState<HotPlaceCategory>('food');
  const [expanded, setExpanded] = useState(false);
  const [selections, setSelections] = useState<
    Record<ActivityGroup, Activity['id'][]>
  >({ sport: [], play: [] });
  const group = category === 'sport' || category === 'play' ? category : null;
  const chosen = group ? selections[group] : [];
  const options: readonly Activity[] = group ? activityGroups[group] : [];
  const kinds =
    category === 'sport' || category === 'play'
      ? options
          .filter(option => !chosen.length || chosen.includes(option.id))
          .map(option => option.id)
      : [category];
  const panelId = useId();

  function selectCategory(next: HotPlaceCategory) {
    setExpanded(
      next === 'sport' || next === 'play'
        ? next !== category || !expanded
        : false,
    );
    setCategory(next);
  }

  function toggleActivity(id?: Activity['id']) {
    if (!group) return;
    setSelections(previous => {
      const selected = previous[group];
      const next = !id
        ? []
        : selected.includes(id)
          ? selected.filter(item => item !== id)
          : [...selected, id];
      return {
        ...previous,
        [group]: next.length === options.length ? [] : next,
      };
    });
  }

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
  } = useHotPlaceQuery(kinds, { x, y });

  const allPlaces = useMemo(() => {
    const unique = new Map(
      data?.pages.flatMap(page =>
        page.documents.map(place => [place.id, place] as const),
      ),
    );
    const places = Array.from(unique.values());
    if (group)
      places.sort(
        (a, b) =>
          Number(a.distance) - Number(b.distance) || a.id.localeCompare(b.id),
      );
    return places;
  }, [data?.pages, group]);
  const isLoadingPlaces =
    isPending ||
    isPlaceholderData ||
    (!allPlaces.length && hasNextPage && !isFetchNextPageError);

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
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    data?.pages.length,
  ]);

  return (
    <Container>
      <Category role="group" aria-label="주변 장소 종류">
        {HOT_PLACE_CATEGORY.map(c => (
          <CategoryButton
            key={c.category}
            type="button"
            $selected={c.category === category}
            aria-pressed={c.category === category}
            aria-expanded={
              c.category === 'sport' || c.category === 'play'
                ? c.category === category && expanded
                : undefined
            }
            aria-controls={
              c.category === category && group ? panelId : undefined
            }
            onClick={() => selectCategory(c.category)}
          >
            <span className="category-icon" aria-hidden="true">
              {categoryIcons[c.category]}
            </span>
            {c.title}
            {c.category === category &&
              group &&
              !expanded &&
              chosen.length > 0 && <small>{chosen.length}</small>}
            {(c.category === 'sport' || c.category === 'play') && (
              <ChevronDown size={13} aria-hidden="true" />
            )}
          </CategoryButton>
        ))}
      </Category>
      {group && (
        <ActivityFilters
          id={panelId}
          hidden={!expanded}
          role="group"
          aria-label={group === 'sport' ? '운동 종목' : '놀거리 종류'}
        >
          <FilterButton
            type="button"
            aria-pressed={!chosen.length}
            onClick={() => toggleActivity()}
          >
            {!chosen.length && <Check size={13} aria-hidden="true" />}전체
          </FilterButton>
          {options.map(item => (
            <FilterButton
              key={item.id}
              type="button"
              aria-pressed={chosen.includes(item.id)}
              onClick={() => toggleActivity(item.id)}
            >
              {chosen.includes(item.id) && (
                <Check size={13} aria-hidden="true" />
              )}
              {item.label}
            </FilterButton>
          ))}
        </ActivityFilters>
      )}
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
  container-type: inline-size;
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
  display: grid;
  grid-template-columns: repeat(5, minmax(max-content, 1fr));
  gap: 4px;
  margin-bottom: 12px;
  @container (max-width: 270px) {
    grid-template-columns: repeat(3, minmax(max-content, 1fr));
  }
`;

const CategoryButton = styled.button<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 40px;
  padding: 6px 2px;
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
  white-space: nowrap;
  .category-icon {
    display: inline-flex;
    align-items: center;
    margin-right: 1px;
  }
  @container (max-width: 355px) {
    font-size: 13px;
    gap: 1px;
    padding-inline: 1px;
    .category-icon {
      margin-right: 0;
    }
  }
  &[aria-expanded='true'] > svg {
    transform: rotate(180deg);
  }
  small {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  &:hover {
    border-color: var(--primary);
  }
`;

const ActivityFilters = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  &[hidden] {
    display: none;
  }
`;

const FilterButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 34px;
  padding: 4px 8px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  &[aria-pressed='true'] {
    background: var(--surface-strong);
    color: var(--text-primary);
    font-weight: 650;
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
