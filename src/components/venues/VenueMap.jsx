'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './venueMap.css';

/**
 * Interactive venue map — Leaflet + OpenStreetMap (no API key required).
 *
 * Every pin embeds the venue's real photo, so the map itself is a visual
 * gallery. Hovering a pin opens an image card (photo, match score, estimated
 * cost); clicking selects the venue and syncs the card list; the selected pin
 * pulses with a fuchsia ring.
 */

/** Default bounds around all curated venues (Austin metro & Hill Country). */
const DEFAULT_BOUNDS = L.latLngBounds([30.10, -98.10], [30.47, -97.69]);

const scoreTone = (score) => {
  if (score >= 85) return { bg: 'bg-emerald-500', text: 'text-emerald-50' };
  if (score >= 70) return { bg: 'bg-amber-500', text: 'text-amber-50' };
  return { bg: 'bg-slate-500', text: 'text-slate-50' };
};

function pinIcon(venue, { selected, highlighted, dimmed }) {
  const classes = ['venue-pin'];
  if (selected) classes.push('venue-pin--selected');
  if (highlighted) classes.push('venue-pin--highlighted');
  if (dimmed) classes.push('venue-pin--dimmed');

  return L.divIcon({
    className: classes.join(' '),
    html: `
      <span class="venue-pin-wrap">
        <img src="${venue.images[0]}" alt="${venue.name}" />
        <span class="venue-pin__label">${venue.name}</span>
      </span>`,
    iconSize: [52, 60],
    iconAnchor: [26, 26],
    popupAnchor: [0, -30],
  });
}

/** Fits the initial view, flies to the focused venue, closes popups on map click. */
function MapController({ focus }) {
  const map = useMap();

  useEffect(() => {
    if (map && DEFAULT_BOUNDS.isValid()) {
      map.fitBounds(DEFAULT_BOUNDS, { padding: [24, 24] });
    }
  }, [map]);

  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 12), { duration: 0.9 });
    }
  }, [focus, map]);

  useMapEvents({
    click() {
      map.closePopup();
    },
  });

  return null;
}

export default function VenueMap({
  scoredVenues = [],
  matchedIds = null, // Set|null — when prefs are active, non-matching pins dim
  selectedId = null,
  highlightedId = null,
  focus = null, // {lat,lng} to fly to
  onSelect = () => {},
  formatCost = (n) => `$${n.toLocaleString()}`,
}) {
  const markers = useMemo(
    () =>
      scoredVenues.map(({ venue, score, estCost, warnings }) => ({
        key: venue.id,
        venue,
        score,
        estCost,
        warnings,
        icon: pinIcon(venue, {
          selected: venue.id === selectedId,
          highlighted: venue.id === highlightedId,
          dimmed: matchedIds ? !matchedIds.has(venue.id) : false,
        }),
      })),
    [scoredVenues, selectedId, highlightedId, matchedIds]
  );

  return (
    <div
      className="h-full w-full rounded-3xl overflow-hidden border border-slate-200/80 shadow-card relative"
      role="region"
      aria-label="Interactive venue map with photos — hover a pin to preview a venue"
    >
      <MapContainer
        center={[30.28, -97.79]}
        zoom={10}
        scrollWheelZoom={false}
        zoomControl
        className="h-full w-full venue-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController focus={focus} />

        {markers.map(({ key, venue, score, estCost, warnings, icon }) => {
          const tone = scoreTone(score);
          const selected = venue.id === selectedId;
          const highlighted = venue.id === highlightedId;
          return (
            <Marker
              key={key}
              position={[venue.coords.lat, venue.coords.lng]}
              icon={icon}
              title={`${venue.name} — ${Math.round(score)}% match`}
              // Selected/highlighted pins pop above geographic clusters (Lake
              // Travis venues sit close together) so they're always visible.
              zIndexOffset={selected ? 1000 : highlighted ? 500 : 0}
              eventHandlers={{
                mouseover: (e) => e.target.openPopup(),
                click: () => onSelect(venue.id),
              }}
            >
              <Popup className="venue-popup" maxWidth={260}>
                <div className="w-[220px]">
                  <img
                    src={venue.images[0]}
                    alt={`${venue.name} photo`}
                    className="w-full h-28 object-cover rounded-xl"
                  />
                  <div className="pt-2 px-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-[13px] leading-tight text-slate-900 font-display">
                        {venue.name}
                      </strong>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tone.bg} ${tone.text}`}
                      >
                        {Math.round(score)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{venue.area}</p>
                    <p className="text-xs text-slate-700 mt-1.5 font-semibold">
                      Est. {formatCost(estCost)} · {venue.capacity.min}–{venue.capacity.max} guests
                    </p>
                    {warnings.length > 0 && (
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">⚠ {warnings[0]}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(venue.id)}
                      className="mt-2 w-full text-[11px] font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      Select this venue
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-2 left-2 z-[500] flex items-center gap-1.5 bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-full border border-slate-200/70 text-[10px] font-semibold text-slate-600 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" aria-hidden="true" />
        Hover a photo pin to preview · click to select
      </div>
    </div>
  );
}
