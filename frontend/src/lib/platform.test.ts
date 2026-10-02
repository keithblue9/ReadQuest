import { describe, expect, it } from "vitest";

import { isIOS } from "./platform";

describe("isIOS", () => {
  it("mendeteksi iPhone", () => {
    expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
  });

  it("mendeteksi iPadOS yang mengaku Macintosh", () => {
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
  });

  it("bukan iOS untuk Mac desktop dan Android", () => {
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIOS("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(false);
  });
});
