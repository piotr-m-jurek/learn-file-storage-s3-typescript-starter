import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};


const mediaTypeToExtension = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}


const allowedThumbnailTypes = ['image/png', 'image/jpeg'] ;

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }
  const MAX_UPLOAD_SIZE = 10 << 20 // more or less 10MB (a bit more), 

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail file too big, max size is " + MAX_UPLOAD_SIZE);
  }

  const mediaType = file.type as keyof typeof mediaTypeToExtension
  if (!allowedThumbnailTypes.includes(mediaType)) {
    console.error("incorrect media type", mediaType, allowedThumbnailTypes)
    throw new BadRequestError("You cannot upload " + mediaType + ". supported types: " + allowedThumbnailTypes.join(", "));
  }

  const metadata = getVideo(cfg.db, videoId)

  if (metadata?.userID !== userID) {
    throw new UserForbiddenError(`User ${userID} cannot access other users videos`)
  }

  const fileName = `${videoId}.${mediaTypeToExtension[mediaType]}`

  await Bun.write(path.join(cfg.assetsRoot, fileName), file, {createPath: true} )

  const thumbnailURL = [`http://localhost:${cfg.port}`,"assets",fileName].join("/")
  const newMetadata = {...metadata, thumbnailURL }

  updateVideo(cfg.db, newMetadata)
  return respondWithJSON(200, newMetadata);
}
