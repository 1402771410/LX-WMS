import { describe, expect, it } from "vitest";
import { sanitizeReleaseNote } from "../text";

describe("sanitizeReleaseNote", () => {
  it("removes html tags and entities", () => {
    const input = "<ul><li>修复 A</li><li>优化&nbsp;B</li></ul>";
    expect(sanitizeReleaseNote(input)).toBe("修复 A 优化 B");
  });

  it("removes escaped html tags", () => {
    const input = "&lt;ul&gt;&lt;li&gt;修复 A&lt;/li&gt;&lt;/ul&gt;";
    expect(sanitizeReleaseNote(input)).toBe("修复 A");
  });

  it("keeps plain text and trims", () => {
    expect(sanitizeReleaseNote("  修复更新  ")).toBe("修复更新");
  });
});
