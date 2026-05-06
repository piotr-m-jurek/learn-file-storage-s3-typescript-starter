import type { ApiConfig } from "../config";
import type { Video } from "../db/videos";
import { generatePresignedURL } from "./generate-presigned-url";

export async function dbVideoToSignedVideo(cfg: ApiConfig, video: Video): Promise<Video> {
    const signedURL = await generatePresignedURL(cfg, video.videoURL ?? "", 3600);
    return { ...video, videoURL: signedURL };
}
