// INFO: Use Zod or Effect to get the ffmpeg output typed
// for now, let's just assume how it looks like with parseFFProbe

export async function getVideoAspectRatio(filePath: string) {
    const proc = Bun.spawn({
        cmd: [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            filePath,
        ],
        stdout: "pipe",
    });

    const stdoutText = await new Response(proc.stdout).text();

    if ((await proc.exited) !== 0) {
        throw new Error("Error parsing ffmpeg data");
    }

    const parsed = parseFfprobe(stdoutText);

    if (parsed === null) {
        throw new Error("Error parsing ffmpeg data");
    }

    if (parsed.width / parsed.height >= 1.7) {
        return "landscape";
    } else if (parsed.width / parsed.height <= 0.6) {
        return "portrait";
    } else {
        return "other";
    }
}

function parseFfprobe(input: string) {
    try {
        const json = JSON.parse(input);
        if (typeof json !== "object" || json === null || Array.isArray(json)) {
            return null;
        }

        if (!("streams" in json)) {
            return null;
        }

        const [stream] = json.streams;
        if (!("width" in stream) || !("height" in stream)) {
            return null;
        }

        return { height: stream.height, width: stream.width };
    } catch {
        return null;
    }
}
