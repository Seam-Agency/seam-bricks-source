# Third-party notices

## Three.js

The renderer depends on Three.js 0.185.1 under the MIT License. Three.js stays
external to the compiled library entry and is installed from the package's
runtime dependencies.

Upstream: <https://github.com/mrdoob/three.js>

## Geist Pixel Square

The library self-hosts the unmodified Geist Pixel Square webfont used by
`seam-glyphfield` at commit `cd9091080577fee5e4a5ff778d44270f30f18ec7`.
The binary metadata identifies the Geist Pixel Project Authors, Vercel, Andrés
Briganti, and Guido Ferreyra, and licenses the font under the SIL Open Font
License 1.1. The font is embedded in the published stylesheet so editable
canvas labels and the HTML fallback resolve to the same typeface.

SHA-256: `e8a4bd60c36d940da34fe3f47c037b0e4f0bab91e4f4de7233bbd49e4560c44b`

Upstream: <https://github.com/vercel/geist-font>

License: [licenses/Geist-OFL-1.1.txt](./licenses/Geist-OFL-1.1.txt)

## Nucleo Pixel

The demo uses selected React icons from `nucleo-pixel` v1.5.0 under Seam
Agency's Nucleo license. It is a proprietary development-only dependency: the
credential is never stored in this repository, and neither the package nor its
icon source is included in the published Seam Bricks library tarball.

Upstream: <https://nucleoapp.com/>

## Fluid Functionalism

The demo select interaction and scroll affordances are adapted to this
project's dependency-free styling layer from the Fluid Functionalism Select
and Scrollbars references. The resulting controls retain the project's own
Geist Pixel typography, Nucleo icons, color tokens, and accessible markup.

References: <https://www.fluidfunctionalism.com/docs/select> and
<https://www.fluidfunctionalism.com/docs/scrollbars>

## Theme Sweep

The demo uses `@seam-agency/theme-sweep` v0.1.0 under the MIT License. The
versioned public GitHub release asset is checked into `vendor/` for
deterministic CI installs and is excluded from the published Seam Bricks package
tarball.

Release asset SHA-256: `b8a1065a2cd2384371b83cbdb95b8bd87c282e3dac23897c43e2516e29b720d4`
