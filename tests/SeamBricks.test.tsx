import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeamBricks } from "../src";

afterEach(cleanup);

describe("SeamBricks", () => {
  it("keeps an accessible fallback when WebGL is unavailable", () => {
    const { container, getByRole, getByText } = render(
      <SeamBricks label="Seam" />,
    );

    const root = getByRole("button", {
      name: "Interactive 3D Seam object",
    });
    expect(root.getAttribute("data-renderer")).toBe("fallback");
    expect(root.getAttribute("data-open")).toBe("false");
    expect(root.getAttribute("data-orbit")).toBe("false");
    expect(root.getAttribute("data-hover-mode")).toBe("assembly");
    expect(root.getAttribute("tabindex")).toBe("0");
    expect(getByText("Seam")).toBeTruthy();
    expect(container.querySelector(".seam-bricks__fallback")).toBeTruthy();
  });

  it("exposes piece hover mode without changing the backwards-compatible default", () => {
    const { getByRole } = render(<SeamBricks hoverMode="piece" />);
    expect(getByRole("button").getAttribute("data-hover-mode")).toBe("piece");
  });

  it("exposes controlled keyboard interaction without requiring WebGL", () => {
    const onOpenChange = vi.fn();
    const { getByRole } = render(
      <SeamBricks open={false} onOpenChange={onOpenChange} />,
    );
    const root = getByRole("button");

    fireEvent.keyDown(root, { key: " " });
    expect(onOpenChange).toHaveBeenCalledWith(true, "keyboard");
  });

  it("maps named and custom themes to stable scene metadata", () => {
    const { getByRole, rerender } = render(
      <SeamBricks interactive={false} theme="nocturne" />,
    );
    const root = getByRole("img");
    expect(root.getAttribute("data-theme")).toBe("nocturne");
    expect(root.style.getPropertyValue("--seam-bricks-background")).toBe(
      "#171310",
    );

    rerender(
      <SeamBricks
        interactive={false}
        theme={{ name: "studio", background: "#101820" }}
      />,
    );
    expect(root.getAttribute("data-theme")).toBe("studio");
    expect(root.style.getPropertyValue("--seam-bricks-background")).toBe(
      "#101820",
    );
  });

  it("renders a data-driven multi-brick fallback and accessible name", () => {
    const { getByRole, getByText } = render(
      <SeamBricks
        config={{
          pieces: [
            { id: "long", length: "long", label: "SEAM", palette: "blue" },
            { id: "medium", length: "medium", label: "MAKES", palette: "yellow" },
            { id: "short", length: "short", icon: "chevron", palette: "blue" },
          ],
        }}
      />,
    );
    const root = getByRole("button", {
      name: "Interactive 3D SEAM MAKES object",
    });
    expect(root.getAttribute("data-piece-count")).toBe("3");
    expect(root.getAttribute("data-preset")).toBe("custom");
    expect(getByText("SEAM")).toBeTruthy();
    expect(getByText("MAKES")).toBeTruthy();
  });
});
