import ffmpeg from "fluent-ffmpeg";
ffmpeg.setFfmpegPath("/nix/store/inqkj79vydizl6ja0d8af99qlxbmyr84-replit-runtime-path/bin/ffmpeg");

const cmd = ffmpeg()
  .input("/tmp/aotest/video.mp4")
  .input("/tmp/aotest/voice.mp3")
  .input("/tmp/aotest/music.mp3")
  .complexFilter([
    "[0:v]null[vpass]",
    "[1:a]volume=1.0[voice]",
    "[2:a]volume=0.25[music]",
    "[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[aout]",
  ], ["vpass", "aout"])
  .videoCodec("libx264")
  .audioCodec("aac")
  .outputOptions(["-pix_fmt yuv420p", "-movflags +faststart", "-shortest"]);

cmd.on("start", c => console.log("CMD:", c));
cmd.on("end", () => {
  console.log("--- DONE ---");
  import("child_process").then(cp => {
    console.log(cp.execSync("ffprobe -v error -show_entries stream=codec_type,codec_name,duration /tmp/aotest/out_FIX.mp4").toString());
    console.log(cp.execSync("ls -la /tmp/aotest/out_FIX.mp4").toString());
  });
});
cmd.on("error", e => { console.error("ERR:", e.message); process.exit(1); });
cmd.save("/tmp/aotest/out_FIX.mp4");
