import { describe, expect, it, vi } from "vitest";
import { createCallAttemptRegistry } from "./convai-call-attempt";

class FakeSocket {
  onopen: unknown = null;
  onmessage: unknown = null;
  onerror: unknown = null;
  onclose: ((evt: { code: number; reason: string }) => void) | null = null;
  readyState = 1; // OPEN
  closeCalls = 0;
  close(): void {
    this.closeCalls += 1;
    this.readyState = 2; // CLOSING
  }
  /** The browser fires close asynchronously, long after close() returned. */
  fireClose(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }
}

class FakeTrack { stopped = false; stop() { this.stopped = true; } }
class FakeStream {
  tracks = [new FakeTrack(), new FakeTrack()];
  getTracks() { return this.tracks; }
  get allStopped() { return this.tracks.every((t) => t.stopped); }
}

class FakeContext {
  state = "running";
  closeCalls = 0;
  close(): Promise<void> { this.closeCalls += 1; this.state = "closed"; return Promise.resolve(); }
}

class FakeNode { disconnected = 0; disconnect() { this.disconnected += 1; } }

describe("createCallAttemptRegistry (call lifecycle ownership)", () => {
  it("a delayed close from a superseded socket cannot reach the new attempt", () => {
    const registry = createCallAttemptRegistry();
    const first = registry.begin();
    const oldSocket = first.ownSocket(new FakeSocket());
    const staleClose = vi.fn();
    oldSocket.onclose = staleClose;

    // "Reintentar": a new attempt starts while the old socket is still open.
    const second = registry.begin();
    const newContext = second.ownContext(new FakeContext());

    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(true);
    expect(oldSocket.closeCalls).toBe(1);
    expect(oldSocket.onclose).toBeNull();

    // The browser delivers the old socket's close event later.
    oldSocket.fireClose();
    expect(staleClose).not.toHaveBeenCalled();
    expect(second.isActive()).toBe(true);
    expect(newContext.closeCalls).toBe(0);
  });

  it("hanging up while the signed URL is still loading closes the context created at click time", () => {
    const registry = createCallAttemptRegistry();
    const attempt = registry.begin();
    const ctx = attempt.ownContext(new FakeContext());
    expect(ctx.closeCalls).toBe(0);

    registry.end(); // user pressed Cerrar/Colgar during provisioning
    expect(attempt.isActive()).toBe(false);
    expect(ctx.closeCalls).toBe(1);
    expect(registry.current()).toBeNull();

    // The fetch resolves afterwards; a socket created now is closed immediately.
    const lateSocket = attempt.ownSocket(new FakeSocket());
    expect(lateSocket.closeCalls).toBe(1);
    expect(lateSocket.onclose).toBeNull();
  });

  it("a microphone granted after cancellation is stopped immediately (no capture leak)", () => {
    const registry = createCallAttemptRegistry();
    const attempt = registry.begin();
    attempt.ownContext(new FakeContext());

    registry.end(); // cancelled while getUserMedia's permission prompt was open
    const lateStream = attempt.ownStream(new FakeStream());
    expect(lateStream.allStopped).toBe(true);
    expect(attempt.isActive()).toBe(false);
  });

  it("a microphone granted after 'Reintentar' superseded the attempt is stopped too", () => {
    const registry = createCallAttemptRegistry();
    const first = registry.begin();
    const second = registry.begin();
    const lateStream = first.ownStream(new FakeStream());
    expect(lateStream.allStopped).toBe(true);
    const liveStream = second.ownStream(new FakeStream());
    expect(liveStream.allStopped).toBe(false);
  });

  it("dispose releases every owned resource once and runs registered teardown", () => {
    const registry = createCallAttemptRegistry();
    const attempt = registry.begin();
    const ctx = attempt.ownContext(new FakeContext());
    const stream = attempt.ownStream(new FakeStream());
    const ws = attempt.ownSocket(new FakeSocket());
    const nodes = [new FakeNode(), new FakeNode(), new FakeNode()];
    attempt.ownNodes(...nodes);
    const clearWatchdog = vi.fn();
    attempt.onDispose(clearWatchdog);

    attempt.dispose();
    attempt.dispose(); // idempotent

    expect(clearWatchdog).toHaveBeenCalledTimes(1);
    expect(ws.closeCalls).toBe(1);
    expect(ws.onopen).toBeNull();
    expect(ws.onmessage).toBeNull();
    expect(ws.onerror).toBeNull();
    expect(ws.onclose).toBeNull();
    expect(nodes.map((n) => n.disconnected)).toEqual([1, 1, 1]);
    expect(stream.allStopped).toBe(true);
    expect(ctx.closeCalls).toBe(1);
  });

  it("does not call close() on a socket that is already closing or closed", () => {
    const registry = createCallAttemptRegistry();
    const attempt = registry.begin();
    const ws = attempt.ownSocket(new FakeSocket());
    ws.readyState = 3; // CLOSED by the server
    attempt.dispose();
    expect(ws.closeCalls).toBe(0);
  });

  it("teardown registered after disposal runs immediately", () => {
    const registry = createCallAttemptRegistry();
    const attempt = registry.begin();
    registry.end();
    const fn = vi.fn();
    attempt.onDispose(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("begin() always yields a fresh identity", () => {
    const registry = createCallAttemptRegistry();
    const a = registry.begin();
    const b = registry.begin();
    expect(a.id).not.toBe(b.id);
    expect(registry.current()).toBe(b);
  });
});
