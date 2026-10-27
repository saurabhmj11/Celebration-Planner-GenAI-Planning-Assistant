import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEventContext } from '../../context/EventContext';
import { useCloudSync } from '../../context/CloudSyncContext';
import QRCode from 'qrcode';
import {
  PHOTO_ALBUMS,
  DEFAULT_PHOTO_ALBUM,
  MAX_PHOTOS_PER_EVENT,
  makePhotoMeta,
  validatePhotoDataUrl,
  photoStorageEstimate,
} from '../../lib/photos/photoModel';
import { processImageFiles } from '../../services/photoService';
import { downloadDataUrlFile, slugify } from '../../utils/exporters';
import { useModalFocus } from '../../hooks/useModalFocus';
import {
  Images,
  ImagePlus,
  Star,
  Trash2,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  HardDrive,
  Maximize2,
  QrCode,
  Link2,
  Globe,
  LogIn,
  Copy,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

/**
 * Event Photo Memory Wall — the celebration's shared photo gallery.
 *
 * Photos are uploaded through a canvas downscale pipeline (720px JPEG) and
 * stored as validated data URLs on the event, organized into story albums
 * (planning → ceremony → reception → candids), with favorites, captions,
 * a full-screen lightbox, and a live localStorage budget meter (photos are
 * the heaviest thing this app persists).
 */
export const PhotoWall = () => {
  const { events, activeEvent, addPhotos, updatePhoto, deletePhoto, showToast } = useEventContext();
  const {
    user: cloudUser,
    isSessionReady,
    cloudByLocalId,
    ensureAlbumShare,
    collectGuestPhotos,
    refreshCloudList,
    openCloudModal,
  } = useCloudSync();

  const [albumFilter, setAlbumFilter] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxId, setLightboxId] = useState(null);
  const fileInputRef = useRef(null);

  // --- Guest contributions — shared album link (GAP 3) ---
  const cloudInfo = cloudByLocalId.get(activeEvent?.id);
  const guestPhotoCount = cloudInfo?.guestPhotoCount || 0;
  const [shareBusy, setShareBusy] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setShareUrl('');
    setQrDataUrl('');
    setLinkCopied(false);
  }, [activeEvent?.id]);

  // Fresh inbox count whenever the wall opens while signed in — the collect
  // action itself always reads the live inbox, this just keeps the badge
  // honest for photos that arrived while the tab was closed.
  const cloudUserId = cloudUser?.id || cloudUser?.email;
  useEffect(() => {
    if (cloudUserId) refreshCloudList();
  }, [cloudUserId, refreshCloudList]);

  const handleCreateAlbumLink = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const res = await ensureAlbumShare(activeEvent);
      if (res.ok) {
        setShareUrl(res.url);
        setLinkCopied(false);
        try {
          setQrDataUrl(
            await QRCode.toDataURL(res.url, {
              width: 220,
              margin: 1,
              color: { dark: '#86198f', light: '#ffffff' },
            })
          );
        } catch {
          setQrDataUrl('');
        }
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopyAlbumLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2400);
      showToast('Album link copied — send it to your guests!', 'success');
    } catch {
      showToast('Copy failed — select the link text and copy manually.', 'error');
    }
  };

  const handleCollectGuestPhotos = async () => {
    if (collectBusy) return;
    setCollectBusy(true);
    try {
      await collectGuestPhotos(activeEvent);
    } finally {
      setCollectBusy(false);
    }
  };

  const photos = activeEvent?.photos || [];

  const visible = useMemo(
    () => (albumFilter === 'all' ? photos : photos.filter((p) => p.album === albumFilter)),
    [photos, albumFilter]
  );

  const albumCounts = useMemo(() => {
    const counts = {};
    for (const p of photos) counts[p.album] = (counts[p.album] || 0) + 1;
    return counts;
  }, [photos]);

  const storage = useMemo(() => photoStorageEstimate(events), [events]);

  /* Upload ---------------------------------------------------------------- */
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if (photos.length >= MAX_PHOTOS_PER_EVENT) {
      showToast(`This wall is full (${MAX_PHOTOS_PER_EVENT} photos) — remove one before adding more.`, 'info');
      return;
    }

    setIsUploading(true);
    try {
      const { dataUrls, rejected } = await processImageFiles(files);
      if (dataUrls.length > 0) {
        const targetAlbum = albumFilter !== 'all' ? albumFilter : DEFAULT_PHOTO_ALBUM;
        const metas = dataUrls.map((dataUrl) => makePhotoMeta(dataUrl, { album: targetAlbum }));
        addPhotos(metas);
      }
      if (rejected > 0) {
        showToast(
          `${rejected} file${rejected === 1 ? '' : 's'} could not be added — use JPEG/PNG/WebP/GIF images up to 12MB.`,
          'error'
        );
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* Lightbox --------------------------------------------------------------- */
  const lightboxIndex = visible.findIndex((p) => p.id === lightboxId);
  const lightboxPhoto = lightboxIndex >= 0 ? visible[lightboxIndex] : null;

  const closeLightbox = () => setLightboxId(null);
  const panelRef = useModalFocus(Boolean(lightboxPhoto), closeLightbox);

  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' && lightboxIndex < visible.length - 1) {
        setLightboxId(visible[lightboxIndex + 1].id);
      }
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
        setLightboxId(visible[lightboxIndex - 1].id);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxPhoto, lightboxIndex, visible]);

  const downloadPhoto = (photo) => {
    const url = validatePhotoDataUrl(photo.dataUrl);
    if (!url) return;
    const ext = url.slice(11, url.indexOf(',')).split(';')[0] === 'image/png' ? 'png' : 'jpg';
    downloadDataUrlFile(`${slugify(activeEvent.title)}-memory-${photo.id}.${ext}`, url);
  };

  if (!activeEvent) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 flex items-center gap-1.5">
            <Images className="w-4 h-4" aria-hidden="true" />
            Photo Memory Wall
          </p>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 mt-1">
            Share the Moments
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {photos.length} of {MAX_PHOTOS_PER_EVENT} photo{photos.length === 1 ? '' : 's'} on{' '}
            {activeEvent.title}&apos;s wall — uploads are auto-optimized to keep your data light.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 items-start sm:items-center">
          {/* Storage meter */}
          <div className="w-full sm:w-56" title="Photos live in your browser's local storage (~5MB budget)">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" aria-hidden="true" />
                Photo storage
              </span>
              <span>{storage.pct}%</span>
            </div>
            <div
              className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden"
              role="progressbar"
              aria-valuenow={storage.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Photo storage used"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  storage.pct > 80 ? 'bg-rose-500' : storage.pct > 55 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(2, storage.pct)}%` }}
              />
            </div>
          </div>

          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="photo-wall-upload"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || photos.length >= MAX_PHOTOS_PER_EVENT}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-700 hover:to-brand-700 rounded-xl shadow-md shadow-brand-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="w-4 h-4" aria-hidden="true" />
            )}
            {isUploading ? 'Processing…' : 'Upload photos'}
          </button>
        </div>
      </div>

      {/* Guest contributions — cloud-backed shared album (GAP 3) */}
      <div
        className="rounded-3xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-brand-50/60 p-5 space-y-3"
        aria-labelledby="guest-album-title"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p
              id="guest-album-title"
              className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-700 flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
              Guest Photo Contributions
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Share a link or QR — guests open it on their phone and drop photos into a private
              inbox. Nothing lands on this wall until you collect it.
            </p>
          </div>
          {cloudInfo?.hasAlbumToken && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
              <Globe className="w-3 h-3" aria-hidden="true" />
              Live
            </span>
          )}
        </div>

        {!isSessionReady ? (
          <div className="h-9 flex items-center text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
            Checking cloud sync…
          </div>
        ) : !cloudUser ? (
          <button
            type="button"
            onClick={openCloudModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-700 hover:to-brand-700 rounded-xl shadow-md shadow-fuchsia-500/25 transition-all"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            Sign in to share a guest album link
          </button>
        ) : (
          <div className="space-y-3">
            {!shareUrl ? (
              <button
                type="button"
                onClick={handleCreateAlbumLink}
                disabled={shareBusy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-700 hover:to-brand-700 rounded-xl shadow-md shadow-fuchsia-500/25 transition-all disabled:opacity-60 disabled:cursor-wait"
              >
                {shareBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                )}
                {shareBusy
                  ? 'Syncing & creating your link…'
                  : cloudInfo?.hasAlbumToken
                    ? 'Show my album link'
                    : 'Create guest album link'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    aria-label="Guest album link"
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyAlbumLink}
                    aria-label="Copy the guest album link"
                    className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-bold rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-700 hover:to-brand-700 transition-all"
                  >
                    {linkCopied ? (
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {qrDataUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <img
                      src={qrDataUrl}
                      alt="QR code linking to the shared guest photo album"
                      className="w-20 h-20 rounded-lg border border-slate-100"
                    />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Print this QR on table cards — guests scan, add a photo from their seat, and
                      it waits safely in your inbox until you collect it below.
                    </p>
                  </div>
                )}
              </div>
            )}

            {guestPhotoCount > 0 ? (
              <button
                type="button"
                onClick={handleCollectGuestPhotos}
                disabled={collectBusy || photos.length >= MAX_PHOTOS_PER_EVENT}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait"
              >
                {collectBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Inbox className="w-4 h-4" aria-hidden="true" />
                )}
                Collect {guestPhotoCount} guest photo{guestPhotoCount === 1 ? '' : 's'} onto the wall
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCollectGuestPhotos}
                disabled={collectBusy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait"
              >
                {collectBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Check inbox for new guest photos
              </button>
            )}

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Guest photos land in the “Candids” album, tagged with who shared them. Collecting also
              clears the cloud inbox — imported photos live on this device afterwards.
            </p>
          </div>
        )}
      </div>

      {/* Album filters */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Photo albums">
        <button
          type="button"
          role="tab"
          aria-selected={albumFilter === 'all'}
          onClick={() => setAlbumFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            albumFilter === 'all'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          All photos ({photos.length})
        </button>
        {PHOTO_ALBUMS.map((album) => (
          <button
            key={album.id}
            type="button"
            role="tab"
            aria-selected={albumFilter === album.id}
            onClick={() => setAlbumFilter(album.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              albumFilter === album.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <span aria-hidden="true">{album.icon}</span> {album.label} ({albumCounts[album.id] || 0})
          </button>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white/60">
          <Images className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h3 className="font-display font-bold text-lg text-slate-700 mt-3">
            {photos.length === 0
              ? 'The wall is waiting for its first memory'
              : `No photos in “${PHOTO_ALBUMS.find((a) => a.id === albumFilter)?.label}” yet`}
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {photos.length === 0
              ? 'Upload planning snapshots, the big moment, or party candids — photos are optimized automatically and stay on this device.'
              : 'Switch albums or upload new photos into this album.'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || photos.length >= MAX_PHOTOS_PER_EVENT}
            className="mt-5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 rounded-xl shadow-md disabled:opacity-50"
          >
            {isUploading ? 'Processing…' : 'Upload the first photo'}
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {visible.map((photo) => (
            <li
              key={photo.id}
              className="group relative rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all"
            >
              <button
                type="button"
                onClick={() => setLightboxId(photo.id)}
                className="block w-full text-left"
                aria-label={`Open photo: ${photo.caption || 'uncaptioned photo'}`}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={photo.dataUrl}
                    alt={photo.caption || 'Celebration photo'}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </button>

              {/* Favorite star */}
              <button
                type="button"
                onClick={() => updatePhoto(photo.id, { favorite: !photo.favorite })}
                aria-label={photo.favorite ? 'Remove from favorites' : 'Mark as favorite'}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white/85 backdrop-blur shadow-sm hover:bg-white transition-colors"
              >
                <Star
                  className={`w-4 h-4 ${photo.favorite ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
                  aria-hidden="true"
                />
              </button>

              {/* Album chip */}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/60 backdrop-blur text-[10px] font-bold text-white">
                {PHOTO_ALBUMS.find((a) => a.id === photo.album)?.icon}{' '}
                {PHOTO_ALBUMS.find((a) => a.id === photo.album)?.label.split(' ')[0]}
              </span>

              {/* Hover quick actions */}
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <p className="flex-1 min-w-0 text-[11px] text-white font-semibold drop-shadow truncate">
                  {photo.caption}
                </p>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLightboxId(photo.id)}
                    aria-label="View full photo"
                    className="p-1.5 rounded-full bg-white/85 backdrop-blur hover:bg-white transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPhoto(photo)}
                    aria-label="Download photo"
                    className="p-1.5 rounded-full bg-white/85 backdrop-blur hover:bg-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePhoto(photo.id)}
                    aria-label="Delete photo"
                    className="p-1.5 rounded-full bg-white/85 backdrop-blur hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn"
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close photo viewer"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Prev / next */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={() => setLightboxId(visible[lightboxIndex - 1].id)}
              aria-label="Previous photo"
              className="absolute left-3 sm:left-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          {lightboxIndex < visible.length - 1 && (
            <button
              type="button"
              onClick={() => setLightboxId(visible[lightboxIndex + 1].id)}
              aria-label="Next photo"
              className="absolute right-3 sm:right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          )}

          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl bg-slate-900/95 border border-white/10 shadow-2xl">
            <img
              src={lightboxPhoto.dataUrl}
              alt={lightboxPhoto.caption || 'Celebration photo'}
              className="w-full max-h-[52vh] object-contain bg-slate-950 rounded-t-3xl"
            />

            <div className="p-4 sm:p-5 space-y-3">
              <input
                type="text"
                value={lightboxPhoto.caption || ''}
                onChange={(e) => updatePhoto(lightboxPhoto.id, { caption: e.target.value })}
                placeholder="Caption this memory…"
                aria-label="Photo caption"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-brand-400 outline-none"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={lightboxPhoto.album}
                  onChange={(e) => updatePhoto(lightboxPhoto.id, { album: e.target.value })}
                  aria-label="Move photo to album"
                  className="px-3 py-1.5 text-xs font-semibold bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-brand-400 outline-none"
                >
                  {PHOTO_ALBUMS.map((a) => (
                    <option key={a.id} value={a.id} className="text-slate-800">
                      {a.icon} {a.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => updatePhoto(lightboxPhoto.id, { favorite: !lightboxPhoto.favorite })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                    lightboxPhoto.favorite
                      ? 'bg-amber-400/20 border-amber-300/50 text-amber-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${lightboxPhoto.favorite ? 'fill-amber-300 text-amber-300' : ''}`}
                    aria-hidden="true"
                  />
                  {lightboxPhoto.favorite ? 'Favorited' : 'Favorite'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadPhoto(lightboxPhoto)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextId =
                      lightboxIndex > 0
                        ? visible[lightboxIndex - 1].id
                        : visible[lightboxIndex + 1]?.id || null;
                    deletePhoto(lightboxPhoto.id);
                    setLightboxId(nextId);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 hover:bg-rose-500/25 transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Remove
                </button>
              </div>

              <p className="text-[10px] text-slate-400">
                Photo {lightboxIndex + 1} of {visible.length} · use ← → keys to browse
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
