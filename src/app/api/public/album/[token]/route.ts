import { db } from "@/lib/db";
import {
  createAlbumInfoHandler,
  createAlbumUploadHandler,
} from "@/lib/album/handlers";

export const runtime = "nodejs";

/** Public guest photo album (GAP 3): GET = info + gallery, POST = upload. */
export const GET = createAlbumInfoHandler(db);
export const POST = createAlbumUploadHandler(db);
