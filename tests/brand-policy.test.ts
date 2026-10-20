import { describe, expect, it } from "vitest";
import { concealInternalModelName } from "../lib/brand-policy";

describe("concealInternalModelName", () => {
  it("hides common names and filename-style variants of the private local engine", () => {
    expect(concealInternalModelName("Gemma 4 E4B")).toBe("ECHO AI");
    expect(concealInternalModelName("gemma-4-e4b-it-litert-lm")).toBe("ECHO AI");
    expect(concealInternalModelName("GEMMA_4_E4B_IT")).toBe("ECHO AI");
  });

  it("preserves unrelated text and code", () => {
    const value = "const total = 4;\nconsole.log('ready');";
    expect(concealInternalModelName(value)).toBe(value);
  });
});
