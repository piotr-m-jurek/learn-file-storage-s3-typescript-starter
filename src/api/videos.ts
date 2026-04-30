import { randomBytes } from "node:crypto";
import path from "node:path";
import type { BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import type { ApiConfig } from "../config";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, UserForbiddenError } from "./errors";
import { respondWithJSON } from "./json";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
    const MAX_UPLOAD_SIZE = 10 << 27;
    const { videoId } = req.params as { videoId?: string };
    if (!videoId) {
        throw new BadRequestError("Invalid video ID");
    }

    const token = getBearerToken(req.headers);
    const userID = validateJWT(token, cfg.jwtSecret);
    const metadata = getVideo(cfg.db, videoId);

    if (metadata?.userID !== userID) {
        throw new UserForbiddenError("You don't have access to that video");
    }

    const formData = await req.formData();
    const video = formData.get("video");

    if (!(video instanceof File)) {
        throw new BadRequestError("Video file missing");
    }

    if (video.size > MAX_UPLOAD_SIZE) {
        throw new BadRequestError(
            `Video file too big, max size is ${MAX_UPLOAD_SIZE}`,
        );
    }

    const mediaType = video.type;
    if (mediaType !== "video/mp4") {
        throw new BadRequestError(`Video file has to be in mp4 format`);
    }

    const fileName = `${randomBytes(32).toString("base64url")}.mp4`;
    const tempFilePath = path.join(cfg.filepathRoot, fileName);
    const tempFile = Bun.file(tempFilePath, { type: "video/mp4" });
    try {
        await Bun.write(tempFilePath, video);

        const file = cfg.s3Client.file(fileName, {
            bucket: cfg.s3Bucket,
            region: cfg.s3Region,
        });
        await file.write(tempFile, { type: "video/mp4" });

        const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${fileName}`;

        updateVideo(cfg.db, { ...metadata, videoURL });
    } finally {
        await tempFile.delete();
    }

    return respondWithJSON(200, null);
}
