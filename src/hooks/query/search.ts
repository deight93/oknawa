import { useQuery, useQueryClient } from '@tanstack/react-query';

import SearchService from '@/services/search/SearchService';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value?: string | null) =>
  Boolean(value && UUID_REGEX.test(value));

export const usePlaceSearchWithShareKeyQuery = (shareKey?: string | null) => {
  const { data, isLoading } = useQuery({
    queryKey: ['placeSearchWithShareKey', shareKey],
    queryFn: () => SearchService.searchPlacesWithShareKey(shareKey),
    enabled: isUuid(shareKey),
  });

  return {
    data,
    isLoading,
  };
};

export const useInputStatusListQuery = (roomId: string) => {
  const hasRoomId = isUuid(roomId);
  const { data, isLoading } = useQuery({
    queryKey: ['inputStatusList', roomId],
    queryFn: () => SearchService.getInputStatusList(roomId),
    enabled: hasRoomId,
    refetchInterval: hasRoomId ? 5000 : false,
  });

  const participant = data?.participant;

  return { data, participant, isLoading };
};

export const usePlaceSearchMapIdQuery = (mapId: string) => {
  const queryClient = useQueryClient();
  const hasMapId = isUuid(mapId);

  const { data, isLoading } = useQuery({
    queryKey: ['placeSearchMapId', mapId],
    queryFn: () => SearchService.searchPolling(mapId),
    enabled: hasMapId,
    refetchInterval: hasMapId ? 2000 : false,
  });

  const clearRefetchInterval = () => {
    queryClient.setQueryDefaults(['placeSearchMapId', mapId], {
      refetchInterval: false,
    });
    console.log('종료 성공!');
  };

  return {
    data,
    isLoading,
    clearRefetchInterval,
  };
};
