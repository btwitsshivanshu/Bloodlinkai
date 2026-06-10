import { useState, useMemo, useEffect, useCallback } from 'react';
import { BASE } from '../utils/api';
import { useApp } from '../context/AppContext';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon paths (Leaflet + bundler issue)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function createColorIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="background:#2563eb;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,.3),0 2px 6px rgba(0,0,0,.3)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function LocationSetter({ onLocationSet }: { onLocationSet: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSet(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function NearbyDonors({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { requests, user, startConversation } = useApp();
  const [localDonors, setLocalDonors] = useState<any[]>([]);
  const [fetchingDonors, setFetchingDonors] = useState(false);
  const [filterBlood, setFilterBlood] = useState<string>('all');
  const [center, setCenter] = useState<[number, number]>([28.6139, 77.209]);
  const [zoom, setZoom] = useState(11);
  const [citySearch, setCitySearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState('');

  const searchCity = async (query: string) => {
    if (!query.trim()) {
      setFilterCity('');
      return;
    }
    setFilterCity(query.trim());
    setSearching(true);
    setLocationError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setZoom(12);
      } else {
        setLocationError('Location not found');
      }
    } catch {
      setLocationError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Fetch all available donors once on mount (no geo restriction)
  const fetchAllDonors = useCallback(async () => {
    setFetchingDonors(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE}/donors/compatible`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLocalDonors(data.donors || []);
      }
    } catch { /* silently fail */ } finally {
      setFetchingDonors(false);
    }
  }, []);

  useEffect(() => {
    fetchAllDonors();
  }, [fetchAllDonors]);

  // Handle click on map to set location
  const handleMapClick = (lat: number, lng: number) => {
    setCenter([lat, lng]);
  };

  const nearbyDonors = useMemo(() => {
    const cityLower = filterCity.toLowerCase().trim();
    if (!cityLower) return [];
    return localDonors
      .filter(d => {
        const uid = d.userId?._id || d.userId;
        return uid !== user?.id && d.userId?.email !== user?.email;
      })
      .map(d => {
        // Always use map center (geocoded city) for position — stored DB coords are unreliable
        const lat = center[0];
        const lng = center[1];
        const name = d.userId?.name || d.userName || d.name || 'Unknown Donor';
        const phone = d.userId?.phone || d.phone || '';
        const donorUserId = d.userId?._id || d.userId || '';
        return { ...d, lat, lng, name, address: d.address || '', phone, donorUserId };
      })
      .filter(d => d.address.toLowerCase().includes(cityLower))
      .filter(d => filterBlood === 'all' || d.bloodGroup === filterBlood);
  }, [localDonors, filterBlood, filterCity, center, user]);

  const openRequests = useMemo(() => {
    return requests.filter(r => r.status === 'open');
  }, [requests]);



  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nearby Donors</h1>
          <p className="text-gray-500">Find donors within your area</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Blood:</label>
            <select
              value={filterBlood}
              onChange={e => setFilterBlood(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="all">All Types</option>
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={citySearch}
                onChange={e => { setCitySearch(e.target.value); if (!e.target.value) setFilterCity(''); }}
                onKeyDown={e => { if (e.key === 'Enter') searchCity(citySearch); }}
                placeholder="Enter city or area..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:border-red-500 w-44"
              />
              {searching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={() => searchCity(citySearch)}
              disabled={searching}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              Go
            </button>
            {locationError && <span className="text-xs text-red-500">{locationError}</span>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="h-[500px]">
            <MapContainer
              center={center}
              zoom={zoom}
              className="w-full h-full z-0"
              scrollWheelZoom
            >
              <MapUpdater center={center} zoom={zoom} />
              <LocationSetter onLocationSet={handleMapClick} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              
              {/* User location */}
              <Marker position={center} icon={userIcon}>
                <Popup>Your location</Popup>
              </Marker>

              {/* Donor markers */}
              {nearbyDonors.map((d) => (
                <Marker
                  key={d.donorUserId || d.userId}
                  position={[d.lat, d.lng]}
                  icon={createColorIcon(d.available ? '#22c55e' : '#9ca3af', d.bloodGroup.replace(/[+-]/g, ''))}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{d.name}</p>
                      <p>Blood: {d.bloodGroup}</p>
                      {d.address && <p className="text-gray-500">{d.address}</p>}
                      {d.phone && <a href={`tel:${d.phone}`} className="text-blue-600">📞 {d.phone}</a>}
                      <p className={d.available ? 'text-green-600' : 'text-gray-500'}>
                        {d.available ? 'Available' : 'Unavailable'}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Hospital request markers */}
              {openRequests.map((req) => (
                <Marker
                  key={req.id}
                  position={[req.lat, req.lng]}
                  icon={createColorIcon('#f97316', 'H')}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{req.hospital}</p>
                      <p>Needs: {req.bloodGroup} ({req.units} units)</p>
                      <p className="capitalize">{req.urgency} urgency</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{nearbyDonors.length} donor{nearbyDonors.length !== 1 ? 's' : ''} found{filterCity ? ` in "${filterCity}"` : ''} • Click map to set location</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-full inline-block" /> You</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" /> Available</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-400 rounded-full inline-block" /> Unavailable</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-orange-500 rounded-full inline-block" /> Hospital</span>
            </div>
          </div>
        </div>

        {/* Nearby Donors List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Nearby Donors ({nearbyDonors.length})</h3>
          </div>
          <div className="overflow-y-auto max-h-[500px] divide-y divide-gray-50">
            {nearbyDonors.map((d, idx) => (
              <div key={d.userId} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                      d.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {d.bloodGroup}
                    </div>
                    <span className="absolute -top-1 -left-1 text-xs font-bold bg-gray-800 text-white w-5 h-5 rounded-full flex items-center justify-center">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800">{d.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="truncate max-w-[120px]">{d.address || 'No address'}</span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.available ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    </div>
                    {d.phone && (
                      <a href={`tel:${d.phone}`} className="text-xs text-blue-600 hover:underline mt-0.5 block">📞 {d.phone}</a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs text-gray-400">{d.totalDonations} donations</p>
                    <button
                      onClick={() => { startConversation(d.donorUserId, d.name); if (onNavigate) onNavigate('chat'); }}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg transition"
                    >
                      💬 Message
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {fetchingDonors && (
              <div className="p-8 text-center text-gray-400">
                <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading donors...</p>
              </div>
            )}
            {!fetchingDonors && nearbyDonors.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
                <p className="text-sm">{filterCity ? `No donors found in "${filterCity}"` : 'Enter a city or area to find donors'}</p>
                <p className="text-xs mt-1">{filterCity ? 'Try a different city or clear the search' : 'Type in the search box and press Go'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

