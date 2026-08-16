import * as THREE from "three";
import { truncateLabelText } from "./text";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  cloneSeamBricksConfig,
  createSeamBricksPreset,
  resolveSeamBricksConfig,
  SEAM_BRICKS_FONT_FAMILY,
  type ResolvedSeamBricksConfig,
  type ResolvedSeamBricksLabelConfig,
  type ResolvedSeamBricksPieceConfig,
} from "./config";
import { SEAM_BRICKS_CLOSE_EASE, SEAM_BRICKS_OPEN_EASE } from "./easing";
import {
  mergeMaterialPalette,
  resolveSeamBricksTheme,
  SEAM_BRICKS_MATERIAL_PALETTES,
} from "./themes";
import type {
  SeamBricksBloomOptions,
  SeamBricksCameraView,
  SeamBricksConfig,
  SeamBricksHoverMode,
  SeamBricksMaterialPalette,
  SeamBricksMaterialPaletteOverrides,
  SeamBricksMotionOptions,
  SeamBricksPieceConfig,
  SeamBricksRendererHandle,
  SeamBricksRendererOptions,
  SeamBricksSceneTheme,
  SeamBricksSetOpenOptions,
  SeamBricksStateChangeDetail,
  SeamBricksTheme,
} from "./types";
import geistPixelUrl from "./assets/GeistPixel-Square.woff2?url";

export const DEFAULT_SEAM_BRICKS_OPTIONS = Object.freeze({
  label: "Seam",
  blue: "#6ea7e7",
  yellow: "#ffd45c",
  theme: "paper",
  mainWidth: 6.89,
  yellowWidth: 1.48,
  height: 1.51,
  depth: 1.48,
  pegWidth: 0.32,
  pegHeight: 0.8,
  pegDepth: 0.32,
  mainTravel: 0.15,
  yellowTravel: 1.15,
  tilt: THREE.MathUtils.degToRad(-27),
  openScaleY: 0.9,
  baseY: 0.185,
  verticalTravel: 0.025,
  pixelsPerUnit: 100,
  bloomStrength: 0.08,
  bloomRadius: 0.62,
  bloomThreshold: 1.02,
  openDuration: 400,
  closeDuration: 310,
  maxDpr: 2,
  interactive: true,
  hoverMode: "assembly",
  orbit: false,
  continuous: false,
  postprocessing: true,
  respectReducedMotion: true,
  initialOpen: false,
}) satisfies Readonly<SeamBricksRendererOptions>;

type BodyMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>;
type LabelMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

interface PieceEffectsRuntime {
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  shadowMaterial: THREE.ShaderMaterial | null;
  glow: THREE.RectAreaLight | null;
  underLight: THREE.RectAreaLight | null;
}

interface PieceRuntime {
  id: string;
  config: ResolvedSeamBricksPieceConfig;
  group: THREE.Group;
  body: BodyMesh;
  hitArea: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  pegs: BodyMesh[];
  material: THREE.MeshPhysicalMaterial;
  labelPlane: LabelMesh | null;
  iconGroup: THREE.Group | null;
  contentMaterials: THREE.MeshBasicMaterial[];
  palette: SeamBricksMaterialPalette;
  basePosition: THREE.Vector3;
  effects: PieceEffectsRuntime;
  hoverProgress: number;
}

interface ActiveAnimation {
  from: number;
  to: number;
  start: number;
  duration: number;
  easing: (value: number) => number;
}

interface AssemblyBounds {
  width: number;
  height: number;
}

const PIECE_HOVER_DEPTH = 0.72;
const PIECE_HOVER_LIFT = 0.1;
const PIECE_HOVER_SCALE = 1.035;
const PIECE_GROUP_GAP_FACTOR = 0.95;
const PIECE_HOVER_IN_DURATION = 250;
const PIECE_HOVER_OUT_DURATION = 320;

const GEIST_PIXEL_FACE = primaryFontFamily(SEAM_BRICKS_FONT_FAMILY);
let geistPixelLoad: Promise<boolean> | null = null;

function primaryFontFamily(fontFamily: string): string {
  return fontFamily.split(",")[0]?.trim() || "sans-serif";
}

function usesBundledGeistPixel(fontFamily: string): boolean {
  return primaryFontFamily(fontFamily).replace(/["']/g, "") ===
    "Geist Pixel Square";
}

export function loadSeamBricksFont(): Promise<boolean> {
  if (geistPixelLoad) return geistPixelLoad;
  if (typeof FontFace === "undefined" || !("fonts" in document)) {
    return Promise.resolve(false);
  }

  geistPixelLoad = new FontFace(
    "Geist Pixel Square",
    `url(${JSON.stringify(geistPixelUrl)}) format("woff2")`,
    { style: "normal", weight: "400", display: "block" },
  )
    .load()
    .then((face) => {
      document.fonts.add(face);
      return true;
    })
    .catch(() => false);
  return geistPixelLoad;
}

function srgb(hex: string): [number, number, number] {
  const linear = new THREE.Color(hex);
  const display = new THREE.Color();
  linear.getRGB(display, THREE.SRGBColorSpace);
  return [display.r, display.g, display.b];
}

function mixSrgb(
  from: readonly number[],
  to: readonly number[],
  progress: number,
): [number, number, number] {
  return [
    THREE.MathUtils.lerp(from[0] ?? 0, to[0] ?? 0, progress),
    THREE.MathUtils.lerp(from[1] ?? 0, to[1] ?? 0, progress),
    THREE.MathUtils.lerp(from[2] ?? 0, to[2] ?? 0, progress),
  ];
}

function sampleStops(
  stops: readonly (readonly [number, string])[],
  progress: number,
): [number, number, number] {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  let left = stops[0];
  let right = stops.at(-1);
  if (!left || !right) return [1, 1, 1];

  for (let index = 1; index < stops.length; index += 1) {
    const candidate = stops[index];
    if (candidate && t <= candidate[0]) {
      right = candidate;
      left = stops[index - 1] ?? candidate;
      break;
    }
  }

  const span = right[0] - left[0];
  const local = span === 0 ? 0 : (t - left[0]) / span;
  return mixSrgb(srgb(left[1]), srgb(right[1]), local);
}

function toneSrgb(
  channels: [number, number, number],
  exposure: number,
  saturation: number,
): [number, number, number] {
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return channels.map((channel) =>
    THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(luminance, channel, saturation) * exposure,
      0,
      1,
    ),
  ) as [number, number, number];
}

function paintGeometry(
  geometry: THREE.BoxGeometry,
  palette: SeamBricksMaterialPalette,
  openProgress: number,
  tone: Pick<SeamBricksSceneTheme, "materialExposure" | "materialSaturation">,
  part: "body" | "peg" = "body",
): void {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  let color = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!color) {
    color = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
    geometry.setAttribute("color", color);
  }

  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox?.getSize(size);
  const converted = new THREE.Color();

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const nx = normal.getX(index);
    const ny = normal.getY(index);
    const nz = normal.getZ(index);
    const vertical = THREE.MathUtils.clamp(y / size.y + 0.5, 0, 1);
    let channels: [number, number, number];

    if (part === "peg" && nz > 0.9) {
      const horizontal = THREE.MathUtils.clamp(x / size.x + 0.5, 0, 1);
      channels = mixSrgb(srgb(palette.peg[0]), srgb(palette.peg[1]), horizontal);
    } else if (nz > 0.9) {
      const closed = sampleStops(palette.frontClosed, vertical);
      const open = sampleStops(palette.frontOpen, vertical);
      channels = mixSrgb(closed, open, openProgress);
    } else if (ny < -0.9) {
      const depth = THREE.MathUtils.clamp(0.5 - z / size.z, 0, 1);
      channels = sampleStops(palette.bottom, depth);
    } else if (ny > 0.9) {
      channels = srgb(palette.top);
    } else if (Math.abs(nx) > 0.9) {
      channels = srgb(palette.side);
    } else {
      channels = srgb(palette.back);
    }

    const toned = toneSrgb(
      channels,
      tone.materialExposure,
      tone.materialSaturation,
    );
    converted.setRGB(toned[0], toned[1], toned[2], THREE.SRGBColorSpace);
    color.setXYZ(index, converted.r, converted.g, converted.b);
  }

  color.needsUpdate = true;
}

function createSoftShadowMaterial(
  color: string,
  opacity: number,
  falloff: readonly [number, number],
  feather = 0.68,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uFalloff: { value: new THREE.Vector2(...falloff) },
      uFeather: { value: feather },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec2 uFalloff;
      uniform float uFeather;
      varying vec2 vUv;
      void main() {
        vec2 point = vUv * 2.0 - 1.0;
        float radius = dot(point, point * uFalloff);
        float feather = smoothstep(1.0, uFeather, max(abs(point.x), abs(point.y)));
        float alpha = exp(-2.15 * radius) * feather * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function setCanvasLetterSpacing(
  context: CanvasRenderingContext2D,
  value: number,
): void {
  const spaced = context as CanvasRenderingContext2D & { letterSpacing?: string };
  spaced.letterSpacing = `${value}px`;
}

function measureTextWidth(
  context: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  const measured = context.measureText(text).width;
  return measured + Math.max(0, Array.from(text).length - 1) * letterSpacing;
}

function createLabelTexture(
  label: ResolvedSeamBricksLabelConfig,
  width: number,
  height: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.height = label.resolution;
  canvas.width = Math.round(
    Math.min(3072, Math.max(256, label.resolution * (width / height))),
  );
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const pixelsPerUnit = canvas.height / height;
    const edge = Math.min(
      label.paddingX * pixelsPerUnit,
      canvas.width * 0.07,
    );
    const availableWidth = Math.max(
      1,
      canvas.width - edge * 2,
    );
    const fontSize = label.fontScale * height * pixelsPerUnit;
    const font = (size: number) =>
      `${label.fontWeight} ${Math.max(1, size)}px ${label.fontFamily}`;
    context.font = font(fontSize);
    const spacing = label.letterSpacing * fontSize;
    const displayText = truncateLabelText(
      label.text,
      availableWidth,
      (value) => measureTextWidth(context, value, spacing),
    );

    setCanvasLetterSpacing(context, spacing);
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(255, 255, 255, 0.28)";
    context.shadowBlur = label.glow;
    context.globalAlpha = label.opacity;
    context.fillText(
      displayText,
      edge,
      canvas.height / 2,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (renderable.geometry) geometries.add(renderable.geometry);
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    objectMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function createLegacyConfig(options: SeamBricksRendererOptions): SeamBricksConfig {
  const preset = createSeamBricksPreset("classic", options.label);
  return {
    ...preset,
    height: options.height,
    depth: options.depth,
    peg: {
      sides: "right",
      width: options.pegWidth,
      height: options.pegHeight,
      depth: options.pegDepth,
    },
    motion: {
      separation: options.yellowTravel,
      tilt: THREE.MathUtils.radToDeg(options.tilt),
      lift: options.verticalTravel,
      scaleY: options.openScaleY,
    },
    pieces: [
      {
        ...(preset.pieces[0] ?? {}),
        width: options.mainWidth,
        paletteOverrides: options.bluePalette,
        open: { x: -options.mainTravel },
      },
      {
        ...(preset.pieces[1] ?? {}),
        width: options.yellowWidth,
        paletteOverrides: options.yellowPalette,
        open: { x: options.yellowTravel },
      },
    ],
    origin: [0, options.baseY, 0],
  };
}

function configurationStructureKey(config: ResolvedSeamBricksConfig): string {
  return JSON.stringify({
    shadows: config.effects.shadows,
    accentLights: config.effects.accentLights,
    maxAccentLights: config.effects.maxAccentLights,
    pieces: config.pieces.map((piece) => ({
      id: piece.id,
      width: piece.width,
      height: piece.height,
      depth: piece.depth,
      visible: piece.visible,
      hasLabel: Boolean(piece.label),
      icon: piece.icon
        ? {
            name: piece.icon.name,
            pixels: piece.icon.pixels,
            pixelSize: piece.icon.pixelSize,
            depth: piece.icon.depth,
          }
        : null,
      peg: piece.peg,
      shadow: piece.effects.shadow !== false,
      glow: piece.effects.glow !== false,
    })),
  });
}

function configurationLabelKey(config: ResolvedSeamBricksConfig): string {
  return JSON.stringify(
    config.pieces.map((piece) => ({ id: piece.id, label: piece.label })),
  );
}

export class SeamBricksRenderer
  extends EventTarget
  implements SeamBricksRendererHandle
{
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer | null;
  private readonly bloomPass: UnrealBloomPass | null;
  private readonly model = new THREE.Group();
  private readonly effectsRoot = new THREE.Group();
  private readonly hitAreaRoot = new THREE.Group();
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitTargets: THREE.Object3D[] = [];
  private readonly backdropMaterial: THREE.MeshBasicMaterial;
  private readonly floorMaterial: THREE.MeshStandardMaterial;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly faceLight: THREE.RectAreaLight;
  private readonly fillLight: THREE.RectAreaLight;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly intersectionObserver: IntersectionObserver | null;
  private readonly motionQuery: MediaQueryList;
  private options: SeamBricksRendererOptions;
  private configuration: ResolvedSeamBricksConfig;
  private pieces: PieceRuntime[] = [];
  private sceneTheme: SeamBricksSceneTheme;
  private assemblyBounds: AssemblyBounds = { width: 9.7, height: 2.5 };
  private progress = 0;
  private open = false;
  private animation: ActiveAnimation | null = null;
  private readonly pieceHoverAnimations = new Map<string, ActiveAnimation>();
  private hovered = false;
  private hoveredPieceId: string | null = null;
  private orbiting = false;
  private frameRequest: number | null = null;
  private destroyed = false;
  private isIntersecting = true;
  private isDocumentVisible = document.visibilityState !== "hidden";
  private contextLost = false;
  private fontLoadToken = 0;

  constructor(
    container: HTMLElement,
    options: Partial<SeamBricksRendererOptions> = {},
  ) {
    super();
    if (!(container instanceof HTMLElement)) {
      throw new TypeError("SeamBricksRenderer requires an HTMLElement container.");
    }

    this.container = container;
    this.options = { ...DEFAULT_SEAM_BRICKS_OPTIONS, ...options };
    const initialConfig = this.options.config
      ? cloneSeamBricksConfig(this.options.config)
      : createLegacyConfig(this.options);
    this.configuration = resolveSeamBricksConfig(initialConfig);
    this.sceneTheme = resolveSeamBricksTheme(this.options.theme);
    this.open = this.options.initialOpen;
    this.progress = this.open ? 1 : 0;

    this.renderer = this.createRenderer();
    RectAreaLightUniformsLib.init();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.sceneTheme.background);
    this.camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 60);
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.58;
    this.controls.maxZoom = 2.4;
    this.controls.enabled = this.options.orbit;
    this.controls.saveState();

    this.hemisphere = new THREE.HemisphereLight();
    this.keyLight = new THREE.DirectionalLight();
    this.faceLight = new THREE.RectAreaLight();
    this.fillLight = new THREE.RectAreaLight();
    this.backdropMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.floorMaterial = new THREE.MeshStandardMaterial({
      roughness: 1,
      metalness: 0,
    });

    this.createScene();
    const { composer, bloomPass } = this.createPostprocessing();
    this.composer = composer;
    this.bloomPass = bloomPass;
    this.rebuildModel();
    this.applyTheme(this.sceneTheme);
    this.applyProgress(this.progress);
    this.bindEvents();

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motionQuery.addEventListener("change", this.onMotionPreferenceChange);
    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(this.onResize);
    this.resizeObserver?.observe(this.container);
    if (!this.resizeObserver) window.addEventListener("resize", this.onResize);
    this.intersectionObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(this.onIntersection, { rootMargin: "80px" });
    this.intersectionObserver?.observe(this.container);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.resize();
    this.loadConfiguredFonts();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get isOpen(): boolean {
    return this.open;
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.options.maxDpr),
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.className = "seam-bricks__canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    this.container.append(renderer.domElement);
    return renderer;
  }

  private createScene(): void {
    this.hemisphere.layers.set(0);
    this.scene.add(this.hemisphere);

    this.keyLight.position.set(-4, 7, 9);
    this.keyLight.target.position.set(0, -1.7, -2.6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = -12;
    this.keyLight.shadow.camera.right = 12;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 30;
    this.keyLight.shadow.bias = -0.00015;
    this.keyLight.shadow.normalBias = 0.025;
    this.keyLight.shadow.radius = 5;
    this.keyLight.shadow.blurSamples = 18;
    this.keyLight.layers.set(0);
    this.scene.add(this.keyLight, this.keyLight.target);

    this.faceLight.width = 16;
    this.faceLight.height = 5;
    this.faceLight.position.set(0, 4, 6);
    this.faceLight.lookAt(0, 0, 0);
    this.faceLight.layers.set(0);
    this.scene.add(this.faceLight);

    this.fillLight.width = 6;
    this.fillLight.height = 5;
    this.fillLight.position.set(6, 1.5, 5);
    this.fillLight.lookAt(2, 0, 0);
    this.fillLight.layers.set(0);
    this.scene.add(this.fillLight);

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 28),
      this.backdropMaterial,
    );
    backdrop.position.set(0, -1.15, -2.8);
    backdrop.layers.set(1);
    this.camera.layers.enable(1);
    this.scene.add(backdrop);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 48),
      this.floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.scene.add(this.model, this.effectsRoot);
  }

  private createPostprocessing(): {
    composer: EffectComposer | null;
    bloomPass: UnrealBloomPass | null;
  } {
    if (!this.options.postprocessing) return { composer: null, bloomPass: null };
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      this.options.bloomStrength * this.sceneTheme.bloomMultiplier,
      this.options.bloomRadius,
      this.options.bloomThreshold,
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    return { composer, bloomPass };
  }

  private createMaterial(): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.58,
      toneMapped: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight = clamp(vColor.rgb + max(outgoingLight - vColor.rgb, 0.0) * 0.025, 0.0, 1.0);\n#include <opaque_fragment>",
      );
    };
    material.customProgramCacheKey = () => "seam-gradient-physical-v2";
    return material;
  }

  private createPiece(config: ResolvedSeamBricksPieceConfig): PieceRuntime {
    const group = new THREE.Group();
    group.name = `seam-bricks:${config.id}`;
    group.visible = config.visible;
    const material = this.createMaterial();
    const bodyGeometry = new THREE.BoxGeometry(
      config.width,
      config.height,
      config.depth,
      1,
      12,
      12,
    );
    paintGeometry(bodyGeometry, config.palette, this.progress, this.sceneTheme);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.name = config.id;
    body.userData.seamBricksPieceId = config.id;
    body.castShadow = config.castShadow;
    body.receiveShadow = config.receiveShadow;
    group.add(body);

    // Raycast against the closed layout instead of the animated body. This
    // gives each brick the same stable hit box as a moving CSS element: its
    // own motion cannot make it repeatedly leave and re-enter the pointer.
    const leftHitExtension =
      config.peg.sides === "left" || config.peg.sides === "both"
        ? config.peg.width
        : 0;
    const rightHitExtension =
      config.peg.sides === "right" || config.peg.sides === "both"
        ? config.peg.width
        : 0;
    const hitArea = new THREE.Mesh(
      new THREE.BoxGeometry(
        config.width + leftHitExtension + rightHitExtension,
        config.height,
        config.depth,
      ),
      new THREE.MeshBasicMaterial(),
    );
    hitArea.name = `${config.id}:hit-area`;
    hitArea.userData.seamBricksPieceId = config.id;
    hitArea.userData.seamBricksCenterOffset =
      (rightHitExtension - leftHitExtension) / 2;

    const pegs: BodyMesh[] = [];
    const pegSides =
      config.peg.sides === "both"
        ? (["left", "right"] as const)
        : config.peg.sides === "none"
          ? []
          : [config.peg.sides];
    pegSides.forEach((side) => {
      const pegGeometry = new THREE.BoxGeometry(
        config.peg.width,
        config.peg.height,
        config.peg.depth,
        1,
        6,
        3,
      );
      paintGeometry(pegGeometry, config.palette, this.progress, this.sceneTheme, "peg");
      const peg = new THREE.Mesh(pegGeometry, material);
      peg.name = `${config.id}:${side}-peg`;
      peg.userData.seamBricksPieceId = config.id;
      peg.position.x =
        (config.width / 2 + config.peg.width / 2) * (side === "right" ? 1 : -1);
      peg.position.y = config.peg.offsetY;
      peg.castShadow = config.castShadow;
      peg.receiveShadow = config.receiveShadow;
      pegs.push(peg);
      group.add(peg);
    });

    const contentMaterials: THREE.MeshBasicMaterial[] = [];
    let labelPlane: LabelMesh | null = null;
    if (config.label) {
      const labelMaterial = new THREE.MeshBasicMaterial({
        map: this.createConfiguredLabelTexture(config.label, config),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: config.label.opacity,
      });
      contentMaterials.push(labelMaterial);
      labelPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(config.width, config.height),
        labelMaterial,
      );
      labelPlane.position.set(
        config.label.offsetX,
        config.label.offsetY,
        config.depth / 2 + 0.009,
      );
      // Canvas paints synchronously with whatever face is currently ready.
      // Keep the plane hidden until loadConfiguredFonts repaints it with the
      // exact requested face, so the first visible frame can never be a
      // monospace fallback.
      labelPlane.visible = !("fonts" in document);
      labelPlane.renderOrder = 3;
      group.add(labelPlane);
    }

    let iconGroup: THREE.Group | null = null;
    if (config.icon) {
      iconGroup = new THREE.Group();
      iconGroup.position.set(config.icon.offsetX, config.icon.offsetY, 0);
      iconGroup.scale.setScalar(config.icon.scale);
      const iconMaterial = new THREE.MeshBasicMaterial({
        toneMapped: false,
        transparent: config.icon.opacity < 1,
        opacity: config.icon.opacity,
      });
      contentMaterials.push(iconMaterial);
      const pixelGeometry = new THREE.BoxGeometry(
        config.icon.pixelSize,
        config.icon.pixelSize,
        config.icon.depth,
      );
      config.icon.pixels.forEach(([x, y]) => {
        const pixel = new THREE.Mesh(pixelGeometry, iconMaterial);
        pixel.position.set(
          x * config.icon!.pixelSize,
          y * config.icon!.pixelSize,
          config.depth / 2 + config.icon!.depth / 2 + 0.003,
        );
        pixel.castShadow = config.castShadow;
        iconGroup?.add(pixel);
      });
      group.add(iconGroup);
    }

    return {
      id: config.id,
      config,
      group,
      body,
      hitArea,
      pegs,
      material,
      labelPlane,
      iconGroup,
      contentMaterials,
      palette: config.palette,
      basePosition: new THREE.Vector3(),
      effects: {
        shadow: null,
        shadowMaterial: null,
        glow: null,
        underLight: null,
      },
      hoverProgress: 0,
    };
  }

  private createConfiguredLabelTexture(
    label: ResolvedSeamBricksLabelConfig,
    config: ResolvedSeamBricksPieceConfig,
  ): THREE.CanvasTexture {
    const texture = createLabelTexture(label, config.width, config.height);
    texture.anisotropy = Math.min(
      this.renderer.capabilities.getMaxAnisotropy(),
      8,
    );
    return texture;
  }

  private layoutPieces(): void {
    const configs = this.configuration.pieces;
    const { gap, origin } = this.configuration;
    const totalWidth =
      configs.reduce((sum, piece) => sum + piece.width, 0) +
      Math.max(0, configs.length - 1) * gap;
    let cursor = -totalWidth / 2;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    this.pieces.forEach((piece) => {
      const offset = piece.config.offset;
      const x = origin[0] + cursor + piece.config.width / 2 + offset[0];
      const y = origin[1] + offset[1];
      const z = origin[2] + offset[2];
      piece.basePosition.set(x, y, z);
      piece.group.position.copy(piece.basePosition);
      piece.hitArea.position.set(
        x + Number(piece.hitArea.userData.seamBricksCenterOffset ?? 0),
        y,
        z,
      );
      cursor += piece.config.width + gap;

      const pegExtension =
        piece.config.peg.sides === "none" ? 0 : piece.config.peg.width;
      const leftPeg =
        piece.config.peg.sides === "left" || piece.config.peg.sides === "both"
          ? pegExtension
          : 0;
      const rightPeg =
        piece.config.peg.sides === "right" || piece.config.peg.sides === "both"
          ? pegExtension
          : 0;
      const closedLeft = x - piece.config.width / 2 - leftPeg;
      const closedRight = x + piece.config.width / 2 + rightPeg;
      const closedBottom = y - piece.config.height / 2;
      const closedTop = y + piece.config.height / 2;
      minX = Math.min(minX, closedLeft, closedLeft + piece.config.open.x);
      maxX = Math.max(maxX, closedRight, closedRight + piece.config.open.x);
      minY = Math.min(minY, closedBottom, closedBottom + piece.config.open.y);
      maxY = Math.max(maxY, closedTop, closedTop + piece.config.open.y);
    });

    this.assemblyBounds = {
      width: Math.max(1, maxX - minX),
      height: Math.max(2.5, maxY - minY + 0.8),
    };
    this.hitAreaRoot.updateMatrixWorld(true);
  }

  private rebuildModel(): void {
    this.fontLoadToken += 1;
    disposeTree(this.model);
    disposeTree(this.effectsRoot);
    disposeTree(this.hitAreaRoot);
    this.model.clear();
    this.effectsRoot.clear();
    this.hitAreaRoot.clear();
    this.hitTargets.length = 0;
    this.pieceHoverAnimations.clear();
    this.pieces = this.configuration.pieces.map((config) => this.createPiece(config));
    if (!this.pieces.some((piece) => piece.id === this.hoveredPieceId)) {
      this.hoveredPieceId = null;
    }
    this.pieces.forEach((piece) => {
      piece.hoverProgress =
        this.options.hoverMode === "piece" && piece.id === this.hoveredPieceId
          ? 1
          : 0;
    });
    this.pieces.forEach((piece) => {
      this.model.add(piece.group);
      this.hitAreaRoot.add(piece.hitArea);
      if (piece.config.interactive) {
        this.hitTargets.push(piece.hitArea);
      }
    });
    this.layoutPieces();
    this.createPieceEffects();
  }

  private updateModel(
    previous: ResolvedSeamBricksConfig,
    next: ResolvedSeamBricksConfig,
  ): void {
    const previousById = new Map(previous.pieces.map((piece) => [piece.id, piece]));
    const nextById = new Map(next.pieces.map((piece) => [piece.id, piece]));
    this.hitTargets.length = 0;
    this.pieces.forEach((runtime) => {
      const config = nextById.get(runtime.id);
      if (!config) return;
      const before = previousById.get(runtime.id);
      runtime.config = config;
      runtime.palette = config.palette;
      runtime.group.visible = config.visible;
      runtime.body.castShadow = config.castShadow;
      runtime.body.receiveShadow = config.receiveShadow;
      runtime.pegs.forEach((peg) => {
        peg.castShadow = config.castShadow;
        peg.receiveShadow = config.receiveShadow;
      });
      if (config.interactive) {
        this.hitTargets.push(runtime.hitArea);
      }
      if (
        runtime.labelPlane &&
        config.label &&
        JSON.stringify(before?.label) !== JSON.stringify(config.label)
      ) {
        const material = runtime.labelPlane.material;
        runtime.labelPlane.visible = !("fonts" in document);
        material.map?.dispose();
        material.map = this.createConfiguredLabelTexture(config.label, config);
        material.opacity = config.label.opacity;
        material.needsUpdate = true;
        runtime.labelPlane.position.set(
          config.label.offsetX,
          config.label.offsetY,
          config.depth / 2 + 0.009,
        );
      }
      if (runtime.iconGroup && config.icon) {
        runtime.iconGroup.position.set(config.icon.offsetX, config.icon.offsetY, 0);
        runtime.iconGroup.scale.setScalar(config.icon.scale);
        const iconMaterial = runtime.contentMaterials.at(-1);
        if (iconMaterial) {
          iconMaterial.opacity = config.icon.opacity;
          iconMaterial.transparent = config.icon.opacity < 1;
          iconMaterial.needsUpdate = true;
        }
      }
    });
    this.layoutPieces();
  }

  private createPieceEffects(): void {
    let lightCount = 0;
    const maxLights = this.configuration.effects.maxAccentLights;
    this.pieces.forEach((piece, index) => {
      const config = piece.config;
      if (
        this.configuration.effects.shadows &&
        config.effects.shadow !== false
      ) {
        const defaults = this.themeEffectsFor(config.palette);
        const opacity = config.effects.shadowOpacity ?? defaults.shadowOpacity;
        const color = config.effects.shadowColor ?? defaults.shadowColor;
        const aspect = config.width / Math.max(0.1, config.height);
        const material = createSoftShadowMaterial(
          color,
          opacity,
          [Math.max(0.06, 0.3 / aspect), 2.5],
          config.paletteName === "yellow" ? 0.4 : 0.68,
        );
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(config.width + 1, config.height + 0.84),
          material,
        );
        shadow.position.set(
          piece.basePosition.x,
          piece.basePosition.y - config.height / 2 - 1.29,
          -2.65 + index * 0.001,
        );
        shadow.layers.set(1);
        shadow.renderOrder = index + 1;
        piece.effects.shadow = shadow;
        piece.effects.shadowMaterial = material;
        this.effectsRoot.add(shadow);
      }

      if (
        !this.configuration.effects.accentLights ||
        config.effects.glow === false
      ) {
        return;
      }
      const defaults = this.themeEffectsFor(config.palette);
      if (lightCount < maxLights) {
        const glow = new THREE.RectAreaLight(
          config.effects.glowColor ?? defaults.glowColor,
          config.effects.glowIntensity ?? defaults.glowIntensity,
          Math.max(0.8, config.width),
          0.95,
        );
        glow.position.set(piece.basePosition.x, -2.15, -1.15);
        glow.lookAt(piece.basePosition.x, -2.35, -2.8);
        piece.effects.glow = glow;
        this.effectsRoot.add(glow);
        lightCount += 1;
      }
      if (lightCount < maxLights) {
        const underLight = new THREE.RectAreaLight(
          config.effects.underLightColor ?? defaults.underLightColor,
          0,
          Math.max(0.8, config.width),
          1.4,
        );
        underLight.position.set(piece.basePosition.x, -2.05, 2.35);
        underLight.lookAt(piece.basePosition.x, -0.15, 0);
        piece.effects.underLight = underLight;
        this.effectsRoot.add(underLight);
        lightCount += 1;
      }
    });
  }

  private themeEffectsFor(palette: SeamBricksMaterialPalette): {
    shadowColor: string;
    shadowOpacity: number;
    glowColor: string;
    glowIntensity: number;
    underLightColor: string;
    underLightIntensity: number;
  } {
    return {
      shadowColor: palette.shadow,
      shadowOpacity:
        palette.shadowOpacity * this.sceneTheme.shadowOpacityMultiplier,
      glowColor: palette.glow,
      glowIntensity:
        palette.glowIntensity * this.sceneTheme.glowIntensityMultiplier,
      underLightColor: palette.underLight,
      underLightIntensity:
        palette.underLightIntensity *
        this.sceneTheme.underLightIntensityMultiplier,
    };
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerleave", this.onPointerLeave);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.addEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    this.controls.addEventListener("start", this.onControlsStart);
    this.controls.addEventListener("end", this.onControlsEnd);
    this.controls.addEventListener("change", this.onControlsChange);
  }

  private applyTheme(theme: SeamBricksSceneTheme): void {
    this.scene.background = new THREE.Color(theme.background);
    this.backdropMaterial.color.set(theme.background);
    this.floorMaterial.color.set(theme.floor);
    this.floorMaterial.emissive.set(theme.floorEmissive);
    this.floorMaterial.emissiveIntensity = theme.floorEmissiveIntensity;
    this.hemisphere.color.set(theme.hemisphereSky);
    this.hemisphere.groundColor.set(theme.hemisphereGround);
    this.hemisphere.intensity = theme.hemisphereIntensity;
    this.keyLight.color.set(theme.keyLight);
    this.keyLight.intensity = theme.keyLightIntensity;
    this.faceLight.color.set(theme.faceLight);
    this.faceLight.intensity = theme.faceLightIntensity;
    this.fillLight.color.set(theme.fillLight);
    this.fillLight.intensity = theme.fillLightIntensity;

    this.pieces.forEach((piece) => {
      const defaults = this.themeEffectsFor(piece.config.palette);
      piece.effects.shadowMaterial?.uniforms.uColor.value.set(
        piece.config.effects.shadowColor ?? defaults.shadowColor,
      );
      if (piece.effects.glow) {
        piece.effects.glow.color.set(
          piece.config.effects.glowColor ?? defaults.glowColor,
        );
        piece.effects.glow.intensity =
          piece.config.effects.glowIntensity ?? defaults.glowIntensity;
      }
      if (piece.effects.underLight) {
        piece.effects.underLight.color.set(
          piece.config.effects.underLightColor ?? defaults.underLightColor,
        );
      }
      piece.contentMaterials.forEach((material, index) => {
        const customColor =
          index === 0 && piece.config.label
            ? piece.config.label.color
            : piece.config.icon?.color;
        material.color
          .set(customColor ?? theme.labelColor)
          .multiplyScalar(theme.labelIntensity);
      });
    });

    if (this.bloomPass) {
      this.bloomPass.strength =
        this.options.bloomStrength * theme.bloomMultiplier;
    }
    this.updateShadowOpacity();
  }

  private pieceProgress(progress: number, delay: number): number {
    if (delay <= 0) return THREE.MathUtils.clamp(progress, 0, 1);
    return THREE.MathUtils.clamp((progress - delay) / (1 - delay), 0, 1);
  }

  private applyProgress(progress: number): void {
    const globalProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const usesPieceHover = this.options.hoverMode === "piece";
    const totalHoverWeight = usesPieceHover
      ? this.pieces.reduce((sum, piece) => sum + piece.hoverProgress, 0)
      : 0;
    const hoverWeightDivisor = Math.max(1, totalHoverWeight);
    const groupGap =
      this.configuration.motion.separation * PIECE_GROUP_GAP_FACTOR;

    this.pieces.forEach((piece, pieceIndex) => {
      const local = this.pieceProgress(globalProgress, piece.config.open.delay);
      const open = piece.config.open;
      const hoverProgress = usesPieceHover ? piece.hoverProgress : 0;
      const pieceProgress = usesPieceHover ? hoverProgress : local;
      const groupedOffset = usesPieceHover
        ? this.pieces.reduce((offset, candidate, candidateIndex) => {
            if (candidateIndex === pieceIndex) return offset;
            const direction = pieceIndex < candidateIndex ? -1 : 1;
            return offset + direction * candidate.hoverProgress;
          }, 0) / hoverWeightDivisor
        : 0;
      const hoverScale = THREE.MathUtils.lerp(
        1,
        PIECE_HOVER_SCALE,
        hoverProgress,
      );
      piece.group.position.set(
        piece.basePosition.x +
          (usesPieceHover ? groupedOffset * groupGap : open.x * local),
        piece.basePosition.y +
          open.y * pieceProgress +
          PIECE_HOVER_LIFT * hoverProgress,
        piece.basePosition.z +
          open.z * pieceProgress +
          PIECE_HOVER_DEPTH * hoverProgress,
      );
      piece.group.rotation.set(
        THREE.MathUtils.degToRad(open.rotateX) * pieceProgress,
        THREE.MathUtils.degToRad(open.rotateY) * pieceProgress,
        THREE.MathUtils.degToRad(open.rotateZ) * pieceProgress,
      );
      piece.group.scale.set(
        THREE.MathUtils.lerp(1, open.scaleX, pieceProgress) * hoverScale,
        THREE.MathUtils.lerp(1, open.scaleY, pieceProgress) * hoverScale,
        THREE.MathUtils.lerp(1, open.scaleZ, pieceProgress) * hoverScale,
      );

      const paletteProgress = THREE.MathUtils.clamp(pieceProgress, 0, 1);
      paintGeometry(
        piece.body.geometry,
        piece.palette,
        paletteProgress,
        this.sceneTheme,
      );
      piece.pegs.forEach((peg) =>
        paintGeometry(
          peg.geometry,
          piece.palette,
          paletteProgress,
          this.sceneTheme,
          "peg",
        ),
      );

      const projectedScale = Math.max(
        0.2,
        piece.group.scale.y * Math.cos(piece.group.rotation.x),
      );
      if (piece.labelPlane) piece.labelPlane.scale.y = 1 / projectedScale;
      if (piece.iconGroup) piece.iconGroup.scale.y = piece.config.icon!.scale / projectedScale;

      const openAmount = Math.max(0, pieceProgress);
      if (piece.effects.shadow) {
        piece.effects.shadow.position.x = piece.group.position.x;
        piece.effects.shadow.position.y =
          piece.basePosition.y - piece.config.height / 2 - 1.29 +
          open.y * openAmount * 0.25 +
          PIECE_HOVER_LIFT * hoverProgress * 0.3;
        piece.effects.shadow.scale.x =
          1 + 0.035 * openAmount + 0.025 * hoverProgress;
      }
      if (piece.effects.glow) {
        piece.effects.glow.position.x = piece.group.position.x;
      }
      if (piece.effects.underLight) {
        const defaults = this.themeEffectsFor(piece.config.palette);
        piece.effects.underLight.position.x = piece.group.position.x;
        piece.effects.underLight.intensity =
          openAmount *
          (piece.config.effects.underLightIntensity ??
            defaults.underLightIntensity);
      }
    });

    this.keyLight.intensity =
      this.sceneTheme.keyLightIntensity + Math.max(0, globalProgress) * 0.04;
    this.updateShadowOpacity(Math.max(0, globalProgress));
  }

  private updateShadowOpacity(
    openAmount = THREE.MathUtils.clamp(this.progress, 0, 1),
  ): void {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const alignment = THREE.MathUtils.smoothstep(direction.z * -1, 0.9, 0.995);
    this.pieces.forEach((piece) => {
      const material = piece.effects.shadowMaterial;
      if (!material) return;
      const defaults = this.themeEffectsFor(piece.config.palette);
      const baseOpacity =
        piece.config.effects.shadowOpacity ?? defaults.shadowOpacity;
      material.uniforms.uOpacity.value =
        Math.max(0, baseOpacity * (1 + 0.08 * openAmount)) * alignment;
    });
  }

  private refreshLabelTextures(
    visibility?: ReadonlyMap<string, boolean>,
  ): void {
    this.pieces.forEach((piece) => {
      const label = piece.config.label;
      const plane = piece.labelPlane;
      const material = plane?.material;
      if (!label || !plane || !material) return;
      const texture = this.createConfiguredLabelTexture(label, piece.config);
      material.map?.dispose();
      material.map = texture;
      material.needsUpdate = true;
      plane.visible = visibility?.get(piece.id) ?? true;
    });
    this.invalidate();
  }

  private loadConfiguredFonts(): void {
    const token = ++this.fontLoadToken;
    const labeledPieces = this.pieces.filter(
      (piece): piece is PieceRuntime & {
        config: ResolvedSeamBricksPieceConfig & {
          label: ResolvedSeamBricksLabelConfig;
        };
        labelPlane: LabelMesh;
      } => Boolean(piece.config.label && piece.labelPlane),
    );

    if (labeledPieces.length === 0) {
      this.renderer.domElement.dataset.fontReady = "true";
      return;
    }

    if (!("fonts" in document)) {
      labeledPieces.forEach((piece) => {
        piece.labelPlane.visible = true;
      });
      this.renderer.domElement.dataset.fontReady = "unsupported";
      this.invalidate();
      return;
    }

    this.renderer.domElement.dataset.fontReady = "false";
    labeledPieces.forEach((piece) => {
      piece.labelPlane.visible = false;
    });

    const requests = labeledPieces.map(async (piece) => {
      const label = piece.config.label;
      const bundledGeist = usesBundledGeistPixel(label.fontFamily);
      const face = bundledGeist
        ? GEIST_PIXEL_FACE
        : primaryFontFamily(label.fontFamily);
      try {
        if (bundledGeist) {
          return [piece.id, await loadSeamBricksFont()] as const;
        }
        const loaded = await document.fonts.load(
          `${label.fontWeight} 64px ${face}`,
          label.text,
        );
        return [piece.id, loaded.length > 0 || !bundledGeist] as const;
      } catch {
        // Custom external families may intentionally rely on their own
        // fallback stack. The bundled Geist face is stricter: a failed load
        // stays hidden instead of flashing the wrong design.
        return [piece.id, !bundledGeist] as const;
      }
    });

    Promise.all(requests).then((entries) => {
      if (this.destroyed || token !== this.fontLoadToken) return;
      const visibility = new Map(entries);
      this.refreshLabelTextures(visibility);
      const ready = labeledPieces.every(
        (piece) => visibility.get(piece.id) !== false,
      );
      this.renderer.domElement.dataset.fontReady = String(ready);
      this.dispatchEvent(
        new CustomEvent("fontreadychange", { detail: { ready } }),
      );
    });
  }

  private defaultActivePieceId(): string | null {
    const interactivePieces = this.pieces.filter(
      (piece) => piece.config.interactive && piece.config.visible,
    );
    return interactivePieces[Math.floor(interactivePieces.length / 2)]?.id ?? null;
  }

  private setPieceHoverTarget(
    pieceId: string | null,
    immediate = false,
  ): void {
    const reduceMotion =
      this.options.respectReducedMotion && this.motionQuery.matches;
    const resolveImmediately = immediate || reduceMotion;
    const startedAt = performance.now();

    this.pieces.forEach((piece) => {
      const target = piece.id === pieceId ? 1 : 0;
      this.pieceHoverAnimations.delete(piece.id);
      if (resolveImmediately || Math.abs(piece.hoverProgress - target) < 0.0001) {
        piece.hoverProgress = target;
        return;
      }
      this.pieceHoverAnimations.set(piece.id, {
        from: piece.hoverProgress,
        to: target,
        start: startedAt,
        duration:
          target === 1 ? PIECE_HOVER_IN_DURATION : PIECE_HOVER_OUT_DURATION,
        easing: target === 1 ? SEAM_BRICKS_OPEN_EASE : SEAM_BRICKS_CLOSE_EASE,
      });
    });

    if (resolveImmediately) this.applyProgress(this.progress);
    this.invalidate();
  }

  private updatePieceHoverAnimations(time: number): boolean {
    if (this.pieceHoverAnimations.size === 0) return false;
    this.pieceHoverAnimations.forEach((animation, pieceId) => {
      const piece = this.pieces.find((candidate) => candidate.id === pieceId);
      if (!piece) {
        this.pieceHoverAnimations.delete(pieceId);
        return;
      }
      const phase = Math.min(1, (time - animation.start) / animation.duration);
      piece.hoverProgress = THREE.MathUtils.lerp(
        animation.from,
        animation.to,
        animation.easing(phase),
      );
      if (phase === 1) {
        piece.hoverProgress = animation.to;
        this.pieceHoverAnimations.delete(pieceId);
      }
    });
    return true;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.options.interactive || this.orbiting) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersection = this.raycaster.intersectObjects(this.hitTargets, false)[0];
    const hovered = Boolean(intersection);
    const pieceId = intersection?.object.userData.seamBricksPieceId ?? null;
    if (this.options.hoverMode === "piece") {
      if (hovered) {
        this.setActivePiece(pieceId);
        if (!this.hovered) {
          this.hovered = true;
          this.renderer.domElement.classList.add("is-hovering");
          this.setOpen(true, { source: "hover" });
        }
      } else if (this.hovered) {
        this.hovered = false;
        this.renderer.domElement.classList.remove("is-hovering");
        this.setActivePiece(null);
        this.setOpen(false, { source: "hover" });
      }
      return;
    }
    this.setActivePiece(pieceId);
    if (hovered === this.hovered) return;
    this.hovered = hovered;
    this.renderer.domElement.classList.toggle("is-hovering", hovered);
    this.setOpen(hovered, { source: "hover" });
  };

  private readonly onPointerLeave = (): void => {
    this.hovered = false;
    this.renderer.domElement.classList.remove("is-hovering");
    this.setActivePiece(null);
    if (this.options.interactive) this.setOpen(false, { source: "hover" });
  };

  private readonly onControlsStart = (): void => {
    this.orbiting = true;
    this.invalidate();
  };

  private readonly onControlsEnd = (): void => {
    this.orbiting = false;
    this.invalidate();
  };

  private readonly onControlsChange = (): void => {
    this.updateShadowOpacity();
    this.invalidate();
  };

  private readonly onResize = (): void => this.resize();

  private readonly onIntersection = (
    entries: IntersectionObserverEntry[],
  ): void => {
    this.isIntersecting = entries.at(-1)?.isIntersecting ?? true;
    if (this.isIntersecting) this.invalidate();
    else this.cancelFrame();
  };

  private readonly onVisibilityChange = (): void => {
    this.isDocumentVisible = document.visibilityState !== "hidden";
    if (this.isDocumentVisible) this.invalidate();
    else this.cancelFrame();
  };

  private readonly onMotionPreferenceChange = (): void => {
    if (this.options.respectReducedMotion && this.motionQuery.matches) {
      if (this.animation) {
        this.progress = this.animation.to;
        this.animation = null;
      }
      this.pieceHoverAnimations.forEach((animation, pieceId) => {
        const piece = this.pieces.find((candidate) => candidate.id === pieceId);
        if (piece) piece.hoverProgress = animation.to;
      });
      this.pieceHoverAnimations.clear();
      this.applyProgress(this.progress);
    }
    this.invalidate();
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.cancelFrame();
    this.dispatchEvent(
      new CustomEvent("rendererchange", { detail: { available: false } }),
    );
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.dispatchEvent(
      new CustomEvent("rendererchange", { detail: { available: true } }),
    );
    this.invalidate();
  };

  setOpen(open: boolean, options: SeamBricksSetOpenOptions = {}): this {
    const { source = "api" } = options;
    const next = Boolean(open);
    if (this.options.hoverMode === "piece") {
      if (next && !this.hoveredPieceId) {
        this.setActivePiece(this.defaultActivePieceId());
      } else if (!next) {
        this.setActivePiece(null);
      }
    }
    const reduceMotion =
      this.options.respectReducedMotion && this.motionQuery.matches;
    const immediate = options.immediate ?? reduceMotion;
    if (next === this.open && !immediate) return this;
    this.open = next;
    const target = next ? 1 : 0;

    if (immediate) {
      this.animation = null;
      this.progress = target;
      this.applyProgress(this.progress);
    } else {
      this.animation = {
        from: this.progress,
        to: target,
        start: performance.now(),
        duration: next ? this.options.openDuration : this.options.closeDuration,
        easing: next ? SEAM_BRICKS_OPEN_EASE : SEAM_BRICKS_CLOSE_EASE,
      };
    }

    this.invalidate();
    this.dispatchEvent(
      new CustomEvent<SeamBricksStateChangeDetail>("statechange", {
        detail: { open: next, source },
      }),
    );
    return this;
  }

  setConfig(config: SeamBricksConfig): this {
    const source = cloneSeamBricksConfig(config);
    this.options.config = source;
    const previous = this.configuration;
    const next = resolveSeamBricksConfig(source);
    const needsRebuild =
      configurationStructureKey(previous) !== configurationStructureKey(next);
    const labelsChanged =
      configurationLabelKey(previous) !== configurationLabelKey(next);
    this.configuration = next;
    if (needsRebuild) this.rebuildModel();
    else this.updateModel(previous, next);
    this.applyTheme(this.sceneTheme);
    this.applyProgress(this.progress);
    this.resize();
    if (needsRebuild || labelsChanged) this.loadConfiguredFonts();
    this.dispatchEvent(
      new CustomEvent("configchange", { detail: { config: this.getConfig() } }),
    );
    return this.invalidate();
  }

  getConfig(): SeamBricksConfig {
    return cloneSeamBricksConfig(this.configuration.source);
  }

  setLabel(label: string): this {
    const target =
      this.configuration.pieces.find((piece) => piece.label)?.id ??
      this.configuration.pieces[0]?.id;
    return target ? this.setPieceLabel(target, label) : this;
  }

  setPieceLabel(pieceId: string, label: string): this {
    const source = this.getConfig();
    source.pieces = source.pieces.map((piece, index) => {
      const id = piece.id?.trim() || `piece-${index + 1}`;
      if (id !== pieceId) return piece;
      const previous =
        piece.label && typeof piece.label === "object" ? piece.label : {};
      return { ...piece, label: { ...previous, text: String(label) } };
    });
    this.options.label = String(label);
    return this.setConfig(source);
  }

  setPiece(pieceId: string, patch: Partial<SeamBricksPieceConfig>): this {
    const source = this.getConfig();
    source.pieces = source.pieces.map((piece, index) => {
      const id = piece.id?.trim() || `piece-${index + 1}`;
      if (id !== pieceId) return piece;
      return {
        ...piece,
        ...patch,
        open: patch.open ? { ...piece.open, ...patch.open } : piece.open,
        effects: patch.effects
          ? { ...piece.effects, ...patch.effects }
          : piece.effects,
        paletteOverrides: patch.paletteOverrides
          ? { ...piece.paletteOverrides, ...patch.paletteOverrides }
          : piece.paletteOverrides,
      };
    });
    return this.setConfig(source);
  }

  setTheme(theme: SeamBricksTheme): this {
    this.options.theme = theme;
    this.sceneTheme = resolveSeamBricksTheme(theme);
    this.applyTheme(this.sceneTheme);
    this.applyProgress(this.progress);
    return this.invalidate();
  }

  setBloom(options: SeamBricksBloomOptions = {}): this {
    if (!this.bloomPass) return this;
    if (options.strength !== undefined) {
      this.options.bloomStrength = Number(options.strength);
      this.bloomPass.strength =
        this.options.bloomStrength * this.sceneTheme.bloomMultiplier;
    }
    if (options.radius !== undefined) this.bloomPass.radius = Number(options.radius);
    if (options.threshold !== undefined) {
      this.bloomPass.threshold = Number(options.threshold);
    }
    return this.invalidate();
  }

  setMotion(options: SeamBricksMotionOptions = {}): this {
    const source = this.getConfig();
    const motion = { ...source.motion };
    if (options.separation !== undefined) motion.separation = options.separation;
    if (options.lift !== undefined) motion.lift = options.lift;
    if (options.scaleY !== undefined) motion.scaleY = options.scaleY;
    if (options.stagger !== undefined) motion.stagger = options.stagger;
    if (options.tilt !== undefined) {
      this.options.tilt = Number(options.tilt);
      motion.tilt = THREE.MathUtils.radToDeg(Number(options.tilt));
    }
    let pieces = [...source.pieces];
    if (options.mainTravel !== undefined && pieces[0]) {
      pieces[0] = {
        ...pieces[0],
        open: { ...pieces[0].open, x: -Number(options.mainTravel) },
      };
    }
    if (options.yellowTravel !== undefined && pieces[1]) {
      this.options.yellowTravel = Number(options.yellowTravel);
      pieces[1] = {
        ...pieces[1],
        open: { ...pieces[1].open, x: Number(options.yellowTravel) },
      };
    }
    return this.setConfig({ ...source, motion, pieces });
  }

  setPalette(
    pieceId: string,
    overrides: SeamBricksMaterialPaletteOverrides,
  ): this {
    const source = this.getConfig();
    const hasExactId = source.pieces.some((piece, index) =>
      (piece.id?.trim() || `piece-${index + 1}`) === pieceId,
    );
    source.pieces = source.pieces.map((piece, index) => {
      const id = piece.id?.trim() || `piece-${index + 1}`;
      const legacyPaletteMatch =
        !hasExactId &&
        (pieceId === "blue" || pieceId === "yellow") &&
        (piece.palette ?? "blue") === pieceId;
      if (id !== pieceId && !legacyPaletteMatch) return piece;
      const base = piece.paletteOverrides ?? {};
      return { ...piece, paletteOverrides: { ...base, ...overrides } };
    });
    return this.setConfig(source);
  }

  setInteractive(interactive: boolean): this {
    this.options.interactive = Boolean(interactive);
    if (!interactive) {
      this.hovered = false;
      this.renderer.domElement.classList.remove("is-hovering");
      this.setActivePiece(null);
    }
    return this.invalidate();
  }

  setHoverMode(mode: SeamBricksHoverMode): this {
    const next: SeamBricksHoverMode = mode === "piece" ? "piece" : "assembly";
    if (next === this.options.hoverMode) return this;
    this.options.hoverMode = next;
    if (next === "assembly") {
      this.setActivePiece(null);
      this.setPieceHoverTarget(null, true);
    } else {
      const activePieceId =
        this.hoveredPieceId ?? (this.open ? this.defaultActivePieceId() : null);
      this.setPieceHoverTarget(activePieceId);
    }
    return this.invalidate();
  }

  setActivePiece(pieceId: string | null): this {
    const nextPieceId =
      this.pieces.find(
        (piece) =>
          piece.id === pieceId && piece.config.interactive && piece.config.visible,
      )?.id ?? null;
    if (nextPieceId === this.hoveredPieceId) return this;
    this.hoveredPieceId = nextPieceId;
    this.setPieceHoverTarget(
      this.options.hoverMode === "piece" ? nextPieceId : null,
    );
    this.dispatchEvent(
      new CustomEvent("piecehoverchange", {
        detail: { pieceId: nextPieceId },
      }),
    );
    return this;
  }

  setOrbitEnabled(enabled: boolean): this {
    this.controls.enabled = Boolean(enabled);
    this.options.orbit = this.controls.enabled;
    return this.invalidate();
  }

  setContinuous(enabled: boolean): this {
    this.options.continuous = Boolean(enabled);
    return this.invalidate();
  }

  setCameraView(view: SeamBricksCameraView = {}): this {
    if (view.position) this.camera.position.fromArray([...view.position]);
    if (view.target) this.controls.target.fromArray([...view.target]);
    if (view.zoom !== undefined) this.camera.zoom = Number(view.zoom);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    return this.invalidate();
  }

  resetCamera(): this {
    this.controls.reset();
    this.updateShadowOpacity();
    return this.invalidate();
  }

  invalidate(): this {
    this.requestRender();
    return this;
  }

  private requestRender(): void {
    if (
      this.destroyed ||
      this.contextLost ||
      !this.isIntersecting ||
      !this.isDocumentVisible ||
      this.frameRequest !== null
    ) {
      return;
    }
    this.frameRequest = window.requestAnimationFrame(this.render);
  }

  private readonly render = (time = performance.now()): void => {
    this.frameRequest = null;
    if (this.destroyed || this.contextLost) return;

    let transformsChanged = false;
    if (this.animation) {
      const phase = Math.min(
        1,
        (time - this.animation.start) / this.animation.duration,
      );
      const eased = this.animation.easing(phase);
      this.progress = THREE.MathUtils.lerp(
        this.animation.from,
        this.animation.to,
        eased,
      );
      if (phase === 1) {
        this.progress = this.animation.to;
        this.animation = null;
      }
      transformsChanged = true;
    }

    transformsChanged = this.updatePieceHoverAnimations(time) || transformsChanged;
    if (transformsChanged) this.applyProgress(this.progress);

    const controlsChanged = this.controls.update();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.dispatchEvent(new Event("render"));

    if (
      this.animation ||
      this.pieceHoverAnimations.size > 0 ||
      this.orbiting ||
      controlsChanged ||
      this.options.continuous
    ) {
      this.requestRender();
    }
  };

  private resize(): void {
    if (this.destroyed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const responsiveScale = Math.min(1, Math.max(0.28, (width - 48) / 984));
    let pixelsPerUnit = this.options.pixelsPerUnit * responsiveScale;
    if (this.configuration.camera.enabled) {
      const padding = Math.min(
        this.configuration.camera.padding,
        width * 0.22,
        height * 0.22,
      );
      const fitScale = Math.min(
        Math.max(1, width - padding * 2) / this.assemblyBounds.width,
        Math.max(1, height - padding * 2) / this.assemblyBounds.height,
      );
      pixelsPerUnit =
        Math.min(pixelsPerUnit, fitScale) * this.configuration.camera.scale;
    }
    this.camera.left = -width / pixelsPerUnit / 2;
    this.camera.right = width / pixelsPerUnit / 2;
    this.camera.top = height / pixelsPerUnit / 2;
    this.camera.bottom = -height / pixelsPerUnit / 2;
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(
      this.options.maxDpr,
      Math.max(0.5, window.devicePixelRatio || 1),
    );
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(width, height);
    this.invalidate();
  }

  private cancelFrame(): void {
    if (this.frameRequest === null) return;
    window.cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.fontLoadToken += 1;
    this.cancelFrame();
    this.animation = null;
    this.pieceHoverAnimations.clear();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    if (!this.resizeObserver) window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.motionQuery.removeEventListener("change", this.onMotionPreferenceChange);
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.onPointerMove,
    );
    this.renderer.domElement.removeEventListener(
      "pointerleave",
      this.onPointerLeave,
    );
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.onContextLost,
    );
    this.renderer.domElement.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    this.controls.removeEventListener("start", this.onControlsStart);
    this.controls.removeEventListener("end", this.onControlsEnd);
    this.controls.removeEventListener("change", this.onControlsChange);
    this.controls.dispose();
    disposeTree(this.scene);
    disposeTree(this.hitAreaRoot);
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
