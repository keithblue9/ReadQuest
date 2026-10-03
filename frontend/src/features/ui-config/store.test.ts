import { describe, expect, it } from "vitest";

import { DEFAULT_UI_CONFIG, MENUS, normalizeUiConfig } from "./store";

describe("normalizeUiConfig", () => {
  it("mengembalikan default untuk data kosong/rusak", () => {
    expect(normalizeUiConfig(null)).toEqual(DEFAULT_UI_CONFIG);
  });

  it("melengkapi fitur & menu yang belum ada", () => {
    const config = normalizeUiConfig({
      branding: { ...DEFAULT_UI_CONFIG.branding, app_name: "BacaYuk" },
      features: { enabled: { buddy: false } as never, menu_order: ["books", "unknown" as never] },
    });
    expect(config.branding.app_name).toBe("BacaYuk");
    expect(config.branding.logo_emoji).toBe("📚");
    expect(config.features.enabled.buddy).toBe(false);
    expect(config.features.enabled.feed).toBe(true);
    expect(config.features.menu_order[0]).toBe("books");
    expect(config.features.menu_order).toHaveLength(MENUS.length);
  });
});
