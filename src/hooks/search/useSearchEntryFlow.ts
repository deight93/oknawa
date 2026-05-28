import { useRouter } from 'next/navigation';

import { useAtom } from 'jotai';

import {
  useMakeRoomMutation,
  useSubmitDeparturePointMutation,
} from '@/hooks/mutation/search';
import { roomState } from '@/jotai/global/room';
import { SearchState, searchState } from '@/jotai/global/store';
import { SubmitDeparturePointRequestBody } from '@/services/search/types';

type SearchViewType = 'individual' | 'together';

const toDeparturePointRequestBody = (
  roomId: string,
  searchForm: SearchState,
): SubmitDeparturePointRequestBody => ({
  room_id: roomId,
  name: searchForm.name,
  region_name: searchForm.address.regionName,
  full_address: searchForm.address.fullAddress,
  start_x: searchForm.address.longitude,
  start_y: searchForm.address.latitude,
});

const toSearchStateSnapshot = (searchForm: SearchState): SearchState => ({
  name: searchForm.name,
  address: {
    fullAddress: searchForm.address.fullAddress,
    latitude: searchForm.address.latitude,
    longitude: searchForm.address.longitude,
    regionName: searchForm.address.regionName,
  },
});

export default function useSearchEntryFlow(
  type: SearchViewType,
  shareRoomId: string | null,
  resetForm: () => void,
) {
  const router = useRouter();
  const [searchList, setSearchList] = useAtom(searchState);
  const [storageRoomData, setStorageRoomData] = useAtom(roomState);

  const { mutate: makeRoom } = useMakeRoomMutation();
  const { mutate: submitDeparturePoint } = useSubmitDeparturePointMutation();

  const isIndividualView = type === 'individual';
  const searchCount = searchList.length;

  const submitIndividualSearch = (searchForm: SearchState) => {
    setSearchList(prevState => [
      ...prevState,
      toSearchStateSnapshot(searchForm),
    ]);

    if (searchCount >= 1) {
      router.push('/search/list');
      return;
    }

    resetForm();
  };

  const submitDeparturePointToRoom = (
    roomId: string,
    searchForm: SearchState,
  ) => {
    submitDeparturePoint(
      {
        requestBody: toDeparturePointRequestBody(roomId, searchForm),
      },
      {
        onSuccess: () => {
          if (shareRoomId) {
            setStorageRoomData({ roomId: shareRoomId, hostId: '' });
          }
          router.push('/search/list-together');
        },
      },
    );
  };

  const createRoom = (searchForm: SearchState) => {
    makeRoom(searchForm, {
      onSuccess: data => {
        setStorageRoomData({
          roomId: data?.room_id ?? '',
          hostId: data?.room_host_id ?? '',
        });
        router.push('/search/list-together');
      },
    });
  };

  const submitTogetherSearch = (searchForm: SearchState) => {
    if (shareRoomId) {
      submitDeparturePointToRoom(shareRoomId, searchForm);
      return;
    }

    if (storageRoomData.roomId && searchCount > 0) {
      submitDeparturePointToRoom(storageRoomData.roomId, searchForm);
      return;
    }

    createRoom(searchForm);
  };

  const submitSearch = (searchForm: SearchState) => {
    if (isIndividualView) {
      submitIndividualSearch(searchForm);
      return;
    }

    submitTogetherSearch(searchForm);
  };

  return {
    isIndividualView,
    searchCount,
    submitSearch,
  };
}
