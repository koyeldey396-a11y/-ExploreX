import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getPlaces } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

// Fix Leaflet's default marker asset URLs in Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom styled map pins for Start, Waypoints, Destination, and Landmarks
const createPinIcon = (color, label, symbol) => {
  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="
        background: ${color};
        color: white;
        border: 2px solid white;
        border-radius: 20px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transform: translate(-50%, -100%);
      ">
        <span>${symbol}</span>
        <span>${label}</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Fallback coordinates for common destinations / cities if unassigned
const DEFAULT_COORDS = {
  lat: 28.6139, // New Delhi center
  lng: 77.209,
};

const CITY_COORDS = {
  delhi: { lat: 28.6139, lng: 77.209 },
  manali: { lat: 32.2432, lng: 77.1892 },
  shimla: { lat: 31.1048, lng: 77.1734 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  agra: { lat: 27.1767, lng: 78.0081 },
  goa: { lat: 15.2993, lng: 74.124 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  amritsar: { lat: 31.634, lng: 74.8723 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  rishikesh: { lat: 30.0869, lng: 78.2676 },
  darjeeling: { lat: 27.041, lng: 88.2663 },
  srinagar: { lat: 34.0837, lng: 74.7973 },
  kashmir: { lat: 34.0837, lng: 74.7973 },
  gulmarg: { lat: 34.0484, lng: 74.3805 },
  leh: { lat: 34.1526, lng: 77.5771 },
  ladakh: { lat: 34.1526, lng: 77.5771 },
  munnar: { lat: 10.0889, lng: 77.0595 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  ooty: { lat: 11.4102, lng: 76.695 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  paris: { lat: 48.8566, lng: 2.3522 },
  london: { lat: 51.5074, lng: -0.1278 },
  switzerland: { lat: 46.8182, lng: 8.2275 },
};

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs} hr ${mins} min`;
  }
  return `${mins} min`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function Navigate() {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const requestedPlaceId = searchParams.get("destination");
  const queryLat = parseFloat(searchParams.get("lat"));
  const queryLng = parseFloat(searchParams.get("lng"));
  const queryName = searchParams.get("name");
  const stopsParam = searchParams.get("stops");

  const [places, setPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  // Multi-Stop Waypoints list [{ id, name, lat, lng, isHub }]
  const [waypoints, setWaypoints] = useState([]);

  // Fallback 2-point state
  const [startPoint, setStartPoint] = useState(null); // { lat, lng, name, isCurrentLocation }
  const [destinationPoint, setDestinationPoint] = useState(null); // { lat, lng, name, placeObj }

  // Routing Strategy: "shortest" (distance/TSP), "fastest" (time), "fixed" (sequential)
  const [routeStrategy, setRouteStrategy] = useState("shortest");

  // Geolocation state
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  // Routing state
  const [routing, setRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeError, setRouteError] = useState("");

  // Ride booking modal / panel state
  const [showRidePanel, setShowRidePanel] = useState(false);

  // Leaflet refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const waypointMarkersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [DEFAULT_COORDS.lat, DEFAULT_COORDS.lng],
        zoom: 6,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Layer groups for markers, waypoints, and polyline
      markersLayerRef.current = L.layerGroup().addTo(map);
      waypointMarkersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      // Click on map to add waypoint or set start point
      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        const name = `Map Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        setWaypoints((prev) => {
          if (prev.length > 0) {
            return [
              ...prev,
              { id: `stop-${Date.now()}-${Math.random()}`, name, lat, lng },
            ];
          } else {
            return [
              { id: `stop-start-${Date.now()}`, name: `Start (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng },
            ];
          }
        });
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fetch ExploreX Places for catalog selection
  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        setLoadingPlaces(true);
        const data = await getPlaces();
        const list = Array.isArray(data) ? data : [];
        setPlaces(list);

        // If direct coordinates or single destination requested in URL query (without stops)
        if (!stopsParam) {
          if (!isNaN(queryLat) && !isNaN(queryLng)) {
            const dest = {
              _id: "query-dest",
              name: queryName || "Selected Destination",
              latitude: queryLat,
              longitude: queryLng,
              city: queryName || "",
            };
            selectDestination(dest);
          } else if (requestedPlaceId && list.length > 0) {
            const match = list.find((p) => String(p._id) === String(requestedPlaceId));
            if (match) {
              selectDestination(match);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load destinations for map:", err);
      } finally {
        setLoadingPlaces(false);
      }
    };

    fetchDestinations();
  }, [requestedPlaceId, queryLat, queryLng, stopsParam]);

  // Parse multi-stops from query parameter
  useEffect(() => {
    if (stopsParam) {
      try {
        const parsed = JSON.parse(stopsParam);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validStops = parsed
            .filter(
              (s) =>
                s &&
                typeof s.lat === "number" &&
                typeof s.lng === "number" &&
                isFinite(s.lat) &&
                isFinite(s.lng) &&
                Math.abs(s.lat) <= 90 &&
                Math.abs(s.lng) <= 180
            )
            .map((s, idx) => ({
              id: `stop-${idx}-${Date.now()}`,
              name: s.name || `Stop ${idx + 1}`,
              lat: s.lat,
              lng: s.lng,
              isHub: !!s.isHub,
            }));

          // Deduplicate consecutive identical points
          const deduped = validStops.filter((s, idx, arr) => {
            if (idx === 0) return true;
            const prev = arr[idx - 1];
            return (
              Math.abs(s.lat - prev.lat) > 0.0001 ||
              Math.abs(s.lng - prev.lng) > 0.0001
            );
          });

          if (deduped.length > 0) {
            setWaypoints(deduped);
            setStartPoint({
              lat: deduped[0].lat,
              lng: deduped[0].lng,
              name: deduped[0].name,
            });
            if (deduped.length > 1) {
              setDestinationPoint({
                lat: deduped[deduped.length - 1].lat,
                lng: deduped[deduped.length - 1].lng,
                name: deduped[deduped.length - 1].name,
              });
            }
          }
        }
      } catch (err) {
        console.warn("Failed to parse stops query parameter:", err);
      }
    }
  }, [stopsParam]);

  // Resolve coordinate helper
  const resolveCoordinates = (place) => {
    if (
      place.latitude != null &&
      place.longitude != null &&
      !isNaN(place.latitude) &&
      !isNaN(place.longitude)
    ) {
      return { lat: Number(place.latitude), lng: Number(place.longitude) };
    }
    const cityKey = place.city?.toLowerCase().trim();
    if (cityKey && CITY_COORDS[cityKey]) {
      return CITY_COORDS[cityKey];
    }
    const nameKey = place.name?.toLowerCase().trim();
    if (nameKey && CITY_COORDS[nameKey]) {
      return CITY_COORDS[nameKey];
    }
    const combined = `${place.name || ""} ${place.city || ""} ${place.state || ""}`.toLowerCase();
    for (const [key, coords] of Object.entries(CITY_COORDS)) {
      if (combined.includes(key)) {
        return coords;
      }
    }
    return null;
  };

  // Plot places as markers on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    places.forEach((place) => {
      const coords = resolveCoordinates(place);
      if (!coords) return;

      const markerIcon = createPinIcon("#174c3c", place.name, "📍");
      const marker = L.marker([coords.lat, coords.lng], { icon: markerIcon });

      const popupHtml = `
        <div style="min-width: 180px; font-family: inherit;">
          ${
            place.image
              ? `<img src="${place.image}" alt="${place.name}" style="width:100%; height:110px; object-fit:cover; border-radius:6px; margin-bottom:6px;" onerror="this.style.display='none'"/>`
              : ""
          }
          <strong style="font-size:14px; color:#174c3c;">${place.name}</strong>
          <p style="margin:4px 0; font-size:12px; color:#555;">${place.description?.slice(0, 80) || ""}...</p>
          <p style="margin:2px 0; font-size:11px; color:#777;">📍 ${[place.city, place.country].filter(Boolean).join(", ")}</p>
          <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">
            <button id="add-stop-${place._id}" style="
              width: 100%;
              background: #174c3c;
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              font-size: 11px;
              cursor: pointer;
            ">+ ${t("nav_page_add_as_stop")}</button>
            <button id="select-dest-${place._id}" style="
              width: 100%;
              background: #b47a45;
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              font-size: 11px;
              cursor: pointer;
            ">${t("nav_page_set_as_dest")}</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on("popupopen", () => {
        const addBtn = document.getElementById(`add-stop-${place._id}`);
        if (addBtn) {
          addBtn.onclick = () => {
            addWaypointFromPlace(place);
            marker.closePopup();
          };
        }
        const selectBtn = document.getElementById(`select-dest-${place._id}`);
        if (selectBtn) {
          selectBtn.onclick = () => {
            selectDestination(place);
            marker.closePopup();
          };
        }
      });

      layer.addLayer(marker);
    });
  }, [places]);

  // Update Waypoint Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = waypointMarkersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (waypoints.length > 0) {
      waypoints.forEach((wp, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === waypoints.length - 1;
        const color = isFirst ? "#27ae60" : isLast ? "#c0392b" : "#b47a45";
        const symbol = isFirst ? "🚩" : isLast ? "🏁" : `${idx + 1}`;

        const icon = createPinIcon(color, `${idx + 1}. ${wp.name}`, symbol);
        const m = L.marker([wp.lat, wp.lng], { icon });

        m.bindPopup(`
          <div style="font-family: inherit; min-width: 160px;">
            <span style="font-size:11px; font-weight:bold; color:${color};">Stop #${idx + 1} ${isFirst ? "(Start)" : isLast ? "(Endpoint)" : ""}</span>
            <h4 style="margin:4px 0; color:#174c3c;">${wp.name}</h4>
            <p style="margin:2px 0; font-size:11px; color:#666;">Coords: ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}</p>
            <button id="del-wp-${idx}" style="
              margin-top: 6px;
              background: #e74c3c;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              cursor: pointer;
            ">${t("nav_page_remove_stop")}</button>
          </div>
        `);

        m.on("popupopen", () => {
          const delBtn = document.getElementById(`del-wp-${idx}`);
          if (delBtn) {
            delBtn.onclick = () => {
              removeWaypoint(idx);
              m.closePopup();
            };
          }
        });

        layer.addLayer(m);
      });

      const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [waypoints]);

  // Fallback 2-point markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || waypoints.length > 0) return;

    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (startPoint) {
      const icon = createPinIcon("#27ae60", startPoint.name || "Start", "🚩");
      const m = L.marker([startPoint.lat, startPoint.lng], { icon }).addTo(map);
      m.bindPopup(`<strong>Starting Point:</strong><br/>${startPoint.name}`);
      startMarkerRef.current = m;
    }

    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
    if (destinationPoint) {
      const icon = createPinIcon("#c0392b", destinationPoint.name, "🏁");
      const m = L.marker([destinationPoint.lat, destinationPoint.lng], { icon }).addTo(map);
      m.bindPopup(`<strong>Destination:</strong><br/>${destinationPoint.name}`);
      destMarkerRef.current = m;
    }
  }, [startPoint, destinationPoint, waypoints]);

  // Waypoint Management functions
  const moveWaypointUp = (index) => {
    if (index <= 0) return;
    setWaypoints((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    setRouteInfo(null);
  };

  const moveWaypointDown = (index) => {
    if (index >= waypoints.length - 1) return;
    setWaypoints((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    setRouteInfo(null);
  };

  const removeWaypoint = (index) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
    setRouteInfo(null);
  };

  const clearAllWaypoints = () => {
    setWaypoints([]);
    setStartPoint(null);
    setDestinationPoint(null);
    setRouteInfo(null);
    setRouteError("");
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
  };

  const addWaypointFromPlace = (place) => {
    const coords = resolveCoordinates(place);
    if (!coords) {
      setRouteError(`Geographic coordinates could not be resolved for ${place.name}.`);
      return;
    }
    const newStop = {
      id: `stop-${Date.now()}-${Math.random()}`,
      name: place.name,
      lat: coords.lat,
      lng: coords.lng,
    };
    setWaypoints((prev) => [...prev, newStop]);
    setRouteInfo(null);
    setRouteError("");
  };

  // Select a destination (legacy 2-point mode or append to waypoints)
  const selectDestination = (place) => {
    let coords = resolveCoordinates(place);
    if (!coords) {
      setRouteError(
        `Geographic coordinates for "${place.name}" could not be resolved. You can click a point on the map.`
      );
      coords = DEFAULT_COORDS;
    } else {
      setRouteError("");
    }

    const newDest = {
      lat: coords.lat,
      lng: coords.lng,
      name: place.name,
      placeObj: place,
    };

    setDestinationPoint(newDest);

    // If waypoints is empty, seed start and destination
    if (waypoints.length === 0) {
      if (startPoint) {
        setWaypoints([
          { id: `stop-start`, name: startPoint.name, lat: startPoint.lat, lng: startPoint.lng },
          { id: `stop-dest`, name: newDest.name, lat: newDest.lat, lng: newDest.lng },
        ]);
      } else {
        setWaypoints([
          { id: `stop-dest`, name: newDest.name, lat: newDest.lat, lng: newDest.lng },
        ]);
      }
    } else {
      // Append destination as final waypoint
      setWaypoints((prev) => [
        ...prev,
        { id: `stop-${Date.now()}`, name: newDest.name, lat: newDest.lat, lng: newDest.lng },
      ]);
    }

    setRouteInfo(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([coords.lat, coords.lng], 12, { duration: 1.2 });
    }
  };

  // Browser Geolocation: Get User's Current Location
  const handleUseCurrentLocation = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const currentLoc = {
          id: `stop-current-${Date.now()}`,
          lat: latitude,
          lng: longitude,
          name: "My Current Location",
          isCurrentLocation: true,
        };

        setStartPoint(currentLoc);

        // Prepend or set as first waypoint
        setWaypoints((prev) => {
          if (prev.length > 0) {
            // Replace first if it was an earlier current location, or prepend
            if (prev[0].isCurrentLocation) {
              return [currentLoc, ...prev.slice(1)];
            }
            return [currentLoc, ...prev];
          }
          return [currentLoc];
        });

        setLocating(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 13, { duration: 1.2 });
        }
      },
      (err) => {
        setLocating(false);
        console.warn("Geolocation error:", err);
        if (err.code === 1) {
          setGeoError("Location permission was denied. You can click on the map or pick a starting city below.");
        } else if (err.code === 2) {
          setGeoError("Unable to acquire your position. Please check your network or device settings.");
        } else {
          setGeoError("Location request timed out. Please try again or select a city.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Calculate Practical Route using OSRM with True Shortest Distance Optimization
  const handleCalculateRoute = async () => {
    setRouteError("");
    setRouteInfo(null);

    // Determine effective points
    let points = [];
    if (waypoints.length >= 2) {
      points = [...waypoints];
    } else if (startPoint && destinationPoint) {
      points = [
        { name: startPoint.name || "Start", lat: startPoint.lat, lng: startPoint.lng },
        { name: destinationPoint.name || "Destination", lat: destinationPoint.lat, lng: destinationPoint.lng },
      ];
    } else {
      if (!startPoint && waypoints.length === 0) {
        setRouteError("Please set a starting point (use current location, select a city, or click on map).");
        return;
      }
      if (!destinationPoint && waypoints.length < 2) {
        setRouteError("Please add at least 2 waypoints or select a destination.");
        return;
      }
    }

    const validPoints = points.filter(
      (p) =>
        p &&
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        isFinite(p.lat) &&
        isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180
    );

    if (validPoints.length < 2) {
      setRouteError("At least two valid geographic coordinates are required to calculate a route.");
      return;
    }

    const map = mapInstanceRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();
    setRouting(true);

    try {
      const coordsStr = validPoints.map((p) => `${p.lng},${p.lat}`).join(";");

      // CASE A: 3+ Waypoints with Shortest Distance (TSP Optimization)
      if (validPoints.length >= 3 && routeStrategy === "shortest") {
        const tripUrl = `https://router.project-osrm.org/trip/v1/driving/${coordsStr}?roundtrip=false&source=first&overview=full&geometries=geojson&steps=true`;
        const response = await fetch(tripUrl);
        const data = await response.json();

        if (!response.ok || data.code !== "Ok" || !data.trips || data.trips.length === 0) {
          throw new Error(
            data.message ||
              "No drivable road route found between all selected waypoints. They may be across disconnected terrain."
          );
        }

        const bestTrip = data.trips[0];
        const distKm = (bestTrip.distance / 1000).toFixed(2);
        const timeFormatted = formatDuration(bestTrip.duration);

        // Reconstruct visiting sequence from TSP solution
        const optimizedSequence = [];
        data.waypoints.forEach((wp, origIdx) => {
          optimizedSequence[wp.waypoint_index] = {
            order: wp.waypoint_index + 1,
            name: validPoints[origIdx].name,
            lat: validPoints[origIdx].lat,
            lng: validPoints[origIdx].lng,
            origIndex: origIdx,
          };
        });

        setRouteInfo({
          isMultiStopTSP: true,
          strategy: "shortest",
          strategyLabel: "Shortest Distance (TSP Multi-Stop Optimized)",
          distanceKm: distKm,
          durationFormatted: timeFormatted,
          distanceMeters: bestTrip.distance,
          durationSeconds: bestTrip.duration,
          geometry: bestTrip.geometry,
          sequence: optimizedSequence,
          waypointsCount: validPoints.length,
        });

        // Draw GeoJSON polyline
        const geoJsonLayer = L.geoJSON(
          { type: "Feature", properties: {}, geometry: bestTrip.geometry },
          {
            style: {
              color: "#174c3c",
              weight: 6,
              opacity: 0.88,
              lineJoin: "round",
            },
          }
        );
        routeLayer.addLayer(geoJsonLayer);
        map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: 15 });
      } else {
        // CASE B: 2-Point Routing or Sequential Routing
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&alternatives=true&steps=true`;
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (!response.ok || data.code !== "Ok" || !data.routes || data.routes.length === 0) {
          throw new Error(
            data.message ||
              "No drivable road route found between these locations. They may be across disconnected terrain."
          );
        }

        const routes = data.routes;
        let shortest = routes[0];
        let fastest = routes[0];

        for (const r of routes) {
          if (r.distance < shortest.distance) shortest = r;
          if (r.duration < fastest.duration) fastest = r;
        }

        // Select chosen route according to routeStrategy
        const chosen = routeStrategy === "fastest" ? fastest : shortest;
        const chosenDistKm = (chosen.distance / 1000).toFixed(2);
        const chosenTime = formatDuration(chosen.duration);

        const shortestDistKm = (shortest.distance / 1000).toFixed(2);
        const shortestTime = formatDuration(shortest.duration);
        const fastestDistKm = (fastest.distance / 1000).toFixed(2);
        const fastestTime = formatDuration(fastest.duration);

        const hasAlternative = routes.length > 1 && shortest !== fastest;

        setRouteInfo({
          isMultiStopTSP: false,
          strategy: routeStrategy,
          strategyLabel:
            routeStrategy === "fastest"
              ? "Fastest Travel Time Route"
              : routeStrategy === "fixed"
              ? "Sequential Route (Fixed User Order)"
              : "Shortest Distance Route",
          distanceKm: chosenDistKm,
          durationFormatted: chosenTime,
          distanceMeters: chosen.distance,
          durationSeconds: chosen.duration,
          geometry: chosen.geometry,
          hasAlternative,
          shortest: { distanceKm: shortestDistKm, durationFormatted: shortestTime },
          fastest: { distanceKm: fastestDistKm, durationFormatted: fastestTime },
          waypointsCount: validPoints.length,
          sequence: validPoints.map((p, i) => ({
            order: i + 1,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
          })),
        });

        // Draw polyline
        const geoJsonLayer = L.geoJSON(
          { type: "Feature", properties: {}, geometry: chosen.geometry },
          {
            style: {
              color: "#174c3c",
              weight: 6,
              opacity: 0.88,
              lineJoin: "round",
            },
          }
        );
        routeLayer.addLayer(geoJsonLayer);
        map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: 15 });
      }
    } catch (err) {
      console.error("OSRM Route calculation error:", err);
      let straightDist = 0;
      for (let i = 0; i < validPoints.length - 1; i++) {
        straightDist += haversineDistance(
          validPoints[i].lat,
          validPoints[i].lng,
          validPoints[i + 1].lat,
          validPoints[i + 1].lng
        );
      }
      setRouteError(
        `${err.message || "Unable to compute route."} (Straight-line distance: ~${straightDist.toFixed(1)} km). You can also open the directions in Google Maps below.`
      );
    } finally {
      setRouting(false);
    }
  };

  // Generate Google Maps Directions URL (multi-stop capable)
  const getGoogleMapsUrl = () => {
    const points =
      waypoints.length >= 2
        ? waypoints
        : [startPoint, destinationPoint].filter(Boolean);

    if (points.length < 2) return "#";
    const path = points.map((p) => `${p.lat},${p.lng}`).join("/");
    return `https://www.google.com/maps/dir/${path}`;
  };

  // Generate External Ride Booking Deep Links
  const getUberUrl = () => {
    const pickup =
      waypoints.length > 0 ? waypoints[0] : startPoint;
    const dropoff =
      waypoints.length > 0 ? waypoints[waypoints.length - 1] : destinationPoint;

    if (!dropoff) return "https://m.uber.com/";

    const pickupLat = pickup ? pickup.lat : "";
    const pickupLng = pickup ? pickup.lng : "";
    const pickupName = pickup ? pickup.name : "My Location";
    const destLat = dropoff.lat;
    const destLng = dropoff.lng;
    const destName = dropoff.name;

    if (pickup) {
      return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}&pickup[nickname]=${encodeURIComponent(
        pickupName
      )}&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${encodeURIComponent(
        destName
      )}`;
    }
    return `https://m.uber.com/looking?dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${encodeURIComponent(
      destName
    )}`;
  };

  const getOlaUrl = () => {
    const pickup =
      waypoints.length > 0 ? waypoints[0] : startPoint;
    const dropoff =
      waypoints.length > 0 ? waypoints[waypoints.length - 1] : destinationPoint;

    if (!dropoff) return "https://book.olacabs.com/";

    const pickupLat = pickup ? pickup.lat : "";
    const pickupLng = pickup ? pickup.lng : "";
    const destLat = dropoff.lat;
    const destLng = dropoff.lng;
    const destName = dropoff.name;

    if (pickup) {
      return `https://book.olacabs.com/?lat=${pickupLat}&lng=${pickupLng}&drop_lat=${destLat}&drop_lng=${destLng}&d_name=${encodeURIComponent(
        destName
      )}`;
    }
    return `https://book.olacabs.com/?drop_lat=${destLat}&drop_lng=${destLng}&d_name=${encodeURIComponent(
      destName
    )}`;
  };

  return (
    <main className="navigate-page">
      <div className="navigate-header">
        <span className="ai-header-badge">🧭 {t("nav_page_badge")}</span>
        <h1>{t("nav_page_title")}</h1>
        <p>{t("nav_page_subtitle")}</p>
      </div>

      <div className="navigate-layout">
        {/* ================= LEFT CONTROLS PANEL ================= */}
        <aside className="navigate-sidebar">
          {/* 1. Multi-Stop Route Stops / Waypoints */}
          <div className="navigate-card waypoint-manager-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0 }}>📍 {t("nav_page_waypoints_title", { count: waypoints.length })}</h3>
              {waypoints.length > 0 && (
                <button
                  type="button"
                  className="clear-route-link-btn"
                  onClick={clearAllWaypoints}
                  title="Clear all waypoints"
                >
                  {t("nav_page_clear_all")}
                </button>
              )}
            </div>

            <p className="navigate-instruction">
              {t("nav_page_instruction")}
            </p>

            {/* Current GPS location button */}
            <button
              type="button"
              className="navigate-btn location-btn"
              onClick={handleUseCurrentLocation}
              disabled={locating}
            >
              {locating ? t("nav_page_acquiring_gps") : ("📍 " + t("nav_page_use_gps"))}
            </button>

            {geoError && <p className="error-message" style={{ marginTop: "8px" }}>{geoError}</p>}

            {/* List of active waypoints */}
            {waypoints.length > 0 ? (
              <div className="waypoints-list">
                {waypoints.map((wp, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === waypoints.length - 1;

                  return (
                    <div
                      key={wp.id || idx}
                      className={`waypoint-item-row ${isFirst ? "start" : isLast ? "end" : "stop"}`}
                    >
                      <div className="waypoint-badge-index">
                        {isFirst ? "🚩 1" : isLast ? `🏁 ${idx + 1}` : `${idx + 1}`}
                      </div>

                      <div className="waypoint-info">
                        <strong className="waypoint-title">{wp.name}</strong>
                        <span className="waypoint-coords">
                          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                        </span>
                      </div>

                      <div className="waypoint-controls">
                        <button
                          type="button"
                          className="wp-reorder-btn"
                          disabled={isFirst}
                          onClick={() => moveWaypointUp(idx)}
                          title="Move earlier"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="wp-reorder-btn"
                          disabled={isLast}
                          onClick={() => moveWaypointDown(idx)}
                          title="Move later"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="wp-remove-btn"
                          onClick={() => removeWaypoint(idx)}
                          title="Remove stop"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-waypoints-hint">
                <span>{t("nav_page_empty_waypoints")}</span>
              </div>
            )}

            {/* Quick city selector to set start or stop */}
            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "12px", color: "#666", fontWeight: "bold" }}>
                {t("nav_page_city_hub_label")}
              </label>
              <select
                className="navigate-select"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && CITY_COORDS[val]) {
                    const cityName = val.charAt(0).toUpperCase() + val.slice(1);
                    setWaypoints((prev) => [
                      ...prev,
                      {
                        id: `city-${val}-${Date.now()}`,
                        name: cityName,
                        lat: CITY_COORDS[val].lat,
                        lng: CITY_COORDS[val].lng,
                      },
                    ]);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  {t("nav_page_select_city")}
                </option>
                <option value="delhi">Delhi</option>
                <option value="agra">Agra</option>
                <option value="jaipur">Jaipur</option>
                <option value="hyderabad">Hyderabad</option>
                <option value="srinagar">Srinagar (Kashmir)</option>
                <option value="gulmarg">Gulmarg</option>
                <option value="mumbai">Mumbai</option>
                <option value="bengaluru">Bengaluru</option>
                <option value="kolkata">Kolkata</option>
                <option value="goa">Goa</option>
                <option value="manali">Manali</option>
              </select>
            </div>
          </div>

          {/* 2. Destination Catalog Selection */}
          <div className="navigate-card">
            <h3>{t("nav_page_catalog_title")}</h3>
            <p className="navigate-instruction">
              {t("nav_page_catalog_instruction")}
            </p>

            {loadingPlaces ? (
              <p>{t("nav_page_loading_dest")}</p>
            ) : (
              <select
                className="navigate-select"
                defaultValue=""
                onChange={(e) => {
                  const place = places.find((p) => String(p._id) === e.target.value);
                  if (place) {
                    addWaypointFromPlace(place);
                    e.target.value = "";
                  }
                }}
              >
                <option value="" disabled>
                  {t("nav_page_add_landmark")}
                </option>
                {places.map((place) => (
                  <option key={place._id} value={place._id}>
                    {place.name} ({place.city || place.country})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3. Routing Mode & Calculation */}
          <div className="navigate-card">
            <h3>{t("nav_page_strategy_title")}</h3>

            <div className="routing-strategy-toggle">
              <label className={`strategy-radio-label ${routeStrategy === "shortest" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="routeStrategy"
                  value="shortest"
                  checked={routeStrategy === "shortest"}
                  onChange={() => setRouteStrategy("shortest")}
                />
                <div>
                  <strong>{t("nav_page_strat_shortest")}</strong>
                  <span>{t("nav_page_strat_shortest_desc")}</span>
                </div>
              </label>

              <label className={`strategy-radio-label ${routeStrategy === "fastest" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="routeStrategy"
                  value="fastest"
                  checked={routeStrategy === "fastest"}
                  onChange={() => setRouteStrategy("fastest")}
                />
                <div>
                  <strong>{t("nav_page_strat_fastest")}</strong>
                  <span>{t("nav_page_strat_fastest_desc")}</span>
                </div>
              </label>

              <label className={`strategy-radio-label ${routeStrategy === "fixed" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="routeStrategy"
                  value="fixed"
                  checked={routeStrategy === "fixed"}
                  onChange={() => setRouteStrategy("fixed")}
                />
                <div>
                  <strong>{t("nav_page_strat_fixed")}</strong>
                  <span>{t("nav_page_strat_fixed_desc")}</span>
                </div>
              </label>
            </div>

            <button
              type="button"
              className="navigate-btn route-calc-btn"
              onClick={handleCalculateRoute}
              disabled={routing || (waypoints.length < 2 && (!startPoint || !destinationPoint))}
            >
              {routing
                ? t("nav_page_calc_routing")
                : routeStrategy === "shortest" && waypoints.length >= 3
                ? `🧭 ${t("nav_page_calc_shortest", { count: waypoints.length })}`
                : `🧭 ${t("nav_page_calc_route")}`}
            </button>

            {routeError && (
              <div className="error-message" style={{ marginTop: "12px" }}>
                <span>⚠️ {routeError}</span>
                <div style={{ marginTop: "8px" }}>
                  <a
                    href={getGoogleMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ext-nav-btn gmaps-btn"
                    style={{ display: "inline-block", fontSize: "12px", padding: "6px 12px" }}
                  >
                    🗺️ Open Waypoints in Google Maps Directions
                  </a>
                </div>
              </div>
            )}

            {routeInfo && (
              <div className="route-results-box">
                <div className="route-badge shortest">
                  {routeInfo.strategyLabel}
                </div>

                <div className="route-metric-grid">
                  <div className="route-metric">
                    <span className="metric-label">{t("nav_page_metric_distance")}</span>
                    <strong className="metric-value">{routeInfo.distanceKm} km</strong>
                  </div>
                  <div className="route-metric">
                    <span className="metric-label">{t("nav_page_metric_duration")}</span>
                    <strong className="metric-value">{routeInfo.durationFormatted}</strong>
                  </div>
                </div>

                {/* If multi-stop TSP was solved, show optimized visiting sequence */}
                {routeInfo.isMultiStopTSP && routeInfo.sequence && (
                  <div className="route-sequence-display">
                    <strong>✅ {t("nav_page_sequence_title")}</strong>
                    <ol className="sequence-step-list">
                      {routeInfo.sequence.map((step) => (
                        <li key={step.order}>
                          <span className="sequence-step-name">{step.name}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Distinct Comparison between Shortest Distance and Fastest Time */}
                {routeInfo.hasAlternative && (
                  <div className="route-comparison-note">
                    ℹ️ <strong>{t("nav_page_tradeoff_title")}</strong>
                    {routeInfo.strategy === "shortest" ? (
                      <span>
                        {" "}Fastest alternative is {routeInfo.fastest.distanceKm} km ({routeInfo.fastest.durationFormatted}). Shortest distance was chosen to save {(routeInfo.fastest.distanceKm - routeInfo.shortest.distanceKm).toFixed(2)} km.
                      </span>
                    ) : (
                      <span>
                        {" "}Shortest alternative is {routeInfo.shortest.distanceKm} km ({routeInfo.shortest.durationFormatted}). Fastest route was chosen for quicker transit.
                      </span>
                    )}
                  </div>
                )}

                {/* External Action Links */}
                <div className="route-action-buttons">
                  <a
                    href={getGoogleMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ext-nav-btn gmaps-btn"
                  >
                    🗺️ {t("nav_page_open_gmaps")}
                  </a>

                  <button
                    type="button"
                    className="ext-nav-btn ride-toggle-btn"
                    onClick={() => setShowRidePanel(!showRidePanel)}
                  >
                    🚕 {t("nav_page_book_ride")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. External Ride Booking Options */}
          {showRidePanel && (
            <div className="navigate-card ride-booking-panel">
              <div className="ride-panel-header">
                <h3>🚕 {t("nav_page_ride_panel_title")}</h3>
                <span className="provider-badge">Uber & Ola</span>
              </div>

              <div className="ride-disclaimer-box">
                🛡️ {t("nav_page_ride_disclaimer")}
              </div>

              <div className="ride-options-list">
                {/* Uber Option */}
                <div className="ride-card">
                  <div className="ride-card-left">
                    <div className="ride-logo-icon uber">Uber</div>
                    <div>
                      <strong>{t("nav_page_uber_rides")}</strong>
                      <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                        {t("nav_page_uber_sub")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={getUberUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ride-launch-btn uber-btn"
                  >
                    {t("nav_page_launch_uber")}
                  </a>
                </div>

                {/* Ola Option */}
                <div className="ride-card">
                  <div className="ride-card-left">
                    <div className="ride-logo-icon ola">Ola</div>
                    <div>
                      <strong>{t("nav_page_ola_cabs")}</strong>
                      <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                        {t("nav_page_ola_sub")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={getOlaUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ride-launch-btn ola-btn"
                  >
                    {t("nav_page_launch_ola")}
                  </a>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ================= RIGHT MAP VIEWPORT ================= */}
        <section className="navigate-map-section">
          <div ref={mapContainerRef} className="navigate-leaflet-map" />

          {/* Map floating quick guide */}
          <div className="map-legend-overlay">
            <div>🚩 {t("nav_page_legend_start")}</div>
            <div>🏁 {t("nav_page_legend_end")}</div>
            <div>📍 {t("nav_page_legend_intermediate")}</div>
            <div>🗺️ {t("nav_page_legend_landmarks")}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Navigate;
