// ============================================================
// Geocoding — Nominatim OpenStreetMap API
// ============================================================

interface GeoResult {
  lat: number;
  lng: number;
}

// Known city fallbacks so we don't spam the API for common inputs
const CITY_FALLBACKS: Record<string, GeoResult> = {
  'delhi': { lat: 28.6139, lng: 77.209 },
  'new delhi': { lat: 28.6139, lng: 77.209 },
  'mumbai': { lat: 19.076, lng: 72.8777 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'hyderabad': { lat: 17.385, lng: 78.4867 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'new york': { lat: 40.7128, lng: -74.006 },
  'london': { lat: 51.5074, lng: -0.1278 },
};

export async function geocodeAddress(address: string): Promise<GeoResult> {
  if (!address.trim()) return { lat: 28.6139, lng: 77.209 };

  // Check local fallbacks first
  const lower = address.toLowerCase().trim();
  for (const [city, coords] of Object.entries(CITY_FALLBACKS)) {
    if (lower.includes(city)) return coords;
  }

  try {
    const params = new URLSearchParams({ q: address, format: 'json', limit: '1' });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'BloodLinkAI/1.0' },
    });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // Nominatim failed, fall through to default
  }

  return { lat: 28.6139, lng: 77.209 }; // Default: New Delhi
}
