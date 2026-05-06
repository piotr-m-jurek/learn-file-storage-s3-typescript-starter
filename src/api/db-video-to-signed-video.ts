import type { ApiConfig } from "../config";
import type { Video } from "../db/videos";
import { generatePresignedURL } from "./generate-presigned-url";

export function dbVideoToSignedVideo(cfg: ApiConfig, video: Video): Video {
    return {
        ...video,
        videoURL: generatePresignedURL(cfg, video.videoURL, 10000),
    };
}
