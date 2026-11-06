// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mediaCornerPath } from "./media-corners";
import { useMediaCorners } from "./use-media-corners";

const observers = new Map<ResizeObserverCallback, Set<Element>>();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets = new Set<Element>();
      constructor(callback: ResizeObserverCallback) {
        observers.set(callback, this.targets);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      disconnect() {
        this.targets.clear();
      }
    },
  );
});
afterEach(() => {
  cleanup();
  observers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function resized(target: Element, entry: Partial<ResizeObserverEntry>) {
  for (const [callback, targets] of observers)
    if (targets.has(target))
      callback(
        [{ target, ...entry } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
}

function Media() {
  const corners = useMediaCorners();
  return (
    <div
      ref={corners}
      role="img"
      aria-label="Media"
      style={{ borderTopLeftRadius: "16px" }}
    >
      <svg data-image-outline="" aria-hidden="true">
        <path />
      </svg>
    </div>
  );
}

function mount() {
  // jsdom has no layout; these stand in for a laid-out preview's offset box.
  const width = vi
    .spyOn(HTMLElement.prototype, "offsetWidth", "get")
    .mockReturnValue(320);
  const height = vi
    .spyOn(HTMLElement.prototype, "offsetHeight", "get")
    .mockReturnValue(240);
  const mounted = render(<Media />, { reactStrictMode: true });
  const element = mounted.getByRole("img", { name: "Media" });
  return { ...mounted, element, width, height };
}

it("clips media from the first resize notification without measuring during commit", () => {
  const h = mount();
  expect(
    [...observers.values()].some((targets) => targets.has(h.element)),
  ).toBe(true);
  expect(h.width).not.toHaveBeenCalled();
  expect(h.height).not.toHaveBeenCalled();
  expect(h.element.dataset.smoothCorners).toBeUndefined();

  resized(h.element, {
    borderBoxSize: [{ inlineSize: 300.5, blockSize: 200 }],
  });
  const path = mediaCornerPath(300.5, 200, 16);
  expect(h.element.style.getPropertyValue("--media-corner-clip")).toBe(
    `path("${path}")`,
  );
  expect(h.element.querySelector("path")?.getAttribute("d")).toBe(path);
  expect(h.element.dataset.smoothCorners).toBe("");
  expect(h.width).not.toHaveBeenCalled();
  expect(h.height).not.toHaveBeenCalled();

  h.unmount();
  expect(h.element.style.getPropertyValue("--media-corner-clip")).toBe("");
  expect(h.element.dataset.smoothCorners).toBeUndefined();
});

it("falls back to the offset box when the entry has no border box size", () => {
  const h = mount();
  resized(h.element, {});
  expect(h.element.style.getPropertyValue("--media-corner-clip")).toBe(
    `path("${mediaCornerPath(320, 240, 16)}")`,
  );
  expect(h.element.dataset.smoothCorners).toBe("");
});
