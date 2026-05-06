export async function processVideoForFastStart(filePath: string) {
    const tempPath = `${filePath}.processed`;

    Bun.file(tempPath, { type: "video/mp4" });
    const proc = Bun.spawn({
        cmd: [
            "ffmpeg",
            "-i",
            filePath,
            "-movflags",
            "faststart",
            "-map_metadata",
            "0",
            "-codec",
            "copy",
            "-f",
            "mp4",
            tempPath,
        ],
        stdout: "pipe",
    });
    const _stdoutText = await new Response(proc.stdout).text();
    console.log(_stdoutText);

    if (proc.exitCode !== 0) {
        console.error("something went wrong");
    }
    return tempPath;
}
