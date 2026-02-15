export type Mode = "reliable" | "experimental";
export type Surface = "feed" | "story" | "reel";
export type Orientation = "portrait" | "square" | "landscape";
export type Workflow = "app_direct" | "api_scheduler" | "unknown";
export type CanvasProfile = "feed_compat" | "feed_app_direct";
export type CanvasStyle = "gallery_clean" | "polaroid_classic";
export type WhiteCanvasResolvedProfile = CanvasProfile | "story_default" | "reel_default";
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
    default_style: CanvasStyle;
    styles: Record<CanvasStyle, { extra_bottom_ratio: number }>;
  };
};

export type RecommendInput = {
  mode: Mode;
  surface: Surface;
  orientation: Orientation;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
  canvasStyle?: CanvasStyle;
  sourceRatio?: number;
};

export type WhiteCanvasOutput = {
  enabled: boolean;
  profile: WhiteCanvasResolvedProfile | null;
  style: CanvasStyle | null;
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
  audio_channel_layout: string | null;
  audio_sample_rate_hz: number | null;
  audio_sample_format: string | null;
  audio_bitrate_kbps: number | null;
};

export type AnalyzeInput = {
  file: string;
  mode: Mode;
  surface: Surface;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
  canvasStyle?: CanvasStyle;
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
  canvasStyle?: CanvasStyle;
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
  canvasStyle?: CanvasStyle;
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
  output_has_audio: boolean;
  output_audio_codec: string | null;
};

export type ReportInput = AnalyzeInput;

export type ReportCheckStatus = "pass" | "warn";

export type ReportCheck = {
  id: string;
  label: string;
  status: ReportCheckStatus;
  message: string;
};

export type ReportOutput = {
  analyze: AnalyzeOutput;
  checks: ReportCheck[];
  next_actions: string[];
};

export type ReportExportInput = {
  file: string;
  out: string;
  mode: Mode;
  surface: Surface;
  workflow?: Workflow;
  whiteCanvas?: boolean;
  canvasProfile?: CanvasProfile;
  canvasStyle?: CanvasStyle;
};

export type ReportExportOutput = {
  input_analyze: AnalyzeOutput;
  export: ExportImageOutput | ExportVideoOutput;
  output_analyze: AnalyzeOutput;
  comparison: {
    input_resolution: Resolution;
    output_resolution: Resolution;
    target_resolution: Resolution;
    output_matches_target: boolean;
    input_bitrate_kbps: number | null;
    output_bitrate_kbps: number | null;
    bitrate_delta_kbps: number | null;
    input_colorspace: string;
    output_colorspace: string;
    input_has_audio: boolean;
    output_has_audio: boolean;
    notes: string[];
  };
};

export type BenchmarkInput = ReportExportInput;

export type BenchmarkOutput = {
  benchmark_version: "v1";
  report_export: ReportExportOutput;
  score: {
    total: number;
    grade: "A" | "B" | "C" | "D";
    resolution_score: number;
    bitrate_score: number;
    codec_score: number;
  };
};

export type OverlayRatio = "4:5" | "3:4" | "9:16";

export type OverlayOutput = {
  ratio: OverlayRatio;
  canvas_resolution: Resolution;
  canvas: {
    width: number;
    height: number;
  };
  safe_zone: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  thirds: {
    vertical: [number, number];
    horizontal: [number, number];
  };
  output_svg_path?: string;
};
