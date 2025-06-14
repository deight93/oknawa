import polyline from "https://esm.sh/@mapbox/polyline";
import { getEnv } from "./env";

const GOOGLE_API_KEY = getEnv("GOOGLE_API_KEY");
const GOOGLE_API_URL = getEnv("GOOGLE_API_URL");

export async function callGoogleMapItineraries(participants: any[], stations: any[]) {
    const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.polyline.encodedPolyline",
    };

    const stationInfoList = [];

    for (const station of stations) {
        const itineraryList = [];

        for (const participant of participants) {
            const origin = {
                location: {
                    latLng: {
                        latitude: participant.start_y,
                        longitude: participant.start_x,
                    },
                },
            };

            const destination = {
                location: {
                    latLng: {
                        latitude: parseFloat(station.location_y),
                        longitude: parseFloat(station.location_x),
                    },
                },
            };

            const payload = {
                origin,
                destination,
                travelMode: "TRANSIT",
                transitPreferences: {
                    allowedTravelModes: ["SUBWAY"],
                },
                languageCode: "ko-KR",
            };

            const response = await fetch(`${GOOGLE_API_URL}/directions/v2:computeRoutes`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });

            const json = await response.json();

            const route = json.routes?.[0];
            if (!route) continue;

            const durationSeconds = parseDuration(route.duration);
            const polylineEncoded = route.polyline?.encodedPolyline;
            const decodedPolyline = polyline.decode(polylineEncoded);
            const totalPolyline = decodedPolyline.map(([lat, lng]) => ({ lat, lng }));

            itineraryList.push({
                name: participant.name,
                region_name: participant.region_name,
                itinerary: {
                    totalTime: durationSeconds,
                    total_polyline: totalPolyline,
                },
            });
        }

        stationInfoList.push({
            station_name: station.name,
            address_name: station.address,
            end_x: station.location_x,
            end_y: station.location_y,
            itinerary: itineraryList,
        });
    }

    return stationInfoList;
}

function parseDuration(durationStr: string): number {
    return parseInt(durationStr.replace("s", ""));
}
