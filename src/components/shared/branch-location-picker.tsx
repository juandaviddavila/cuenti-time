"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

const DEFAULT_CENTER = { lat: 6.25184, lng: -75.56359 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "280px" };

export interface BranchLocationValue {
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  googlePlaceId?: string;
}

interface BranchLocationPickerProps {
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
  onChange: (value: BranchLocationValue) => void;
}

function roundCoord(value: number): number {
  return Number(value.toFixed(6));
}

function extractCityFromPlace(place: google.maps.places.Place): string | undefined {
  const components = place.addressComponents;
  if (!components) return undefined;

  return (
    components.find((c) => c.types.includes("locality"))?.longText ??
    components.find((c) => c.types.includes("administrative_area_level_2"))?.longText ??
    components.find((c) => c.types.includes("administrative_area_level_1"))?.longText ??
    undefined
  );
}

function getValidCoords(
  lat?: number,
  lng?: number
): google.maps.LatLngLiteral | null {
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  ) {
    return { lat, lng };
  }
  return null;
}

function AddressSearchInput({
  onPlaceSelect,
}: {
  onPlaceSelect: (value: BranchLocationValue) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;

        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ["co"],
            language: "es",
            sessionToken: sessionTokenRef.current,
          });

        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction) return;

      try {
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ["id", "formattedAddress", "location", "addressComponents", "displayName"],
        });

        const location = place.location;
        if (!location) return;

        setQuery(place.formattedAddress ?? prediction.text.text);
        setIsOpen(false);
        setSuggestions([]);
        sessionTokenRef.current = null;

        onPlaceSelect({
          latitude: roundCoord(location.lat()),
          longitude: roundCoord(location.lng()),
          address: place.formattedAddress ?? place.displayName ?? undefined,
          city: extractCityFromPlace(place),
          googlePlaceId: place.id ?? undefined,
        });
      } catch {
        setIsOpen(false);
      }
    },
    [onPlaceSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder="Escribe una dirección y selecciona un resultado..."
        className="pl-9"
      />
      {isOpen && (
        <ul className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-56 overflow-y-auto">
          {isSearching && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Buscando...</li>
          )}
          {suggestions.map((suggestion, index) => {
            const text = suggestion.placePrediction?.text.text ?? "";
            return (
              <li key={`${text}-${index}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => void handleSelect(suggestion)}
                >
                  {text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function BranchLocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
}: BranchLocationPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "branch-location-map",
    googleMapsApiKey: apiKey,
    language: "es",
    region: "CO",
  });

  const savedPosition = useMemo(
    () => getValidCoords(latitude, longitude),
    [latitude, longitude]
  );

  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);

  useEffect(() => {
    if (savedPosition) {
      setMarkerPosition(savedPosition);
    }
  }, [savedPosition]);

  const updatePosition = useCallback(
    (lat: number, lng: number, extra?: Omit<BranchLocationValue, "latitude" | "longitude">) => {
      const next = { lat: roundCoord(lat), lng: roundCoord(lng) };
      setMarkerPosition(next);
      onChange({
        latitude: next.lat,
        longitude: next.lng,
        ...extra,
      });
    },
    [onChange]
  );

  const onPlaceSelect = useCallback(
    (value: BranchLocationValue) => {
      if (value.latitude !== undefined && value.longitude !== undefined) {
        setMarkerPosition({ lat: value.latitude, lng: value.longitude });
      }
      onChange(value);
    },
    [onChange]
  );

  const onMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      updatePosition(event.latLng.lat(), event.latLng.lng());
    },
    [updatePosition]
  );

  const onMarkerDragEnd = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      updatePosition(event.latLng.lat(), event.latLng.lng());
    },
    [updatePosition]
  );

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Configura <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para ver el
        mapa interactivo.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive space-y-2">
        <p>No se pudo cargar Google Maps.</p>
        <p className="text-xs">
          Si ves <strong>RefererNotAllowedMapError</strong>, agrega{" "}
          <code>http://localhost:7578/*</code> en las restricciones de la API key que usa la app.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-[280px] rounded-lg bg-muted animate-pulse" />;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm">Buscar dirección</Label>
        <AddressSearchInput onPlaceSelect={onPlaceSelect} />
        <p className="text-xs text-muted-foreground">
          Arrastra el pin rojo o haz clic en el mapa para ajustar la ubicación exacta.
        </p>
      </div>

      <div className="rounded-lg overflow-hidden border">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={markerPosition}
          zoom={16}
          onClick={onMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPosition}
            draggable
            onDragEnd={onMarkerDragEnd}
          />
          <Circle
            center={markerPosition}
            radius={radiusMeters}
            options={{
              fillColor: "#f97316",
              fillOpacity: 0.15,
              strokeColor: "#f97316",
              strokeOpacity: 0.85,
              strokeWeight: 2,
            }}
          />
        </GoogleMap>
      </div>
    </div>
  );
}
