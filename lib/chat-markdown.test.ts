import { describe, expect, it } from "vitest";

import { parseChatMarkdown } from "./chat-markdown";

describe("parseChatMarkdown", () => {
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
