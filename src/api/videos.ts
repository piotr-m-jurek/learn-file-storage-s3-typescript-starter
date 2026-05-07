import { randomBytes } from "node:crypto";
import path from "node:path";
import type { BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import type { ApiConfig } from "../config";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getVideoAspectRatio } from "./get-video-aspect-ratio";
import { respondWithJSON } from "./json";
import { processVideoForFastStart } from "./process-video-for-fast-start";

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

    const { path: filePath, file } = await getPreprocessedFile({
        cfg,
        video,
    });
    try {
        const aspectRatio = await getVideoAspectRatio(filePath);

        const key = `${aspectRatio}/${path.basename(filePath)}`;
        const s3File = cfg.s3Client.file(key, {
            bucket: cfg.s3Bucket,
            region: cfg.s3Region,
        });
        await s3File.write(file, { type: "video/mp4" });

        const videoURL = `${cfg.s3CfDistribution}/${key}`;
        const updated = { ...metadata, videoURL };
        updateVideo(cfg.db, updated);
        return respondWithJSON(200, updated);
    } finally {
        file.delete();
    }
}

async function getPreprocessedFile({
    cfg,
    video,
}: {
    cfg: ApiConfig;
    video: File;
}) {
    const fileName = `${randomBytes(32).toString("base64url")}.mp4`;
    const tempFilePath = path.join(cfg.assetsRoot, fileName);
    const tempFile = Bun.file(tempFilePath, { type: "video/mp4" });

    await Bun.write(tempFilePath, video);
    const processedVideoFileName = await processVideoForFastStart(tempFilePath);

    const processedFile = Bun.file(processedVideoFileName, {
        type: "video/mp4",
    });
    await tempFile.delete();

    return {
        path: processedVideoFileName,
        file: processedFile,
    };
}
