import type {
  SeamBricksAssemblyEffects,
  SeamBricksAssemblyMotion,
  SeamBricksCameraFitConfig,
  SeamBricksConfig,
  SeamBricksIconConfig,
  SeamBricksLabelConfig,
  SeamBricksMaterialPalette,
  SeamBricksPaletteName,
  SeamBricksPegConfig,
  SeamBricksPieceConfig,
  SeamBricksPieceEffects,
  SeamBricksPieceLength,
  SeamBricksPieceOpenTransform,
  SeamBricksPresetName,
} from "./types";
import {
  mergeMaterialPalette,
  SEAM_BRICKS_MATERIAL_PALETTES,
} from "./themes";
import {
  SEAM_BRICKS_ICON_PIXELS,
  type SeamBricksIconName,
} from "./icons";

export const SEAM_BRICKS_LENGTHS = Object.freeze({
  short: 1.48,
  medium: 3.45,
  long: 6.89,
}) satisfies Readonly<Record<SeamBricksPieceLength, number>>;

export const SEAM_BRICKS_FONT_FAMILY =
  '"Geist Pixel Square", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const DEFAULT_LABEL = Object.freeze({
  text: "",
  fontFamily: SEAM_BRICKS_FONT_FAMILY,
  fontWeight: 400,
  fontScale: 0.43,
  letterSpacing: 0,
  paddingX: 0.54,
  offsetX: 0,
  offsetY: 0,
  opacity: 1,
  glow: 3,
  resolution: 384,
}) satisfies Readonly<Required<Omit<SeamBricksLabelConfig, "color">>>;

const DEFAULT_PEG = Object.freeze({
  sides: "right",
  width: 0.32,
  height: 0.8,
  depth: 0.32,
  offsetY: 0,
}) satisfies Readonly<Required<SeamBricksPegConfig>>;

const DEFAULT_MOTION = Object.freeze({
  separation: 1.15,
  tilt: -27,
  lift: 0.025,
  scaleY: 0.9,
  stagger: 0,
}) satisfies Readonly<Required<SeamBricksAssemblyMotion>>;

const DEFAULT_CAMERA = Object.freeze({
  enabled: true,
  padding: 32,
  scale: 1,
}) satisfies Readonly<Required<SeamBricksCameraFitConfig>>;

const DEFAULT_EFFECTS = Object.freeze({
  shadows: true,
  accentLights: true,
  maxAccentLights: 4,
}) satisfies Readonly<Required<SeamBricksAssemblyEffects>>;

export interface ResolvedSeamBricksLabelConfig
  extends Required<Omit<SeamBricksLabelConfig, "color">> {
  color?: string;
}

export interface ResolvedSeamBricksIconConfig
  extends Required<Omit<SeamBricksIconConfig, "color">> {
  color?: string;
}

export interface ResolvedSeamBricksPieceConfig {
  id: string;
  width: number;
  height: number;
  depth: number;
  paletteName: SeamBricksPaletteName;
  palette: SeamBricksMaterialPalette;
  label: ResolvedSeamBricksLabelConfig | null;
  icon: ResolvedSeamBricksIconConfig | null;
  peg: Required<SeamBricksPegConfig>;
  offset: readonly [number, number, number];
  open: Required<SeamBricksPieceOpenTransform>;
  effects: SeamBricksPieceEffects;
  interactive: boolean;
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  source: SeamBricksPieceConfig;
}

export interface ResolvedSeamBricksConfig {
  pieces: ResolvedSeamBricksPieceConfig[];
  gap: number;
  origin: readonly [number, number, number];
  motion: Required<SeamBricksAssemblyMotion>;
  camera: Required<SeamBricksCameraFitConfig>;
  effects: Required<SeamBricksAssemblyEffects>;
  source: SeamBricksConfig;
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function positive(value: number | undefined, fallback: number, minimum = 0.01): number {
  return Math.max(minimum, finite(value, fallback));
}

function resolveLabel(
  label: SeamBricksPieceConfig["label"],
  defaults: SeamBricksConfig["label"],
): ResolvedSeamBricksLabelConfig | null {
  if (label === false || label === undefined) return null;
  const input = typeof label === "string" ? { text: label } : label;
  if (!input.text) return null;
  const merged = { ...DEFAULT_LABEL, ...defaults, ...input };
  return {
    ...merged,
    text: String(merged.text),
    fontFamily: String(merged.fontFamily),
    fontWeight: merged.fontWeight,
    fontScale: positive(merged.fontScale, DEFAULT_LABEL.fontScale, 0.05),
    letterSpacing: finite(merged.letterSpacing, 0),
    paddingX: Math.max(0, finite(merged.paddingX, DEFAULT_LABEL.paddingX)),
    offsetX: finite(merged.offsetX, 0),
    offsetY: finite(merged.offsetY, 0),
    opacity: Math.min(1, Math.max(0, finite(merged.opacity, 1))),
    glow: Math.max(0, finite(merged.glow, 3)),
    resolution: Math.round(
      Math.min(1024, Math.max(128, finite(merged.resolution, 384))),
    ),
  };
}

function resolveIcon(icon: SeamBricksPieceConfig["icon"]): ResolvedSeamBricksIconConfig | null {
  if (!icon) return null;
  const input = typeof icon === "string" ? { name: icon } : icon;
  const requestedName = input.name ?? "chevron";
  const name: SeamBricksIconName = Object.hasOwn(
    SEAM_BRICKS_ICON_PIXELS,
    requestedName,
  )
    ? requestedName
    : "chevron";
  return {
    name,
    pixels: input.pixels?.length ? input.pixels : SEAM_BRICKS_ICON_PIXELS[name],
    pixelSize: positive(input.pixelSize, 0.12),
    depth: positive(input.depth, 0.065),
    scale: positive(input.scale, 1),
    offsetX: finite(input.offsetX, 0),
    offsetY: finite(input.offsetY, 0),
    color: input.color,
    opacity: Math.min(1, Math.max(0, finite(input.opacity, 1))),
  };
}

function resolvePeg(
  peg: SeamBricksPieceConfig["peg"],
  defaults: SeamBricksConfig["peg"],
): Required<SeamBricksPegConfig> {
  if (peg === false) return { ...DEFAULT_PEG, sides: "none" };
  const input = peg === true || peg === undefined ? {} : peg;
  const merged = { ...DEFAULT_PEG, ...defaults, ...input };
  return {
    sides: merged.sides,
    width: positive(merged.width, DEFAULT_PEG.width),
    height: positive(merged.height, DEFAULT_PEG.height),
    depth: positive(merged.depth, DEFAULT_PEG.depth),
    offsetY: finite(merged.offsetY, 0),
  };
}

function withStablePieceIds(config: SeamBricksConfig): SeamBricksConfig {
  const used = new Set<string>();
  return {
    ...config,
    pieces: config.pieces.map((piece, index) => {
      const base = piece.id?.trim() || `piece-${index + 1}`;
      let id = base;
      let suffix = 2;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      return { ...piece, id };
    }),
  };
}

export function createSeamBricksPreset(
  preset: SeamBricksPresetName = "classic",
  label = "Seam",
): SeamBricksConfig {
  if (preset === "compact") {
    return {
      pieces: [
        { id: "mark", length: "medium", palette: "mint", label },
        { id: "action", length: "short", palette: "blue", icon: "chevron" },
      ],
      motion: { separation: 0.8, tilt: -24 },
    };
  }

  if (preset === "trio") {
    return {
      pieces: [
        { id: "long", length: "long", palette: "mint", label },
        { id: "medium", length: "medium", palette: "blue", label: "MAKE" },
        {
          id: "short",
          length: "short",
          palette: "mint",
          icon: "chevron",
          peg: { sides: "right" },
        },
      ],
      gap: 0,
      motion: { separation: 0.82, tilt: -24, stagger: 0.045 },
      effects: { maxAccentLights: 4 },
    };
  }

  return {
    pieces: [
      {
        id: "main",
        length: "long",
        palette: "mint",
        label,
      },
      {
        id: "action",
        length: "short",
        palette: "blue",
        icon: "chevron",
      },
    ],
    motion: { separation: 1.15, tilt: -27, lift: 0.025, scaleY: 0.9 },
  };
}

export const SEAM_BRICKS_PRESETS = Object.freeze({
  classic: createSeamBricksPreset("classic"),
  compact: createSeamBricksPreset("compact"),
  trio: createSeamBricksPreset("trio"),
}) satisfies Readonly<Record<SeamBricksPresetName, SeamBricksConfig>>;

export function resolveSeamBricksConfig(config: SeamBricksConfig): ResolvedSeamBricksConfig {
  const source = withStablePieceIds(
    config.pieces.length > 0 ? config : createSeamBricksPreset(),
  );
  const motion = { ...DEFAULT_MOTION, ...source.motion };
  const camera = { ...DEFAULT_CAMERA, ...source.camera };
  const effects = { ...DEFAULT_EFFECTS, ...source.effects };
  const visiblePieces = source.pieces.filter((piece) => piece.visible !== false);
  const count = Math.max(1, visiblePieces.length);
  const height = positive(source.height, 1.51);
  const depth = positive(source.depth, 1.48);
  const defaultPalette = source.palette ?? "mint";

  const pieces = visiblePieces.map((piece, index): ResolvedSeamBricksPieceConfig => {
    const paletteName = piece.palette ?? defaultPalette;
    const basePalette = SEAM_BRICKS_MATERIAL_PALETTES[paletteName];
    const autoDirection = count === 1 ? 0 : index / (count - 1) - 0.5;
    const autoTravel =
      count === 2
        ? index === 0
          ? -motion.separation * 0.13
          : motion.separation
        : autoDirection * motion.separation * 2;
    const delay = Math.min(
      0.8,
      Math.max(0, finite(piece.open?.delay, index * motion.stagger)),
    );
    return {
      id: piece.id!,
      width: positive(
        piece.width,
        SEAM_BRICKS_LENGTHS[piece.length ?? "medium"],
      ),
      height: positive(piece.height, height),
      depth: positive(piece.depth, depth),
      paletteName,
      palette: mergeMaterialPalette(basePalette, piece.paletteOverrides),
      label: resolveLabel(piece.label, source.label),
      icon: resolveIcon(piece.icon),
      peg: resolvePeg(piece.peg, source.peg),
      offset: piece.offset ?? [0, 0, 0],
      open: {
        x: finite(piece.open?.x, autoTravel),
        y: finite(piece.open?.y, motion.lift),
        z: finite(piece.open?.z, 0),
        rotateX: finite(piece.open?.rotateX, motion.tilt),
        rotateY: finite(piece.open?.rotateY, 0),
        rotateZ: finite(piece.open?.rotateZ, 0),
        scaleX: positive(piece.open?.scaleX, 1),
        scaleY: positive(piece.open?.scaleY, motion.scaleY),
        scaleZ: positive(piece.open?.scaleZ, 1),
        delay,
      },
      effects: { ...piece.effects },
      interactive: piece.interactive !== false,
      visible: piece.visible !== false,
      castShadow: piece.castShadow !== false,
      receiveShadow: piece.receiveShadow !== false,
      source: { ...piece },
    };
  });

  return {
    pieces,
    gap: finite(source.gap, 0),
    origin: source.origin ?? [0, 0.185, 0],
    motion: {
      separation: finite(motion.separation, DEFAULT_MOTION.separation),
      tilt: finite(motion.tilt, DEFAULT_MOTION.tilt),
      lift: finite(motion.lift, DEFAULT_MOTION.lift),
      scaleY: positive(motion.scaleY, DEFAULT_MOTION.scaleY),
      stagger: Math.max(0, finite(motion.stagger, 0)),
    },
    camera: {
      enabled: camera.enabled !== false,
      padding: Math.max(0, finite(camera.padding, DEFAULT_CAMERA.padding)),
      scale: positive(camera.scale, 1),
    },
    effects: {
      shadows: effects.shadows !== false,
      accentLights: effects.accentLights !== false,
      maxAccentLights: Math.max(
        0,
        Math.floor(finite(effects.maxAccentLights, DEFAULT_EFFECTS.maxAccentLights)),
      ),
    },
    source,
  };
}

export function cloneSeamBricksConfig(config: SeamBricksConfig): SeamBricksConfig {
  return {
    ...config,
    pieces: config.pieces.map((piece) => ({
      ...piece,
      offset: piece.offset ? [...piece.offset] : undefined,
      label:
        piece.label && typeof piece.label === "object"
          ? { ...piece.label }
          : piece.label,
      icon:
        piece.icon && typeof piece.icon === "object"
          ? { ...piece.icon, pixels: piece.icon.pixels?.map((pixel) => [...pixel] as const) }
          : piece.icon,
      peg: piece.peg && typeof piece.peg === "object" ? { ...piece.peg } : piece.peg,
      open: piece.open ? { ...piece.open } : undefined,
      effects: piece.effects ? { ...piece.effects } : undefined,
      paletteOverrides: piece.paletteOverrides
        ? {
            ...piece.paletteOverrides,
            frontClosed: piece.paletteOverrides.frontClosed?.map(
              ([offset, color]) => [offset, color] as const,
            ),
            frontOpen: piece.paletteOverrides.frontOpen?.map(
              ([offset, color]) => [offset, color] as const,
            ),
            bottom: piece.paletteOverrides.bottom?.map(
              ([offset, color]) => [offset, color] as const,
            ),
            peg: piece.paletteOverrides.peg
              ? [...piece.paletteOverrides.peg]
              : undefined,
          }
        : undefined,
    })),
    origin: config.origin ? [...config.origin] : undefined,
    peg: config.peg ? { ...config.peg } : undefined,
    label: config.label ? { ...config.label } : undefined,
    motion: config.motion ? { ...config.motion } : undefined,
    camera: config.camera ? { ...config.camera } : undefined,
    effects: config.effects ? { ...config.effects } : undefined,
  };
}
