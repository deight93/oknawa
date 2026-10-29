import SearchView from '@/views/search/SearchView';

interface SearchPageProps {
  searchParams?: Promise<{
    roomId?: string | string[];
  }>;
}

const toSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  return (
    <SearchView
      type="together"
      shareRoomId={toSearchParam(params?.roomId) ?? null}
    />
  );
}
