/**
 * Photo Memory Wall model contract tests — the safety layer that keeps
 * localStorage healthy: data-URL allow-listing, SVG injection scanning,
 * size caps, storage estimation math, and the deterministic sample seeds
 * that make the gallery beautiful on first run.
 */
import { describe, expect, test } from "bun:test";
import {
  PHOTO_ALBUMS,
  DEFAULT_PHOTO_ALBUM,
  MAX_PHOTOS_PER_EVENT,
  MAX_PHOTO_DATAURL_CHARS,
  validatePhotoDataUrl,
  makePhotoMeta,
  photoStorageEstimate,
  samplePhotoDataUrl,
  samplePhotosFor,
} from "../../src/lib/photos/photoModel";

const jpegUrl = (payload = "abc") => `data:image/jpeg;base64,${payload}`;
const pngUrl = `data:image/png;base64,${"x".repeat(64)}`;
const svgUrl = (body = "<svg xmlns='http://www.w3.org/2000/svg'/>") =>
  `data:image/svg+xml,${encodeURIComponent(body)}`;

describe("validatePhotoDataUrl", () => {
  test("accepts allow-listed raster mime types", () => {
    expect(validatePhotoDataUrl(jpegUrl())).toBe(jpegUrl());
    expect(validatePhotoDataUrl(pngUrl)).toBe(pngUrl);
    expect(validatePhotoDataUrl("data:image/webp;base64,AAAA")).toContain("image/webp");
    expect(validatePhotoDataUrl("data:image/gif;base64,AAAA")).toContain("image/gif");
  });

  test("rejects non-image and non-allow-listed mime types", () => {
    expect(validatePhotoDataUrl("data:text/html,<h1>hi</h1>")).toBeNull();
    expect(validatePhotoDataUrl("data:image/tiff;base64,AAAA")).toBeNull();
    expect(validatePhotoDataUrl("data:image/bmp;base64,AAAA")).toBeNull();
    expect(validatePhotoDataUrl("data:application/pdf;base64,AAAA")).toBeNull();
    expect(validatePhotoDataUrl("javascript:alert(1)")).toBeNull();
  });

  test("rejects malformed inputs without throwing", () => {
    expect(validatePhotoDataUrl(null)).toBeNull();
    expect(validatePhotoDataUrl(undefined)).toBeNull();
    expect(validatePhotoDataUrl(12345)).toBeNull();
    expect(validatePhotoDataUrl("")).toBeNull();
    expect(validatePhotoDataUrl("data:image/jpeg")).toBeNull(); // no comma/payload
  });

  test("rejects oversized payloads that could blow the localStorage quota", () => {
    const huge = `data:image/jpeg;base64,${"x".repeat(MAX_PHOTO_DATAURL_CHARS)}`;
    expect(huge.length).toBeGreaterThan(MAX_PHOTO_DATAURL_CHARS);
    expect(validatePhotoDataUrl(huge)).toBeNull();
  });

  test("SVG payloads are scanned for script / event-handler injection", () => {
    expect(validatePhotoDataUrl(svgUrl("<svg onload='alert(1)'/>"))).toBeNull();
    expect(validatePhotoDataUrl(svgUrl("<svg><script>alert(1)</script></svg>"))).toBeNull();
    expect(validatePhotoDataUrl(svgUrl("<svg><a href='javascript:alert(1)'>x</a></svg>"))).toBeNull();
    expect(validatePhotoDataUrl(svgUrl("<svg><foreignObject><div>x</div></foreignObject></svg>"))).toBeNull();
    // Clean SVG passes untouched.
    const clean = svgUrl("<svg><circle r='5'/></svg>");
    expect(validatePhotoDataUrl(clean)).toBe(clean);
  });
});

describe("makePhotoMeta", () => {
  test("builds metadata with capped caption and a valid album", () => {
    const meta = makePhotoMeta(jpegUrl(), {
      caption: "y".repeat(500),
      album: "ceremony",
      favorite: true,
    });
    expect(meta.caption).toHaveLength(200);
    expect(meta.album).toBe("ceremony");
    expect(meta.favorite).toBe(true);
    expect(typeof meta.createdAt).toBe("string");
  });

  test("unknown albums fall back to the candids default", () => {
    expect(makePhotoMeta(jpegUrl(), { album: "afterparty" }).album).toBe(DEFAULT_PHOTO_ALBUM);
    expect(makePhotoMeta(jpegUrl(), {}).album).toBe(DEFAULT_PHOTO_ALBUM);
    expect(DEFAULT_PHOTO_ALBUM).toBe("candids");
  });

  test("non-string captions are stringified safely", () => {
    expect(makePhotoMeta(jpegUrl(), { caption: 42 }).caption).toBe("42");
    expect(makePhotoMeta(jpegUrl(), { caption: null }).caption).toBe("");
  });
});

describe("photoStorageEstimate", () => {
  test("estimates base64-decoded bytes at the 3/4 factor", () => {
    const url = jpegUrl(`${"x".repeat(96)}`); // 96 payload chars + prefix
    const est = photoStorageEstimate([{ id: "e1", photos: [{ dataUrl: url }] }]);
    expect(est.perEvent.e1).toBe(Math.round((url.length * 3) / 4));
  });

  test("aggregates across events and clamps the percentage at 100", () => {
    const big = `data:image/jpeg;base64,${"x".repeat(2_000_000)}`;
    const est = photoStorageEstimate([
      { id: "a", photos: [{ dataUrl: big }, { dataUrl: big }] },
      { id: "b", photos: [{ dataUrl: big }, { dataUrl: big }, { dataUrl: big }] },
    ]);
    expect(est.usedBytes).toBeGreaterThan(4_000_000);
    expect(est.pct).toBe(100); // clamped, never >100
  });

  test("tolerates empty/missing photo arrays and single-event input", () => {
    const est = photoStorageEstimate([{ id: "a" }, { id: "b", photos: [] }]);
    expect(est.usedBytes).toBe(0);
    expect(est.pct).toBe(0);
    const single = photoStorageEstimate({ id: "a", photos: [] });
    expect(single.perEvent.a).toBe(0);
    expect(photoStorageEstimate(null).usedBytes).toBe(0);
  });
});

describe("sample photo seeds", () => {
  test("every sample renders as a valid, injectable-free SVG data URL", () => {
    for (const evId of ["event-wedding-01", "event-bday-02", "event-comm-03"]) {
      for (const photo of samplePhotosFor(evId, ["#C46851", "#7A8B7B"])) {
        expect(validatePhotoDataUrl(photo.dataUrl)).toBe(photo.dataUrl);
      }
    }
  });

  test("ids are stable and per-event unique", () => {
    const a = samplePhotosFor("event-wedding-01");
    const b = samplePhotosFor("event-bday-02");
    expect(a.map((p) => p.id)).toEqual([
      "ph-event-wedding-01-1",
      "ph-event-wedding-01-2",
      "ph-event-wedding-01-3",
    ]);
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
  });

  test("each event gets exactly three photos, one favorited, albums assigned", () => {
    const photos = samplePhotosFor("event-bday-02", ["#F43F5E", "#06B6D4"]);
    expect(photos).toHaveLength(3);
    expect(photos.filter((p) => p.favorite)).toHaveLength(1);
    expect(photos[0].album).toBe("planning");
    expect(photos[1].album).toBe("ceremony");
    expect(new Set(photos.map((p) => p.album)).size).toBeGreaterThan(1);
    for (const p of photos) {
      expect(p.caption.length).toBeGreaterThan(0);
    }
  });

  test("unknown events reuse the wedding set; invalid palette falls back", () => {
    expect(samplePhotosFor("mystery-event")).toHaveLength(3);
    const photos = samplePhotosFor("mystery-event", ["nope", 42]);
    expect(photos[0].dataUrl).toContain("data:image/svg+xml,");
  });

  test("motifs and labels are sanitized against SVG-breaking characters", () => {
    const url = samplePhotoDataUrl({ motif: '<script>"&\'', label: '"><script>x</script>' });
    expect(url.toLowerCase()).not.toContain("<script");
    expect(validatePhotoDataUrl(url)).toBe(url);
  });
});

describe("constants sanity", () => {
  test("album ids are unique and match the seeded album values", () => {
    const ids = PHOTO_ALBUMS.map((a) => a.id);
    expect(new Set(ids).size).toBe(PHOTO_ALBUMS.length);
    expect(ids).toEqual(["planning", "ceremony", "reception", "candids"]);
  });

  test("caps keep localStorage viable", () => {
    expect(MAX_PHOTOS_PER_EVENT).toBe(30);
    expect(MAX_PHOTO_DATAURL_CHARS).toBe(400_000);
  });
});
