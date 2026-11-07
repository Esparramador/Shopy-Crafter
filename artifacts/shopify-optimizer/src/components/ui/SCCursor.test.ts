// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SCCursor from "./SCCursor";

const mountedRoots: ReturnType<typeof createRoot>[] = [];

function mountCursor(host: HTMLElement) {
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(SCCursor)));
  return root;
}

function unmountCursor(root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  const index = mountedRoots.indexOf(root);
  if (index !== -1) mountedRoots.splice(index, 1);
}

describe("SCCursor", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
    document.documentElement.classList.remove("sc-cursor-on");
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows and positions the SC cursor after a fine-pointer move", () => {
    const media = {
      matches: false,
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
    const root = mountCursor(host);

    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      clientX: { value: 120 },
      clientY: { value: 80 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(move));
    const ring = document.body.querySelector<HTMLElement>(".sc-cursor-ring");
    expect(ring?.style.translate).toBe("98px 58px");
    act(() => frame?.(0));

    const dot = document.body.querySelector<HTMLElement>(".sc-cursor");
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(true);
    expect(dot?.classList.contains("sc-cursor-visible")).toBe(true);
    expect(ring?.classList.contains("sc-cursor-visible")).toBe(true);
    expect(dot?.style.translate).toContain("106px");
    expect(dot?.style.translate).toContain("66px");

    unmountCursor(root);
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
    const root = mountCursor(host);

    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperty(move, "pointerType", { value: "touch" });
    act(() => document.dispatchEvent(move));

    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);
    unmountCursor(root);
    host.remove();
  });

  it("activates from an actual mouse event when the dev preview reports no fine pointer", () => {
    const media = {
      matches: false,
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
    const root = mountCursor(host);

    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      clientX: { value: 120 },
      clientY: { value: 80 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(move));
    act(() => frame?.(0));

    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(true);
    expect(document.body.querySelector(".sc-cursor")?.classList.contains("sc-cursor-visible")).toBe(true);

    unmountCursor(root);
    host.remove();
  });

  it("hides and clears on window exit, then re-enters at the new pointer position", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
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

    const firstMove = new Event("pointermove", { bubbles: true });
    Object.defineProperties(firstMove, {
      clientX: { value: 300 },
      clientY: { value: 200 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(firstMove));
    act(() => frame?.(0));

    act(() => window.dispatchEvent(new Event("pointerleave")));
    const dot = document.body.querySelector<HTMLElement>(".sc-cursor");
    const ring = document.body.querySelector<HTMLElement>(".sc-cursor-ring");
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);
    expect(dot?.classList.contains("sc-cursor-visible")).toBe(false);
    expect(ring?.classList.contains("sc-cursor-visible")).toBe(false);
    expect(dot?.style.translate).toBe("");
    expect(ring?.style.translate).toBe("");

    const returnMove = new Event("pointermove", { bubbles: true });
    Object.defineProperties(returnMove, {
      clientX: { value: 80 },
      clientY: { value: 60 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(returnMove));
    expect(dot?.style.translate).toBe("66px 46px");
    expect(ring?.style.translate).toBe("58px 38px");

    act(() => root.unmount());
    host.remove();
  });

  it("hides on blur and touch input and clears hover state", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const host = document.createElement("div");
    const button = document.createElement("button");
    button.textContent = "Control";
    host.append(button);
    document.body.append(host);
    const root = mountCursor(host);

    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      clientX: { value: 100 },
      clientY: { value: 100 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(move));
    const dot = document.body.querySelector<HTMLElement>(".sc-cursor");
    const ring = document.body.querySelector<HTMLElement>(".sc-cursor-ring");
    dot?.classList.add("sc-cursor-hover");
    ring?.classList.add("sc-ring-hover");
    expect(dot?.classList.contains("sc-cursor-hover")).toBe(true);

    act(() => window.dispatchEvent(new Event("blur")));
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);
    expect(dot?.classList.contains("sc-cursor-hover")).toBe(false);
    expect(ring?.classList.contains("sc-ring-hover")).toBe(false);

    const touchDown = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(touchDown, "pointerType", { value: "touch" });
    act(() => document.dispatchEvent(touchDown));
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);

    unmountCursor(root);
    host.remove();
  });

  it("keeps the native cursor available when reduced motion is enabled", () => {
    let onChange: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      matches: true,
      addEventListener: vi.fn((_event: string, handler: (event: MediaQueryListEvent) => void) => {
        onChange = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(media));
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const host = document.createElement("div");
    document.body.append(host);
    const root = mountCursor(host);

    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      clientX: { value: 120 },
      clientY: { value: 80 },
      pointerType: { value: "mouse" },
    });
    act(() => document.dispatchEvent(move));
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);

    act(() => onChange?.({ matches: false } as MediaQueryListEvent));
    act(() => document.dispatchEvent(move));
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(true);

    act(() => onChange?.({ matches: true } as MediaQueryListEvent));
    expect(document.documentElement.classList.contains("sc-cursor-on")).toBe(false);

    unmountCursor(root);
    expect(media.removeEventListener).toHaveBeenCalled();
    host.remove();
  });
});
