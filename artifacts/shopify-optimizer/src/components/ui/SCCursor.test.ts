// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SCCursor from "./SCCursor";

describe("SCCursor", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.documentElement.classList.remove("sc-cursor-on");
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows and positions the SC cursor after a fine-pointer move", () => {
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(media));
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockImplementation(callback => {
      frame = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(SCCursor)));

    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      clientX: { value: 120 },
      clientY: { value: 80 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(move));
    act(() => frame?.(0));

    const dot = document.body.querySelector<HTMLElement>(".sc-cursor");
    const ring = document.body.querySelector<HTMLElement>(".sc-cursor-ring");
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(true);
    expect(dot?.classList.contains("sc-cursor-visible")).toBe(true);
    expect(ring?.classList.contains("sc-cursor-visible")).toBe(true);
    expect(dot?.style.transform).toContain("106px");
    expect(dot?.style.transform).toContain("66px");

    act(() => root.unmount());
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);
    host.remove();
  });

  it("leaves the native cursor enabled on touch-only devices", () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(media));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(SCCursor)));
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);
    act(() => root.unmount());
    host.remove();
  });
});
