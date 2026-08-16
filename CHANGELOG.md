# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Changed

- Replaced the demo's `add-a-seam` command with a copyable coding-agent prompt
  that installs the public GitHub Release tarball and integrates the component.
- Added a stable `seam-bricks.tgz` release asset name for credential-free
  installs and documented the public repository/demo channel.
- Isolated browser checks on a Bricks-owned local port so an unrelated running
  demo cannot satisfy the test server probe.

## [0.1.2] - 2026-08-16

### Added

- Optional `piece` hover mode for foregrounding one brick while the remaining
  bricks stay connected as left and right groups.
- `hoverMode`, `setHoverMode`, `setActivePiece`, piece-hover events, keyboard
  piece navigation, and an accessible Individual hover demo control.

### Changed

- Increased the group separation around the active brick to preserve the
  stronger detached-card silhouette across short and long assemblies.

### Fixed

- Anchored raycast hit areas to the closed assembly so animated bricks cannot
  oscillate beneath a stationary pointer.
- Ended piece hover as soon as the pointer leaves that brick's stable hit area,
  even while it remains inside the surrounding WebGL canvas.

## [0.1.0] - 2026-08-15

### Added

- Initial GitHub Packages release of the editable native WebGL brick system.
- Data-driven short, medium, long, and custom pieces with labels, pixel icons,
  connector geometry, per-piece transforms, materials, effects, and camera fit.
- Self-hosted Geist Pixel Square labels with live font-aware texture refresh.
- Classic, compact, and three-piece presets plus a full demo configurator.
- Paper and Nocturne demo themes with an on-demand render lifecycle.
- GitHub release workflow with tag-to-version validation, package inspection, and post-publication installation verification.
