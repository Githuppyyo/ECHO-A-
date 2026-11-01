import { describe, expect, it } from "vitest";

import { normalizeInlineMath, parseChatMarkdown } from "./chat-markdown";

describe("parseChatMarkdown", () => {
  it("formats a LaTeX photosynthesis equation as readable Unicode text", () => {
    expect(
      normalizeInlineMath("$6CO_2 + 6H_2O + \\text{Işık Enerjisi} \\rightarrow C_6H_{12}O_6 + 6O_2$"),
    ).toBe("6CO₂ + 6H₂O + Işık Enerjisi → C₆H₁₂O₆ + 6O₂");
  });

  it("keeps fenced code and its language as a separate block", () => {
    expect(parseChatMarkdown("Örnek:\n\n```ts\nconst x = 1;\n```\n" )).toEqual([
      { type: "paragraph", text: "Örnek:" },
      { type: "code", language: "ts", code: "const x = 1;" },
    ]);
  });

  it("parses Markdown tables into normalized headers and rows", () => {
    expect(parseChatMarkdown("| Görev | Durum | Süre |\n| --- | --- | --- |\n| Tasarım | Hazır | 2 gün |" )).toEqual([
      {
        type: "table",
        headers: ["Görev", "Durum", "Süre"],
        rows: [["Tasarım", "Hazır", "2 gün"]],
      },
    ]);
  });

  it("keeps every Markdown list description attached to its visible marker", () => {
    expect(parseChatMarkdown("İşte açıklamalar:\n- **Su:** H₂O.\n- **Işık:** Enerji sağlar." )).toEqual([
      { type: "paragraph", text: "İşte açıklamalar:" },
      { type: "list", ordered: false, items: ["**Su:** H₂O.", "**Işık:** Enerji sağlar."] },
    ]);
  });

  it("keeps escaped pipe characters inside a cell", () => {
    expect(parseChatMarkdown("| Başlık | Tür |\n| --- | --- |\n| Giriş \\| çıkış | Kod |" )).toEqual([
      { type: "table", headers: ["Başlık", "Tür"], rows: [["Giriş | çıkış", "Kod"]] },
    ]);
  });

  it("keeps ordinary prose in readable paragraphs", () => {
    expect(parseChatMarkdown("İlk satır\nikinci satır\n\nYeni paragraf." )).toEqual([
      { type: "paragraph", text: "İlk satır\nikinci satır" },
      { type: "paragraph", text: "Yeni paragraf." },
    ]);
  });
});
