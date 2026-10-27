import React, { useState, useMemo } from 'react';
import { useEventContext } from '../../context/EventContext';
import {
  TILE_TYPES,
  MAX_TILES,
  addTile,
  removeTile,
  moveTile,
  moodStats,
  tilesFromEventTheme,
} from '../../lib/moodboard/moodModel';
import { CURATED_THEMES } from '../../data/defaultData';
import {
  Palette,
  Plus,
  Sparkles,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Lightbulb,
  ImageOff,
} from 'lucide-react';

/**
 * Mood Board tab — the visual inspiration board for the celebration.
 * Three tile kinds (color swatch / image link / idea note), reorderable,
 * seedable from the applied AI theme. Tiles are tiny strings, validated by
 * the pure module, so the board is safe to persist inside the event.
 */
export const MoodBoard = () => {
  const { activeEvent, setMoodTiles, showToast } = useEventContext();

  const tiles = useMemo(() => activeEvent?.moodboard?.tiles || [], [activeEvent?.moodboard?.tiles]);
  const stats = useMemo(() => moodStats(tiles), [tiles]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [tileType, setTileType] = useState('color');
  const [tileValue, setTileValue] = useState('');
  const [tileCaption, setTileCaption] = useState('');
  const [failedImages, setFailedImages] = useState(() => new Set());

  if (!activeEvent) return null;

  const typeMeta = TILE_TYPES.find((t) => t.id === tileType) || TILE_TYPES[0];

  const commit = (next, message = null, type = 'success') => {
    const ok = setMoodTiles(next);
    if (!ok) {
      showToast(`The board holds at most ${MAX_TILES} tiles — remove one first.`, 'info');
      return false;
    }
    if (message) showToast(message, type);
    return true;
  };

  const handleAddTile = () => {
    const next = addTile(tiles, { type: tileType, value: tileValue, caption: tileCaption });
    if (next === tiles) {
      const problem =
        tileType === 'color'
          ? 'Use a 6-digit hex color like #C46851.'
          : tileType === 'image'
          ? 'Paste an http(s) image link (jpg/png/webp).'
          : 'Write the idea note first.';
      showToast(problem, 'error');
      return;
    }
    if (commit(next, 'Tile added to your mood board.')) {
      setTileValue('');
      setTileCaption('');
    }
  };

  const handleSeedFromTheme = () => {
    const seeded = tilesFromEventTheme(activeEvent, CURATED_THEMES);
    if (seeded.length === 0) {
      showToast('No theme to pull from yet — apply one in AI Studio first.', 'info');
      return;
    }
    const existing = new Set(tiles.map((t) => `${t.type}:${String(t.value).toLowerCase()}`));
    const fresh = seeded.filter((t) => !existing.has(`${t.type}:${String(t.value).toLowerCase()}`));
    if (fresh.length === 0) {
      showToast('Your theme palette is already on the board.', 'info');
      return;
    }
    commit([...tiles, ...fresh].slice(0, MAX_TILES), `Seeded ${fresh.length} tile${fresh.length === 1 ? '' : 's'} from "${activeEvent.themeName}".`);
  };

  const markImageFailed = (id) => {
    setFailedImages((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
              Mood Board
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
              {stats.total} / {MAX_TILES} Tiles
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Colors, images and vibe notes for your celebration — reorder, restyle, share with your vendors
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedFromTheme}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-violet-800 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Seed from Theme</span>
          </button>
          <button
            type="button"
            onClick={() => setComposerOpen((open) => !open)}
            aria-expanded={composerOpen}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-xs shadow-lg shadow-violet-500/25 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Tile</span>
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" aria-hidden="true" /> Colors
          </p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">{stats.color}</h3>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> Images
          </p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">{stats.image}</h3>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Idea Notes
          </p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">{stats.note}</h3>
        </div>
      </div>

      {/* Composer */}
      {composerOpen && (
        <div className="bg-white rounded-3xl p-6 border border-violet-200/80 shadow-card space-y-4 animate-fadeIn">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">New tile</p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tile type">
            {TILE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTileType(t.id)}
                aria-pressed={tileType === t.id}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  tileType === t.id
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mood-value" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                {typeMeta.label} value <span className="text-rose-500">*</span>
              </label>
              <input
                id="mood-value"
                type={tileType === 'image' ? 'url' : tileType === 'color' ? 'text' : 'text'}
                value={tileValue}
                onChange={(e) => setTileValue(e.target.value)}
                placeholder={typeMeta.hint}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label htmlFor="mood-caption" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Caption (optional)
              </label>
              <input
                id="mood-caption"
                type="text"
                value={tileCaption}
                onChange={(e) => setTileCaption(e.target.value)}
                placeholder="e.g. Terracotta / Ceremony arch inspiration"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddTile}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Add to board
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tile grid */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
        {tiles.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Palette className="w-10 h-10 mx-auto text-slate-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600">Your board is blank</p>
            <p className="text-xs text-slate-400">
              Seed colors from your applied theme, or add swatches, image links and idea notes one by one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tiles.map((tile, index) => (
              <div key={tile.id} className="group relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                {/* Tile body */}
                {tile.type === 'color' && (
                  <div className="aspect-square w-full" style={{ backgroundColor: tile.value }}>
                    <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-sm px-2 py-1.5">
                      <p className="text-[10px] font-bold text-slate-800 truncate">{tile.caption || tile.value}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">{tile.value}</p>
                    </div>
                  </div>
                )}

                {tile.type === 'image' && (
                  <div className="aspect-square w-full bg-slate-100">
                    {failedImages.has(tile.id) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-400">
                        <ImageOff className="w-6 h-6" aria-hidden="true" />
                        <p className="text-[9px] font-bold text-center px-2">Image unavailable offline</p>
                      </div>
                    ) : (
                      // Remote mood-board URLs need a plain <img> (no next/image
                      // domain config for arbitrary hosts) + graceful onError.
                      <img
                        src={tile.value}
                        alt={tile.caption || 'Mood board inspiration image'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => markImageFailed(tile.id)}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {tile.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 backdrop-blur-sm px-2 py-1">
                        <p className="text-[10px] font-bold text-white truncate">{tile.caption}</p>
                      </div>
                    )}
                  </div>
                )}

                {tile.type === 'note' && (
                  <div className="aspect-square w-full bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center gap-2 p-3 text-center">
                    <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
                    <p className="text-[11px] font-semibold text-slate-700 leading-snug line-clamp-4">{tile.value}</p>
                    {tile.caption && <p className="text-[9px] text-slate-400 uppercase tracking-wide">{tile.caption}</p>}
                  </div>
                )}

                {/* Hover controls */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => commit(moveTile(tiles, tile.id, 'left'))}
                    disabled={index === 0}
                    title="Move left"
                    aria-label={`Move tile ${index + 1} left`}
                    className="p-1 rounded-lg bg-slate-900/70 text-white hover:bg-slate-900 disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => commit(moveTile(tiles, tile.id, 'right'))}
                    disabled={index === tiles.length - 1}
                    title="Move right"
                    aria-label={`Move tile ${index + 1} right`}
                    className="p-1 rounded-lg bg-slate-900/70 text-white hover:bg-slate-900 disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove this ${tile.type} tile from the mood board?`)) {
                        commit(removeTile(tiles, tile.id), 'Tile removed.', 'info');
                      }
                    }}
                    title="Remove tile"
                    aria-label="Remove tile"
                    className="p-1 rounded-lg bg-slate-900/70 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
