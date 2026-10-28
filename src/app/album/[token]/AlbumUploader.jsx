'use client';

/**
 * Guest-facing album uploader — the client island of the shared photo album.
 *
 * Flow: pick photos (multi-select) → each is downscaled + re-encoded to a
 * ~720px JPEG in the browser (the same canvas pipeline the host app uses, so
 * payloads stay ~60–180KB) → preview strip → optional caption + your name →
 * sequential upload → the shared gallery refreshes live. Guests see only what
 * guests shared; the host's private wall stays on the host's device.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { processImageFiles } from '../../../services/photoService';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  PartyPopper,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react';

const MAX_BATCH = 10;

export function AlbumUploader({ token, eventTitle }) {
  const [album, setAlbum] = useState(null); // { event, photos, count, maxPhotos, remaining }
  const [loadError, setLoadError] = useState(false);

  const [uploader, setUploader] = useState('');
  const [caption, setCaption] = useState('');
  const [staged, setStaged] = useState([]); // [{ dataUrl }]
  const [staging, setStaging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState(null); // { done, total } | null
  const [error, setError] = useState('');
  const [justShared, setJustShared] = useState(0);

  const fileInputRef = useRef(null);

  const loadAlbum = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/album/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      setAlbum(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  const remaining = album?.remaining ?? 0;
  const isFull = album != null && remaining <= 0;

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setError('');
    setStaging(true);
    try {
      const slice = files.slice(0, MAX_BATCH);
      const { dataUrls, rejected } = await processImageFiles(slice);
      const room = Math.max(0, remaining - staged.length);
      const accepted = dataUrls.slice(0, room);
      setStaged((prev) => [...prev, ...accepted.map((dataUrl) => ({ dataUrl }))]);
      if (rejected > 0) {
        setError(
          `${rejected} file${rejected === 1 ? '' : 's'} could not be read — use JPEG/PNG/WebP/GIF images up to 12MB.`
        );
      }
      if (dataUrls.length > room) {
        setError(
          `Only ${room} more photo${room === 1 ? '' : 's'} fit in this shared album — the rest were skipped.`
        );
      }
    } finally {
      setStaging(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeStaged = (idx) => setStaged((prev) => prev.filter((_, i) => i !== idx));

  const submitPhotos = async (e) => {
    e.preventDefault();
    if (uploading || staging) return;
    const name = uploader.trim();
    if (name.length < 2) {
      setError('Please share your name so the host knows who sent these.');
      return;
    }
    if (staged.length === 0) {
      setError('Pick at least one photo to share.');
      return;
    }
    setUploading(true);
    setError('');
    setUploadState({ done: 0, total: staged.length });
    let sent = 0;
    let failed = 0;
    try {
      for (const item of staged) {
        try {
          const res = await fetch(`/api/public/album/${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              uploader: name,
              caption: caption.trim() || undefined,
              dataUrl: item.dataUrl,
            }),
          });
          if (res.ok) sent += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
        setUploadState((prev) => ({ ...prev, done: (prev?.done || 0) + 1 }));
      }

      setStaged([]);
      setCaption('');
      await loadAlbum();

      if (sent > 0) {
        setJustShared(sent);
        try {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          if (!reduce) {
            confetti({
              particleCount: 120,
              spread: 75,
              origin: { y: 0.7 },
              colors: ['#f43f5e', '#a855f7', '#f59e0b', '#10b981', '#3b82f6'],
            });
          }
        } catch {
          /* confetti is decorative */
        }
      }
      if (failed > 0) {
        setError(
          `${failed} photo${failed === 1 ? '' : 's'} could not be uploaded — please try again in a moment.`
        );
      }
    } finally {
      setUploading(false);
      setUploadState(null);
    }
  };

  if (loadError) {
    return (
      <div className="text-center space-y-3 py-6" role="alert">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-600">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </span>
        <h2 className="text-base font-bold text-slate-800">The album could not load</h2>
        <p className="text-sm text-slate-500">
          Check your connection and{' '}
          <button
            type="button"
            onClick={loadAlbum}
            className="font-bold text-brand-600 underline hover:no-underline"
          >
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Opening the album…
      </div>
    );
  }

  const photos = album.photos || [];

  return (
    <div className="space-y-8">
      {/* Success banner */}
      {justShared > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <span className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-emerald-100 text-emerald-600">
            <PartyPopper className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-800">
              {justShared} photo{justShared === 1 ? '' : 's'} shared with{' '}
              {album.event?.title || eventTitle}!
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              The host will see them in their photo inbox the next time they sync. Thanks for
              adding to the memories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setJustShared(0)}
            aria-label="Dismiss"
            className="ml-auto text-emerald-400 hover:text-emerald-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload form */}
      {isFull ? (
        <div className="text-center space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <Camera className="w-8 h-8 text-amber-500 mx-auto" aria-hidden="true" />
          <h2 className="text-sm font-bold text-amber-900">This shared album is full</h2>
          <p className="text-xs text-amber-800">
            {album.maxPhotos} photos are already here — the host will treasure what&apos;s
            shared. Enjoy browsing the gallery below.
          </p>
        </div>
      ) : (
        <form onSubmit={submitPhotos} className="space-y-4" noValidate>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="album-name"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Your name
              </label>
              <input
                id="album-name"
                type="text"
                value={uploader}
                onChange={(e) => setUploader(e.target.value)}
                placeholder="e.g. Auntie Priya"
                autoComplete="name"
                maxLength={80}
                className="w-full h-11 px-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label
                htmlFor="album-caption"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Caption <span className="text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="album-caption"
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Applies to this batch"
                maxLength={200}
                className="w-full h-11 px-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Drop-zone style picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="album-file-input"
            aria-describedby="album-file-hint"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={staging || remaining - staged.length <= 0}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40 transition-all py-8 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {staging ? (
              <Loader2 className="w-7 h-7 text-brand-500 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="w-7 h-7 text-brand-500" aria-hidden="true" />
            )}
            <span className="text-sm font-bold text-slate-700">
              {staging ? 'Optimizing your photos…' : 'Choose photos to share'}
            </span>
            <span id="album-file-hint" className="text-[11px] text-slate-400">
              Up to {Math.min(MAX_BATCH, remaining - staged.length)} at a time · JPEG / PNG /
              WebP / GIF · auto-optimized in your browser
            </span>
          </button>

          {/* Staged previews */}
          {staged.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2">
                Ready to share ({staged.length})
              </p>
              <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {staged.map((item, idx) => (
                  <li
                    key={`${item.dataUrl.slice(-24)}-${idx}`}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group"
                  >
                    <img
                      src={item.dataUrl}
                      alt={`Photo ${idx + 1} ready to share`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeStaged(idx)}
                      aria-label={`Remove photo ${idx + 1}`}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 shadow-sm text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {uploading && uploadState && (
            <div role="status" aria-live="polite">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  Uploading {uploadState.done + 1 > uploadState.total ? uploadState.total : uploadState.done + 1} of{' '}
                  {uploadState.total}…
                </span>
                <span>
                  {uploadState.done}/{uploadState.total}
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden"
                role="progressbar"
                aria-valuenow={uploadState.done}
                aria-valuemin={0}
                aria-valuemax={uploadState.total}
                aria-label="Upload progress"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-all"
                  style={{
                    width: `${Math.round((uploadState.done / uploadState.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || staging || staged.length === 0}
            className="w-full h-12 inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
            {uploading
              ? 'Sharing…'
              : staged.length > 0
                ? `Share ${staged.length} photo${staged.length === 1 ? '' : 's'}`
                : 'Share photos'}
          </button>
        </form>
      )}

      {/* Shared gallery */}
      <section aria-label="Photos shared by guests">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <ImagePlus className="w-4 h-4 text-brand-500" aria-hidden="true" />
            Shared by your crew
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">
            {photos.length} of {album.maxPhotos}
          </span>
        </div>

        {photos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-10 text-center">
            <Camera className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600 mt-2">
              No photos have been shared yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Be the first — the host will love you for it.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <li
                key={p.id}
                className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group"
              >
                <div className="aspect-square">
                  <img
                    src={p.dataUrl}
                    alt={p.caption ? `${p.caption} — shared by ${p.uploader}` : `Photo shared by ${p.uploader}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 to-transparent px-2.5 pt-6 pb-2">
                  <p className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-300" aria-hidden="true" />
                    {p.uploader}
                  </p>
                  {p.caption && (
                    <p className="text-[10px] text-white/80 truncate">{p.caption}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default AlbumUploader;
