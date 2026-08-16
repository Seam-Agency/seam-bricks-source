import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { SeamBricksRenderer } from "./renderer";
import {
  cloneSeamBricksConfig,
  createSeamBricksPreset,
  SEAM_BRICKS_LENGTHS,
} from "./config";
import { resolveSeamBricksTheme } from "./themes";
import type {
  SeamBricksConfig,
  SeamBricksProps,
  SeamBricksPieceHoverDetail,
  SeamBricksRendererHandle,
  SeamBricksStateChangeDetail,
} from "./types";
import "./SeamBricks.css";

type RendererStatus = "fallback" | "webgl";

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function SeamBricks({
  label = "Seam",
  config,
  preset = "classic",
  open,
  interactive = true,
  hoverMode = "assembly",
  orbit = false,
  continuous = false,
  postprocessing = true,
  respectReducedMotion = true,
  theme = "paper",
  maxDpr = 2,
  separation,
  tilt,
  bloomStrength = 0.08,
  bluePalette,
  yellowPalette,
  fallback,
  canvasClassName,
  canvasStyle,
  onReady,
  onOpenChange,
  onPieceHoverChange,
  className,
  style,
  role,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  "aria-label": ariaLabel,
  ...rest
}: SeamBricksProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SeamBricksRenderer | null>(null);
  const onReadyRef = useRef(onReady);
  const onOpenChangeRef = useRef(onOpenChange);
  const onPieceHoverChangeRef = useRef(onPieceHoverChange);
  const appliedConfigRef = useRef<SeamBricksConfig | null>(null);
  const [rendererStatus, setRendererStatus] =
    useState<RendererStatus>("fallback");
  const [visualOpen, setVisualOpen] = useState(open ?? false);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const runtimeInteractive = interactive && open === undefined;
  const resolvedTheme = useMemo(() => resolveSeamBricksTheme(theme), [theme]);
  const runtimeConfig = useMemo(() => {
    if (config) return cloneSeamBricksConfig(config);
    const value = createSeamBricksPreset(preset, label);
    const resolvedSeparation = separation ?? value.motion?.separation ?? 1.15;
    const resolvedTilt = tilt ?? value.motion?.tilt ?? -27;
    return {
      ...value,
      motion: {
        ...value.motion,
        separation: resolvedSeparation,
        tilt: resolvedTilt,
      },
      pieces: value.pieces.map((piece, index) => ({
        ...piece,
        paletteOverrides:
          index === 0
            ? bluePalette
            : index === 1
              ? yellowPalette
              : piece.paletteOverrides,
      })),
    };
  }, [bluePalette, config, label, preset, separation, tilt, yellowPalette]);
  const configuredLabels = useMemo(
    () =>
      runtimeConfig.pieces
        .map((piece) =>
          typeof piece.label === "string"
            ? piece.label
            : piece.label && typeof piece.label === "object"
              ? piece.label.text
              : "",
        )
        .filter(Boolean),
    [runtimeConfig],
  );
  const accessibleObjectName = configuredLabels.join(" ") || "Seam bricks";

  onReadyRef.current = onReady;
  onOpenChangeRef.current = onOpenChange;
  onPieceHoverChangeRef.current = onPieceHoverChange;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: SeamBricksRenderer | null = null;
    const onStateChange = (event: Event) => {
      const detail = (event as CustomEvent<SeamBricksStateChangeDetail>).detail;
      setVisualOpen(detail.open);
      onOpenChangeRef.current?.(detail.open, detail.source);
    };
    const onRendererChange = (event: Event) => {
      const detail = (event as CustomEvent<{ available: boolean }>).detail;
      setRendererStatus(detail.available ? "webgl" : "fallback");
    };
    const onPieceHover = (event: Event) => {
      const detail = (event as CustomEvent<SeamBricksPieceHoverDetail>).detail;
      setActivePieceId(detail.pieceId);
      onPieceHoverChangeRef.current?.(detail.pieceId);
    };

    try {
      renderer = new SeamBricksRenderer(mount, {
        label,
        config: runtimeConfig,
        initialOpen: open ?? false,
        interactive: runtimeInteractive,
        hoverMode,
        orbit,
        continuous,
        postprocessing,
        respectReducedMotion,
        theme,
        maxDpr,
        bloomStrength,
      });
      renderer.addEventListener("statechange", onStateChange);
      renderer.addEventListener("rendererchange", onRendererChange);
      renderer.addEventListener("piecehoverchange", onPieceHover);
      rendererRef.current = renderer;
      appliedConfigRef.current = runtimeConfig;
      setVisualOpen(renderer.isOpen);
      setRendererStatus("webgl");
      onReadyRef.current?.(renderer);
    } catch {
      rendererRef.current = null;
      setRendererStatus("fallback");
      onReadyRef.current?.(null);
    }

    return () => {
      renderer?.removeEventListener("statechange", onStateChange);
      renderer?.removeEventListener("rendererchange", onRendererChange);
      renderer?.removeEventListener("piecehoverchange", onPieceHover);
      renderer?.destroy();
      rendererRef.current = null;
      appliedConfigRef.current = null;
      onReadyRef.current?.(null);
    };
    // Structural renderer settings intentionally recreate the WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDpr, postprocessing]);

  useEffect(() => {
    if (appliedConfigRef.current === runtimeConfig) return;
    rendererRef.current?.setConfig(runtimeConfig);
    appliedConfigRef.current = runtimeConfig;
  }, [runtimeConfig]);

  useEffect(() => {
    rendererRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (open === undefined) return;
    setVisualOpen(open);
    rendererRef.current?.setOpen(open, { source: "api" });
  }, [open]);

  useEffect(() => {
    rendererRef.current?.setInteractive(runtimeInteractive);
  }, [runtimeInteractive]);

  useEffect(() => {
    rendererRef.current?.setHoverMode(hoverMode);
    if (hoverMode === "assembly") setActivePieceId(null);
  }, [hoverMode]);

  useEffect(() => {
    rendererRef.current?.setOrbitEnabled(orbit);
  }, [orbit]);

  useEffect(() => {
    rendererRef.current?.setContinuous(continuous);
  }, [continuous]);

  useEffect(() => {
    rendererRef.current?.setBloom({ strength: bloomStrength });
  }, [bloomStrength]);

  useEffect(() => {
    const canvas = rendererRef.current?.canvas;
    if (!canvas) return;
    canvas.className = joinClassNames("seam-bricks__canvas", canvasClassName);
    canvas.removeAttribute("style");
    if (canvasStyle) Object.assign(canvas.style, canvasStyle);
  }, [canvasClassName, canvasStyle, rendererStatus]);

  const requestOpen = (
    next: boolean,
    source: "focus" | "keyboard",
  ): void => {
    if (!interactive) return;
    if (open === undefined) rendererRef.current?.setOpen(next, { source });
    else onOpenChangeRef.current?.(next, source);
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>): void => {
    onFocus?.(event);
    if (!event.defaultPrevented) requestOpen(true, "focus");
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    onBlur?.(event);
    if (!event.defaultPrevented) requestOpen(false, "focus");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(event);
    if (
      !event.defaultPrevented &&
      interactive &&
      hoverMode === "piece" &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      const pieceIds = runtimeConfig.pieces
        .filter((piece) => piece.interactive !== false && piece.visible !== false)
        .map((piece, index) => piece.id?.trim() || `piece-${index + 1}`);
      if (pieceIds.length > 0) {
        event.preventDefault();
        const currentIndex = pieceIds.indexOf(activePieceId ?? "");
        const fallbackIndex = Math.floor(pieceIds.length / 2);
        const nextIndex = Math.min(
          pieceIds.length - 1,
          Math.max(
            0,
            (currentIndex < 0 ? fallbackIndex : currentIndex) +
              (event.key === "ArrowRight" ? 1 : -1),
          ),
        );
        rendererRef.current?.setActivePiece(pieceIds[nextIndex] ?? null);
        requestOpen(true, "keyboard");
      }
      return;
    }
    if (
      event.defaultPrevented ||
      !interactive ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }
    event.preventDefault();
    requestOpen(!(open ?? visualOpen), "keyboard");
  };

  const rootStyle = {
    ...style,
    "--seam-bricks-background": resolvedTheme.background,
  } as CSSProperties;
  const resolvedOpen = open ?? visualOpen;
  const themeName =
    typeof theme === "string" ? theme : (theme.name ?? "custom");

  return (
    <div
      {...rest}
      className={joinClassNames("seam-bricks", className)}
      style={rootStyle}
      data-renderer={rendererStatus}
      data-open={String(resolvedOpen)}
      data-hover-mode={hoverMode}
      data-active-piece={activePieceId ?? undefined}
      data-orbit={String(orbit)}
      data-theme={themeName}
      data-preset={config ? "custom" : preset}
      data-piece-count={runtimeConfig.pieces.length}
      role={role ?? (interactive ? "button" : "img")}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      aria-label={ariaLabel ?? `Interactive 3D ${accessibleObjectName} object`}
      aria-pressed={interactive ? resolvedOpen : undefined}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <div ref={mountRef} className="seam-bricks__mount" aria-hidden="true" />
      <div className="seam-bricks__fallback" aria-hidden="true">
        {fallback ?? (
          <span className="seam-bricks__fallback-object">
            {runtimeConfig.pieces.map((piece, index) => {
              const pieceLabel =
                typeof piece.label === "string"
                  ? piece.label
                  : piece.label && typeof piece.label === "object"
                    ? piece.label.text
                    : "";
              return (
                <span
                  key={piece.id ?? index}
                  className="seam-bricks__fallback-piece"
                  data-palette={piece.palette ?? runtimeConfig.palette ?? "blue"}
                  style={{
                    flexGrow:
                      piece.width ??
                      SEAM_BRICKS_LENGTHS[piece.length ?? "medium"],
                  }}
                >
                  {pieceLabel || (piece.icon ? "›" : "")}
                </span>
              );
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export type { SeamBricksRendererHandle };
