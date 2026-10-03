import { describe, expect, it } from "vitest";

import { DEFAULT_UI_CONFIG, type Menu } from "@/features/ui-config/store";

import { isActive, splitMobileMenus, visibleMenus } from "./menu";

describe("visibleMenus", () => {
  it("mengikuti urutan Admin dan menyembunyikan fitur yang dimatikan", () => {
    const features = {
      enabled: { ...DEFAULT_UI_CONFIG.features.enabled, feed: false },
      menu_order: ["books" as Menu, ...DEFAULT_UI_CONFIG.features.menu_order.filter((m) => m !== "books")],
    };
    const menus = visibleMenus(features).map((m) => m.menu);
    expect(menus[0]).toBe("books");
    expect(menus).not.toContain("feed");
  });
});

describe("splitMobileMenus", () => {
  it("menaruh 4 menu di bottom nav dan sisanya di Lainnya", () => {
    const { primary, more } = splitMobileMenus(visibleMenus(DEFAULT_UI_CONFIG.features));
    expect(primary.map((m) => m.menu)).toEqual(["dashboard", "feed", "read", "books"]);
    expect(more.map((m) => m.menu)).toContain("profile");
    expect(more.map((m) => m.menu)).toContain("notifications");
  });
});

describe("isActive", () => {
  it("mencocokkan rute & sub-rute", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/books/abc", "/")).toBe(false);
    expect(isActive("/books/abc", "/books")).toBe(true);
    expect(isActive("/posts/1", "/feed")).toBe(true);
    expect(isActive("/bookshelf", "/books")).toBe(false);
  });
});
