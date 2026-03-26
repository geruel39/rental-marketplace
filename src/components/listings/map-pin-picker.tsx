"use client";

// ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// The previous "map" was a fake CSS-gradient <button> with zero real-map tiles.
// This component replaces it with a real Leaflet / OpenStreetMap tile map.
//
// KEY FIXES applied here:
//  1. Leaflet CSS is imported at the top – without it the map renders blank.
//  2. Leaflet's default marker icons rely on relative asset paths that break
//     under webpack; we patch them with explicit CDN URLs.
//  3. The whole component MUST be dynamically imported with { ssr: false } by
//     the parent – Leaflet reads `window` on import and crashes during SSR.
// ─────────────────────────────────────────────────────────────────────────────

// FIX #1 – Leaflet stylesheet MUST be imported or the map tiles show but all
// controls (zoom buttons, attribution, popup arrows) are misplaced / hidden.
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

// FIX #2 – Patch Leaflet's broken default icon paths.
// webpack renames & hashes the PNG assets that Leaflet expects at hardcoded
// relative paths, so default markers come out as broken-image boxes.
// Pointing directly at the unpkg CDN avoids the build-time asset issue.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapPinPickerValue {
  latitude: number;
  longitude: number;
  /** Human-readable address returned by reverse-geocoding (may be empty). */
  address: string;
}

interface MapPinPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (value: MapPinPickerValue) => void;
}

// ─── Nominatim helpers (free OpenStreetMap geocoding – no API key needed) ────

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "rental-marketplace/1.0 (contact@example.com)";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return "";
    const data = await res.json();
    return (data as { display_name?: string }).display_name ?? "";
  } catch {
    return "";
  }
}

async function searchAddress(query: string): Promise<NominatimResult[]> {
  if (query.trim().length < 3) return [];
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=0`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Flies the map view to a given position + zoom when `center` changes. */
function FlyToPosition({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1 });
  }, [center, zoom, map]);
  return null;
}

/** Listens to map click events and calls `onMapClick`. */
function ClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapPinPicker({ latitude, longitude, onChange }: MapPinPickerProps) {
  // Use Number.isFinite() — typeof NaN === "number" is true in JS, so a plain
  // typeof check would treat an unset form field (which coerces to NaN) as a
  // valid coordinate and pass [NaN, NaN] to Leaflet → "Invalid LatLng" error.
  const hasExistingPin =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  // Default center: use existing pin, or world center (geolocation will fly
  // the map to the real position once the browser resolves it).
  const defaultCenter: [number, number] = hasExistingPin
    ? [latitude as number, longitude as number]
    : [20, 0]; // neutral world center while we wait for geolocation

  const [pin, setPin] = useState<[number, number] | null>(
    hasExistingPin ? [latitude as number, longitude as number] : null,
  );
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Address search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Place pin & emit onChange (with reverse geocoding) ──────────────────
  const placePin = useCallback(
    async (lat: number, lng: number, knownAddress?: string) => {
      const coords: [number, number] = [lat, lng];
      setPin(coords);
      const address = knownAddress ?? (await reverseGeocode(lat, lng));
      onChange({ latitude: lat, longitude: lng, address });
    },
    [onChange],
  );

  // ── Geolocation ──────────────────────────────────────────────────────────
  const flyToMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setGeoLoading(false);
        setFlyTo({ center: [lat, lng], zoom: 14 });
      },
      () => {
        setGeoLoading(false);
        setGeoError("Location access denied. Allow it in your browser settings.");
      },
      { timeout: 8000 },
    );
  }, []);

  // Automatically fly to the user's location on first load (only if no
  // existing pin/coords were passed in as props).
  useEffect(() => {
    if (!hasExistingPin) {
      flyToMyLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Address search (debounced 300 ms, Nominatim 1 req/s policy) ─────────
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchAddress(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSearchLoading(false);
    }, 300);
  };

  const handleSuggestionSelect = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setQuery(result.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setFlyTo({ center: [lat, lng], zoom: 15 });
    placePin(lat, lng, result.display_name);
  };

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      placePin(lat, lng);
    },
    [placePin],
  );

  return (
    <div className="space-y-3">
      {/* ── Search bar + "Use my location" button row ──────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="relative flex items-center">
          <svg
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search for an address…"
            type="text"
            value={query}
          />
          {searchLoading && (
            <div className="absolute right-3 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          )}
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && (
            <ul className="absolute z-[9999] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover py-1 text-sm shadow-lg">
              {suggestions.map((result) => (
                <li key={result.place_id}>
                  <button
                    className="w-full px-3 py-2 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSuggestionSelect(result);
                    }}
                    type="button"
                  >
                    {result.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Use my location button */}
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition hover:bg-accent disabled:opacity-50"
          disabled={geoLoading}
          onClick={flyToMyLocation}
          title="Center map on my location"
          type="button"
        >
          {geoLoading ? (
            <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          ) : (
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          )}
          <span className="hidden sm:inline">{geoLoading ? "Locating…" : "My location"}</span>
        </button>
      </div>

      {/* Geolocation error */}
      {geoError && (
        <p className="text-xs text-destructive">{geoError}</p>
      )}

      {/* ── Leaflet map ────────────────────────────────────────────── */}
      {/* FIX #3 – explicit height is MANDATORY. Without a fixed height the map
          container collapses to 0px and renders completely blank. */}
      <div className="overflow-hidden rounded-2xl border border-border shadow-sm" style={{ height: 360 }}>
        <MapContainer
          center={defaultCenter}
          zoom={pin ? 14 : 5}
          style={{ height: "100%", width: "100%" }}
          // Prevent the map scroll from hijacking page scroll
          scrollWheelZoom={true}
        >
          {/* OpenStreetMap tiles – free, no API key required */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Click-to-pin */}
          <ClickHandler onMapClick={handleMapClick} />

          {/* Smooth fly-to when user picks an address from search */}
          {flyTo && <FlyToPosition center={flyTo.center} zoom={flyTo.zoom} />}

          {/* Draggable marker */}
          {pin && (
            <Marker
              draggable
              eventHandlers={{
                dragend(e) {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  placePin(lat, lng);
                },
              }}
              position={pin}
            />
          )}
        </MapContainer>
      </div>

      {/* ── Coordinate readout ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {pin
            ? `Pinned at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`
            : "Click the map to drop a pin"}
        </span>
        {pin && (
          <button
            className="text-xs text-destructive hover:underline"
            onClick={() => {
              setPin(null);
              setQuery("");
            }}
            type="button"
          >
            Remove pin
          </button>
        )}
      </div>
    </div>
  );
}
