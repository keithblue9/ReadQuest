import { describe, expect, it } from "vitest";

import { treeOrder } from "./lookups";
import { allowedSections } from "./sections";

describe("treeOrder", () => {
  it("menempatkan sub-fungsi tepat setelah induknya", () => {
    const items = [
      { id: "b1", parent_id: "b" },
      { id: "a", parent_id: null },
      { id: "b", parent_id: null },
      { id: "a1", parent_id: "a" },
      { id: "a1x", parent_id: "a1" },
    ];
    expect(treeOrder(items).map((i) => i.id)).toEqual(["a", "a1", "a1x", "b", "b1"]);
  });

  it("memperlakukan induk yang hilang sebagai akar", () => {
    expect(treeOrder([{ id: "x", parent_id: "hilang" }]).map((i) => i.id)).toEqual(["x"]);
  });
});

describe("allowedSections", () => {
  it("hanya menampilkan menu sesuai permission", () => {
    expect(allowedSections(["audit.view", "post.moderate"]).map((s) => s.href)).toEqual([
      "/admin/moderation",
      "/admin/audit",
    ]);
    expect(allowedSections(["post.create"])).toEqual([]);
  });
});
