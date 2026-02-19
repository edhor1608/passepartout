export const MODES = ["reliable", "experimental"] as const;
export type Mode = (typeof MODES)[number];

export const SURFACES = ["feed", "story", "reel"] as const;
export type Surface = (typeof SURFACES)[number];

export const ORIENTATIONS = ["portrait", "square", "landscape"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const WORKFLOWS = ["app_direct", "api_scheduler", "unknown"] as const;
export type Workflow = (typeof WORKFLOWS)[number];

export const CANVAS_PROFILES = ["feed_compat", "feed_app_direct"] as const;
export type CanvasProfile = (typeof CANVAS_PROFILES)[number];
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
};
