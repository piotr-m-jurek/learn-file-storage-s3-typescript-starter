import type { ApiConfig } from "../config";
import type { Video } from "../db/videos";
import { generatePresignedURL } from "./generate-presigned-url";

export async function dbVideoToSignedVideo(
    cfg: ApiConfig,
    video: Video,
): Promise<Video> {
    if (!video.videoURL) {
        return video;
    }

    return {
        ...video,
        videoURL: await generatePresignedURL(cfg, video.videoURL, 3600),
    };
}
