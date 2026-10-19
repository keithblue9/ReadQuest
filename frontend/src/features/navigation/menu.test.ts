import { describe, expect, it } from "vitest";

import { DEFAULT_UI_CONFIG, type Menu } from "@/features/ui-config/store";

import { isActive, splitMobileMenus, visibleMenus } from "./menu";

describe("visibleMenus", () => {
  it("mengikuti urutan Admin dan menyembunyikan fitur yang dimatikan", () => {
    const features = {
      enabled: { ...DEFAULT_UI_CONFIG.features.enabled, leaderboard: false },
      menu_order: ["books" as Menu, ...DEFAULT_UI_CONFIG.features.menu_order.filter((m) => m !== "books")],
    };
    const menus = visibleMenus(features).map((m) => m.menu);
    expect(menus[0]).toBe("books");
    expect(menus).not.toContain("leaderboard");
  });
});

describe("splitMobileMenus", () => {
  it("menaruh 3 menu di bottom nav (tanpa Sesi Baca) dan sisanya di Lainnya", () => {
    const { primary, more } = splitMobileMenus(visibleMenus(DEFAULT_UI_CONFIG.features));
    expect(primary.map((m) => m.menu)).toEqual(["dashboard", "stats", "books"]);
    expect(more.map((m) => m.menu)).toContain("profile");
    expect(more.map((m) => m.menu)).toContain("notifications");
  });

  it("tidak pernah menaruh Sesi Baca di slot atau Lainnya (punya tombol tengah sendiri)", () => {
    const features = {
      ...DEFAULT_UI_CONFIG.features,
      menu_order: ["read" as Menu, ...DEFAULT_UI_CONFIG.features.menu_order.filter((m) => m !== "read")],
    };
    const { primary, more } = splitMobileMenus(visibleMenus(features));
    expect(primary).toHaveLength(3);
    expect([...primary, ...more].map((m) => m.menu)).not.toContain("read");
  });

  it("tidak menampilkan menu fitur yang dimatikan Admin", () => {
    const features = {
      ...DEFAULT_UI_CONFIG.features,
      enabled: { ...DEFAULT_UI_CONFIG.features.enabled, books: false },
    };
    const { primary, more } = splitMobileMenus(visibleMenus(features));
    expect([...primary, ...more].map((m) => m.menu)).not.toContain("books");
    expect(primary.map((m) => m.menu)).toEqual(["dashboard", "stats", "shelf"]);
  });
});

describe("isActive", () => {
  it("mencocokkan rute & sub-rute", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/books/abc", "/")).toBe(false);
    expect(isActive("/feed", "/")).toBe(true);
    expect(isActive("/books/abc", "/books")).toBe(true);
    expect(isActive("/posts/1", "/")).toBe(true);
    expect(isActive("/bookshelf", "/books")).toBe(false);
  });
});
