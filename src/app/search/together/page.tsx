import SearchView from '@/views/search/SearchView';

interface SearchPageProps {
  searchParams?: {
    roomId?: string | string[];
  };
}

const toSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <SearchView
      type="together"
      shareRoomId={toSearchParam(searchParams?.roomId) ?? null}
    />
  );
}
