# Seam Bricks

[![CI](https://github.com/Seam-Agency/seam-bricks/actions/workflows/ci.yml/badge.svg)](https://github.com/Seam-Agency/seam-bricks/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-seam.tools%2Fbricks-73574a.svg)](https://seam.tools/bricks/)
[![Release](https://img.shields.io/github/v/release/Seam-Agency/seam-bricks?display_name=tag)](https://github.com/Seam-Agency/seam-bricks/releases)
[![MIT License](https://img.shields.io/badge/license-MIT-25272a.svg)](./LICENSE)

An editable native WebGL brick system for React. Every brick is data-driven,
the geometry is real 3D, Geist Pixel labels are generated as fitted textures,
and the renderer stops requesting frames whenever animation, camera damping,
and resizing are idle.

[**Live demo**](https://seam.tools/bricks/) · [**Release artifacts**](https://github.com/Seam-Agency/seam-bricks/releases)

## Install

```bash
npm install https://github.com/Seam-Agency/seam-bricks/releases/latest/download/seam-bricks.tgz
```

The public release tarball installs without registry credentials. For a fully
immutable application lock, replace `latest` with the required release tag.
The live demo's **Copy prompt** action gives a coding agent the same public
tarball URL plus the React, styles, theme, accessibility, and verification
steps needed to integrate it into an existing project.

The package installs Three.js as its runtime dependency. React and React DOM
remain peer dependencies.

## React

```tsx
import { SeamBricks } from "@seam-agency/seam-bricks";
import "@seam-agency/seam-bricks/styles.css";

export function Hero() {
  return (
    <SeamBricks
      label="Seam"
      theme="paper"
      hoverMode="piece"
      separation={1.15}
      tilt={-27}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}
```

Hover and keyboard focus open the object by default. Passing `open` makes the
visual state controlled, while `onOpenChange` receives hover, focus, keyboard,
and API transitions. Set `hoverMode="piece"` to lift and rotate only the
raycast brick while its neighbors remain connected as two groups. Its stable
closed-position hit area prevents animated hover oscillation and releases as
soon as the pointer leaves that brick. Set `orbit` to enable drag-to-orbit
controls.

## Configurable assemblies

Use the `short`, `medium`, and `long` width tokens for fast composition, then
override any dimension when a design needs a custom proportion:

```tsx
import {
  SeamBricks,
  type SeamBricksConfig,
} from "@seam-agency/seam-bricks";
import "@seam-agency/seam-bricks/styles.css";

const config: SeamBricksConfig = {
  gap: 0,
  pieces: [
    {
      id: "statement",
      length: "long",
      palette: "blue",
      label: {
        text: "BUILD BETTER",
        fontScale: 0.43,
        letterSpacing: 0.02,
      },
    },
    {
      id: "verb",
      length: "medium",
      palette: "yellow",
      label: "SHIP",
      open: { x: 0.7, rotateX: -22, delay: 0.04 },
    },
    {
      id: "action",
      length: "short",
      palette: "blue",
      icon: "spark",
      peg: { sides: "right" },
    },
  ],
  motion: {
    separation: 0.9,
    tilt: -24,
    scaleY: 0.92,
    stagger: 0.04,
  },
  effects: { maxAccentLights: 4 },
};

export function ConfiguredHero() {
  return <SeamBricks config={config} theme="paper" />;
}
```

`classic`, `compact`, and `trio` presets are available through the `preset`
prop or `createSeamBricksPreset()`. A `config` takes precedence over `preset` and
the legacy `label`, `separation`, and palette props, which keeps the original
two-brick API compatible without making advanced configuration ambiguous.

Each piece can configure width/height/depth, palette and face gradients, text,
pixel icon data, peg sides and dimensions, static offset, open translation,
three-axis rotation and scale, delay, raycast participation, real shadow flags,
soft shadow, glow, and under-light values. Assembly-level config controls row
gap, origin, defaults, motion, camera fitting, and the dynamic light cap.

Geist Pixel Square is self-hosted by the package, so WebGL label textures and
the accessible HTML fallback use the same typeface. Font loading triggers one
texture refresh and one invalidated frame; it does not start a continuous loop.

## Renderer API

The framework-neutral renderer is exported for custom hosts:

```ts
import {
  createSeamBricksPreset,
  SeamBricksRenderer,
} from "@seam-agency/seam-bricks";

const renderer = new SeamBricksRenderer(document.querySelector("#scene")!, {
  theme: "nocturne",
  hoverMode: "piece",
  orbit: true,
});

renderer.setOpen(true);
renderer.setMotion({ yellowTravel: 1.4, tilt: -0.47 });
renderer.setBloom({ strength: 0.1 });
renderer.setPieceLabel("main", "Editable");
renderer.setPiece("action", { length: "medium", palette: "blue" });
renderer.setConfig(createSeamBricksPreset("trio"));
renderer.setActivePiece("action");

// Own exactly one renderer per host and release it on teardown.
renderer.destroy();
```

`getConfig`, `setPalette`, `setTheme`, `setLabel`, `setPieceLabel`, `setPiece`,
`setHoverMode`, `setCameraView`, `resetCamera`, and `setContinuous` are also
available. Config updates compare topology before doing work: text, motion,
layout, palette, and light changes update existing GPU objects, while
dimension, peg, label-plane, or icon-geometry changes perform a scoped model
rebuild without replacing the WebGL context.

Labels remain left-aligned at their configured `fontScale`. When a brick becomes
too narrow, the canvas texture truncates the visible label with an ellipsis
instead of compressing the type.

The default `continuous: false` policy renders only for initialisation, state
transitions, camera movement, resize, font/material updates, and explicit
invalidation. Offscreen and hidden scenes pause pending frame requests.

## Themes

`paper` and `nocturne` are built in. A partial scene theme inherits the Paper
preset, so a consumer can replace the background or any light without copying
the complete contract:

```tsx
<SeamBricks
  theme={{
    name: "studio",
    background: "#101820",
    keyLight: "#fff4df",
  }}
/>
```

Material palettes are independent from scene themes. `blue`, `yellow`, `coral`,
`violet`, `mint`, and `rose` are built in; each carries its own face gradients,
side/top/bottom/back colors, peg treatment, shadow tint, glow, and under-light.
Select them per piece with `palette`, customize any palette with
`paletteOverrides`, or use the `bluePalette` and `yellowPalette` shortcuts for
the classic pair.

## Local development

```bash
npm install
npm run check
```

- `npm run build` creates the package in `dist/`.
- `npm run check` runs types, library tests, the production build, and
  distribution checks.
- `npm run smoke:consumer` packs the library and installs it into a temporary
  SSR consumer.

This public repository contains the reusable library only. The live demo is
built and deployed from a separate private source project.

## Publishing

Tagged GitHub releases publish the matching version to GitHub Packages after
library checks, package inspection, and consumer installation pass. The same
workflow attaches both a versioned package archive and the stable
`seam-bricks.tgz` public-install asset to the GitHub Release.
