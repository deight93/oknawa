export function normalizeStationName(fullName: string): string {
    return fullName.split(" ")[0].trim();
}
