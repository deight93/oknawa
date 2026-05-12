type Coordinate = { start_x: number; start_y: number };

export function getCenterCoordinates(participants: Coordinate[]): [number, number] {
    const total = participants.reduce(
        (acc, p) => {
            acc.x += p.start_x;
            acc.y += p.start_y;
            return acc;
        },
        { x: 0, y: 0 }
    );

    const count = participants.length;
    return [total.x / count, total.y / count];
}

export function getCenterLocations(
    centerCoordinates: [number, number],
    stations: any[],
    priority: number
) {
    const [centerX, centerY] = centerCoordinates;

    const withDistance = stations.map((station) => {
        const distance = Math.sqrt(
            Math.pow(centerX - parseFloat(station.location_x), 2) +
            Math.pow(centerY - parseFloat(station.location_y), 2)
        );
        return { station, distance };
    });

    return withDistance
        .sort((a, b) => a.distance - b.distance)
        .slice(0, priority)
        .map((item) => item.station);
}
