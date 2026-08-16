import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
import type { SeamBricksIconName } from "./icons";

export type SeamBricksThemeName = "paper" | "nocturne";
export type SeamBricksStateSource = "api" | "focus" | "hover" | "keyboard";
export type SeamBricksHoverMode = "assembly" | "piece";
export type SeamBricksGradientStop = readonly [offset: number, color: string];
export type SeamBricksPaletteName =
  | "blue"
  | "yellow"
  | "coral"
  | "violet"
  | "mint"
  | "rose";
export type SeamBricksPieceLength = "short" | "medium" | "long";
export type SeamBricksPresetName = "classic" | "compact" | "trio";
export type SeamBricksPegSides = "none" | "left" | "right" | "both";

export interface SeamBricksMaterialPalette {
  frontClosed: readonly SeamBricksGradientStop[];
  frontOpen: readonly SeamBricksGradientStop[];
  bottom: readonly SeamBricksGradientStop[];
  top: string;
  side: string;
  back: string;
  peg: readonly [string, string];
  shadow: string;
  shadowOpacity: number;
  glow: string;
  glowIntensity: number;
  underLight: string;
  underLightIntensity: number;
}

export type SeamBricksMaterialPaletteOverrides = Partial<SeamBricksMaterialPalette>;

export interface SeamBricksLabelConfig {
  /** Visible text. Empty text removes the label plane. */
  text: string;
  /** Canvas font stack. @default '"Geist Pixel Square", ui-monospace, monospace' */
  fontFamily?: string;
  /** CSS canvas font weight. @default 400 */
  fontWeight?: number | string;
  /** Label size relative to the brick height. @default 0.43 */
  fontScale?: number;
  /** Extra spacing in em units. @default 0 */
  letterSpacing?: number;
  /** Maximum horizontal inset in world units; narrow bricks cap it at 7%. @default 0.54 */
  paddingX?: number;
  /** Label offset in world units. */
  offsetX?: number;
  /** Label offset in world units. */
  offsetY?: number;
  /** Optional label colour; the active theme colour is used when omitted. */
  color?: string;
  /** Label opacity. @default 1 */
  opacity?: number;
  /** White texture glow in canvas pixels. @default 3 */
  glow?: number;
  /** Texture height; width follows the brick aspect ratio. @default 384 */
  resolution?: number;
}

export interface SeamBricksIconConfig {
  /** Built-in pixel icon. @default "chevron" */
  name?: SeamBricksIconName;
  /** Custom pixel coordinates in grid units. Overrides the built-in icon. */
  pixels?: readonly (readonly [x: number, y: number])[];
  /** Width and height of each pixel in world units. @default 0.12 */
  pixelSize?: number;
  /** Extrusion depth in world units. @default 0.065 */
  depth?: number;
  /** Uniform icon scale. @default 1 */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  /** Optional icon colour; the active theme label colour is used when omitted. */
  color?: string;
  opacity?: number;
}

export interface SeamBricksPegConfig {
  /** Which brick edges receive connector pegs. @default "right" */
  sides?: SeamBricksPegSides;
  width?: number;
  height?: number;
  depth?: number;
  offsetY?: number;
}

export interface SeamBricksPieceOpenTransform {
  /** World-unit translation applied while open. */
  x?: number;
  y?: number;
  z?: number;
  /** Rotation in degrees. */
  rotateX?: number;
  /** Rotation in degrees. */
  rotateY?: number;
  /** Rotation in degrees. */
  rotateZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  /** Normalised stagger delay between 0 and 0.8. */
  delay?: number;
}

export interface SeamBricksPieceEffects {
  shadow?: boolean;
  shadowColor?: string;
  shadowOpacity?: number;
  glow?: boolean;
  glowColor?: string;
  glowIntensity?: number;
  underLightColor?: string;
  underLightIntensity?: number;
}

export interface SeamBricksPieceConfig {
  /** Stable identifier used by imperative updates. */
  id?: string;
  /** Named width token. An explicit width wins over this token. */
  length?: SeamBricksPieceLength;
  width?: number;
  height?: number;
  depth?: number;
  palette?: SeamBricksPaletteName;
  paletteOverrides?: SeamBricksMaterialPaletteOverrides;
  /** String shorthand or detailed editable label. */
  label?: string | (Partial<SeamBricksLabelConfig> & { text: string }) | false;
  /** Built-in pixel icon, a custom pixel icon, or false. */
  icon?: SeamBricksIconName | SeamBricksIconConfig | false;
  /** Connector shorthand or detailed connector geometry. */
  peg?: boolean | SeamBricksPegConfig;
  /** Static offset from the computed layout position. */
  offset?: readonly [x: number, y: number, z: number];
  /** Per-piece hover/open transform. */
  open?: SeamBricksPieceOpenTransform;
  effects?: SeamBricksPieceEffects;
  interactive?: boolean;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface SeamBricksAssemblyMotion {
  /** Automatic outward travel for pieces without an explicit open.x/y. */
  separation?: number;
  /** Default X-axis tilt in degrees. */
  tilt?: number;
  /** Default vertical travel in world units. */
  lift?: number;
  /** Default open-state Y scale. */
  scaleY?: number;
  /** Normalised delay added per piece. */
  stagger?: number;
}

export interface SeamBricksCameraFitConfig {
  /** Fits arbitrary assemblies inside the host. @default true */
  enabled?: boolean;
  /** Minimum screen padding in CSS pixels. @default 32 */
  padding?: number;
  /** Multiplier applied after fitting. @default 1 */
  scale?: number;
}

export interface SeamBricksAssemblyEffects {
  shadows?: boolean;
  accentLights?: boolean;
  /** Caps dynamic RectAreaLights while material gradients remain unlimited. @default 4 */
  maxAccentLights?: number;
}

export interface SeamBricksConfig {
  pieces: readonly SeamBricksPieceConfig[];
  gap?: number;
  origin?: readonly [x: number, y: number, z: number];
  height?: number;
  depth?: number;
  palette?: SeamBricksPaletteName;
  peg?: SeamBricksPegConfig;
  label?: Partial<Omit<SeamBricksLabelConfig, "text">>;
  motion?: SeamBricksAssemblyMotion;
  camera?: SeamBricksCameraFitConfig;
  effects?: SeamBricksAssemblyEffects;
}

export interface SeamBricksSceneTheme {
  background: string;
  materialExposure: number;
  materialSaturation: number;
  labelColor: string;
  labelIntensity: number;
  bloomMultiplier: number;
  floor: string;
  floorEmissive: string;
  floorEmissiveIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  keyLight: string;
  keyLightIntensity: number;
  faceLight: string;
  faceLightIntensity: number;
  fillLight: string;
  fillLightIntensity: number;
  shadowOpacityMultiplier: number;
  glowIntensityMultiplier: number;
  underLightIntensityMultiplier: number;
}

export type SeamBricksTheme =
  | SeamBricksThemeName
  | (Partial<SeamBricksSceneTheme> & { name?: string });

export interface SeamBricksBloomOptions {
  strength?: number;
  radius?: number;
  threshold?: number;
}

export interface SeamBricksMotionOptions {
  mainTravel?: number;
  yellowTravel?: number;
  tilt?: number;
  separation?: number;
  lift?: number;
  scaleY?: number;
  stagger?: number;
}

export interface SeamBricksCameraView {
  position?: readonly [x: number, y: number, z: number];
  target?: readonly [x: number, y: number, z: number];
  zoom?: number;
}

export interface SeamBricksRendererOptions {
  label: string;
  blue: string;
  yellow: string;
  theme: SeamBricksTheme;
  mainWidth: number;
  yellowWidth: number;
  height: number;
  depth: number;
  pegWidth: number;
  pegHeight: number;
  pegDepth: number;
  mainTravel: number;
  yellowTravel: number;
  tilt: number;
  openScaleY: number;
  baseY: number;
  verticalTravel: number;
  pixelsPerUnit: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  openDuration: number;
  closeDuration: number;
  maxDpr: number;
  interactive: boolean;
  hoverMode: SeamBricksHoverMode;
  orbit: boolean;
  continuous: boolean;
  postprocessing: boolean;
  respectReducedMotion: boolean;
  initialOpen: boolean;
  config?: SeamBricksConfig;
  bluePalette?: SeamBricksMaterialPaletteOverrides;
  yellowPalette?: SeamBricksMaterialPaletteOverrides;
}

export interface SeamBricksSetOpenOptions {
  immediate?: boolean;
  source?: SeamBricksStateSource;
}

export interface SeamBricksStateChangeDetail {
  open: boolean;
  source: SeamBricksStateSource;
}

export interface SeamBricksPieceHoverDetail {
  pieceId: string | null;
}

export interface SeamBricksProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "children" | "color" | "onChange"
  > {
  /** Text drawn on the main prism. @default "Seam" */
  label?: string;
  /** Fully data-driven assembly. When present it takes precedence over preset and label. */
  config?: SeamBricksConfig;
  /** Built-in starting assembly. @default "classic" */
  preset?: SeamBricksPresetName;
  /** Controlled visual state. Omit to let hover and keyboard focus own it. */
  open?: boolean;
  /** Enables raycast hover and keyboard interaction. @default true */
  interactive?: boolean;
  /** Opens the complete assembly or foregrounds one raycast piece at a time. @default "assembly" */
  hoverMode?: SeamBricksHoverMode;
  /** Enables drag-to-orbit camera controls. @default false */
  orbit?: boolean;
  /** Keeps rendering every frame. The default is on-demand rendering. @default false */
  continuous?: boolean;
  /** Enables bloom post-processing. @default true */
  postprocessing?: boolean;
  /** Obeys prefers-reduced-motion and resolves motion immediately. @default true */
  respectReducedMotion?: boolean;
  /** Paper, Nocturne, or a partial scene theme. @default "paper" */
  theme?: SeamBricksTheme;
  /** Maximum device pixel ratio used by the renderer. @default 2 */
  maxDpr?: number;
  /** Gap travelled by the yellow prism in world units. @default 1.15 */
  separation?: number;
  /** Open-state X rotation in degrees. @default -27 */
  tilt?: number;
  /** Bloom strength. @default 0.08 */
  bloomStrength?: number;
  /** Optional material overrides for the main prism. */
  bluePalette?: SeamBricksMaterialPaletteOverrides;
  /** Optional material overrides for the arrow prism. */
  yellowPalette?: SeamBricksMaterialPaletteOverrides;
  /** Content shown only when WebGL cannot be initialised. */
  fallback?: ReactNode;
  /** Class applied to the generated canvas. */
  canvasClassName?: string;
  /** Inline styles for the generated canvas. */
  canvasStyle?: CSSProperties;
  /** Called after the renderer is created and again with null during teardown. */
  onReady?: (renderer: SeamBricksRendererHandle | null) => void;
  /** Called for hover, focus, keyboard, and imperative state changes. */
  onOpenChange?: (open: boolean, source: SeamBricksStateSource) => void;
  /** Called when raycasting enters another configured brick. */
  onPieceHoverChange?: (pieceId: string | null) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export interface SeamBricksRendererHandle {
  setOpen(open: boolean, options?: SeamBricksSetOpenOptions): this;
  setConfig(config: SeamBricksConfig): this;
  getConfig(): SeamBricksConfig;
  setLabel(label: string): this;
  setPieceLabel(pieceId: string, label: string): this;
  setPiece(pieceId: string, patch: Partial<SeamBricksPieceConfig>): this;
  setTheme(theme: SeamBricksTheme): this;
  setBloom(options?: SeamBricksBloomOptions): this;
  setMotion(options?: SeamBricksMotionOptions): this;
  setPalette(
    piece: "blue" | "yellow" | string,
    overrides: SeamBricksMaterialPaletteOverrides,
  ): this;
  setInteractive(interactive: boolean): this;
  setHoverMode(mode: SeamBricksHoverMode): this;
  setActivePiece(pieceId: string | null): this;
  setOrbitEnabled(enabled: boolean): this;
  setContinuous(enabled: boolean): this;
  setCameraView(view?: SeamBricksCameraView): this;
  resetCamera(): this;
  invalidate(): this;
  destroy(): void;
}
