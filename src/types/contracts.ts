export type Mode = "reliable" | "experimental";
export type Surface = "feed" | "story" | "reel";
export type Orientation = "portrait" | "square" | "landscape";
export type Workflow = "app_direct" | "api_scheduler" | "unknown";
export type CanvasProfile = "feed_compat" | "feed_app_direct";
export type RiskLevel = "low" | "medium" | "high";
export type Resolution = `${number}x${number}`;

export type Margins = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ProfileRule = {
  resolution: Resolution;
  profile: string;
  reason: string;
  risk_level: RiskLevel;
};

export type ModeRules = {
  feed: Record<Orientation, ProfileRule>;
  story: ProfileRule;
  reel: ProfileRule;
};

export type Ruleset = {
  version: string;
  profiles: Record<Mode, ModeRules>;
  white_canvas: {
    profiles: Record<CanvasProfile, { resolution: Resolution }>;
    app_direct_only_profiles: CanvasProfile[];
  };
};

export type RecommendInput = {
  mode: Mode;
  surface: Surface;
  orientation: Orientation;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
  sourceRatio?: number;
};

export type WhiteCanvasOutput = {
  enabled: boolean;
  profile: CanvasProfile | null;
  margins: Margins | null;
  contain_only: boolean;
  no_crop: boolean;
};

export type RecommendationOutput = {
  selected_mode: Mode;
  selected_profile: string;
  target_resolution: Resolution;
  reason: string;
  risk_level: RiskLevel;
  workflow_note: string;
  white_canvas: WhiteCanvasOutput;
};

export type TierName =
  | "tier_upscale"
  | "tier_preserve"
  | "tier_downscale"
  | "tier_aspect_correction";

export type TierOutput = {
  name: TierName;
  reason: string;
  risk_level: RiskLevel;
};

export type MediaInspection = {
  path: string;
  width: number;
  height: number;
  aspect_ratio: string;
  orientation: Orientation;
  colorspace: string;
  codec: string | null;
  fps: number;
  duration_seconds: number | null;
  bitrate_kbps: number | null;
  has_audio: boolean;
  audio_codec: string | null;
  audio_channels: number | null;
  audio_sample_rate_hz: number | null;
  audio_bitrate_kbps: number | null;
};

export type AnalyzeInput = {
  file: string;
  mode: Mode;
  surface: Surface;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
};

export type AnalyzeOutput = {
  input: MediaInspection;
  selection: {
    mode: Mode;
    surface: Surface;
    workflow: Workflow;
    profile: string;
    target_resolution: Resolution;
  };
  tier: TierOutput;
  white_canvas: WhiteCanvasOutput;
};

export type ExportImageInput = {
  file: string;
  out: string;
  mode: Mode;
  surface: Surface;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
  quality?: number;
};

export type ExportImageOutput = {
  input_path: string;
  output_path: string;
  selected_profile: string;
  target_resolution: Resolution;
  white_canvas_enabled: boolean;
  ffmpeg_filter: string;
};

export type ExportVideoInput = {
  file: string;
  out: string;
  mode: Mode;
  surface: Surface;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
  crf?: number;
};

export type ExportVideoOutput = {
  input_path: string;
  output_path: string;
  selected_profile: string;
  target_resolution: Resolution;
  white_canvas_enabled: boolean;
  ffmpeg_filter: string;
  video_codec: string;
  fps: number;
  output_width: number;
  output_height: number;
  output_codec: string | null;
  output_fps: number;
};
