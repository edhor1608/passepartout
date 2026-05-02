import { runFfprobe } from "./media_process";

export type VideoMetadata = {
  width: number;
  height: number;
  codec: string | null;
  fps: number;
  durationSeconds: number | null;
  bitrateKbps: number | null;
  hasAudio: boolean;
  audioCodec: string | null;
  audioChannels: number | null;
  audioChannelLayout: string | null;
  audioSampleRateHz: number | null;
  audioSampleFormat: string | null;
  audioBitrateKbps: number | null;
};

function parseFps(raw: string | undefined): number {
  if (!raw || raw === "0/0") {
    return 0;
  }

  const [numToken, denToken] = raw.split("/");
  const numerator = Number.parseFloat(numToken ?? "");
  const denominator = Number.parseFloat(denToken ?? "");

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  const value = numerator / denominator;
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.001) {
    return rounded;
  }
  return Number.parseFloat(value.toFixed(3));
}

function parseDurationSeconds(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Number.parseFloat(value.toFixed(3));
}

function parseBitrateKbps(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value / 1000);
}

function parseChannels(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

function parseSampleRate(raw: unknown): number | null {
  const value = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseNullableString(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }
  return value;
}

export function readVideoMetadata(path: string): VideoMetadata {
  const proc = runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,channels,channel_layout,sample_fmt,sample_rate,bit_rate:format=duration,bit_rate",
    "-of",
    "json",
    path,
  ]);

  if (proc.exitCode !== 0) {
    throw new Error(`ffprobe failed for ${path}: ${proc.stderr.trim()}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(proc.stdout);
  } catch {
    throw new Error(`ffprobe returned invalid JSON for ${path}`);
  }

  const streams = (parsed as { streams?: Array<Record<string, unknown>> }).streams;
  if (!streams || streams.length === 0) {
    throw new Error(`ffprobe returned no video stream for ${path}`);
  }
  const videoStream =
    streams.find((item) => item.codec_type === "video") ??
    streams.find((item) => Number(item.width) > 0 && Number(item.height) > 0);
  if (!videoStream) {
    throw new Error(`ffprobe returned no video stream for ${path}`);
  }
  const audioStream = streams.find((item) => item.codec_type === "audio");
  const format = (parsed as { format?: Record<string, unknown> }).format;

  const width = Number(videoStream.width);
  const height = Number(videoStream.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid video dimensions in ${path}`);
  }

  const codecToken = videoStream.codec_name;
  const codec = typeof codecToken === "string" && codecToken.length > 0 ? codecToken : null;
  const avgFrameRate =
    typeof videoStream.avg_frame_rate === "string" ? videoStream.avg_frame_rate : undefined;
  const realFrameRate =
    typeof videoStream.r_frame_rate === "string" ? videoStream.r_frame_rate : undefined;
  const fps = parseFps(avgFrameRate) || parseFps(realFrameRate);
  const durationRaw = typeof format?.duration === "string" ? format.duration : undefined;
  const bitrateRaw = typeof format?.bit_rate === "string" ? format.bit_rate : undefined;
  const durationSeconds = parseDurationSeconds(durationRaw);
  const bitrateKbps = parseBitrateKbps(bitrateRaw);
  const audioCodecToken = audioStream?.codec_name;
  const audioCodec =
    typeof audioCodecToken === "string" && audioCodecToken.length > 0 ? audioCodecToken : null;
  const hasAudio = audioCodec !== null;
  const audioChannels = parseChannels(audioStream?.channels);
  const audioChannelLayout = parseNullableString(audioStream?.channel_layout);
  const audioSampleRateHz = parseSampleRate(audioStream?.sample_rate);
  const audioSampleFormat = parseNullableString(audioStream?.sample_fmt);
  const audioBitrateRaw =
    typeof audioStream?.bit_rate === "string" ? audioStream.bit_rate : undefined;
  const audioBitrateKbps = parseBitrateKbps(audioBitrateRaw);

  return {
    width,
    height,
    codec,
    fps,
    durationSeconds,
    bitrateKbps,
    hasAudio,
    audioCodec,
    audioChannels,
    audioChannelLayout,
    audioSampleRateHz,
    audioSampleFormat,
    audioBitrateKbps,
  };
}
