import { describe, expect, it } from "vitest";
import { runwayImageToVideoModelId } from "./runway.js";

describe("Runway image_to_video model IDs", () => {
  it("maps the internal Gen-4.5 selector to the documented API ID", () => {
    expect(runwayImageToVideoModelId("gen4_5")).toBe("gen4.5");
  });

  it("keeps the internal Gen-4.5 Turbo alias on the supported API ID", () => {
    expect(runwayImageToVideoModelId("gen4_5_turbo")).toBe("gen4.5");
  });

  it("does not rewrite other Runway model IDs", () => {
    expect(runwayImageToVideoModelId("gen4_turbo")).toBe("gen4_turbo");
    expect(runwayImageToVideoModelId("seedance2")).toBe("seedance2");
  });
});
