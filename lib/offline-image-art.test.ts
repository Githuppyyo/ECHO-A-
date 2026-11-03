import { describe, expect, it } from "vitest";

import { parseOfflineArtScene, sceneToSvg, type OfflineArtScene } from "./offline-image-art";

describe("offline image art", () => {
  it("parses and serializes each supported primitive using constructed SVG nodes", () => {
    const scene = parseOfflineArtScene(JSON.stringify({
      viewBox: "0 0 512 512",
      primitives: [
        { type: "rect", x: 10, y: 20, width: 100, height: 80, rx: 4, fill: "#abc", stroke: "#11223344", strokeWidth: 2 },
        { type: "circle", cx: 64, cy: 64, r: 20, fill: "none", stroke: "#ffffff" },
        { type: "ellipse", cx: 128, cy: 64, rx: 30, ry: 12, fill: "#123456" },
        { type: "line", x1: 1, y1: 2, x2: 3, y2: 4, stroke: "#000", strokeWidth: 1 },
        { type: "text", x: 20, y: 200, text: "Hello", fontSize: 18, fill: "#aabbcc" },
        { type: "path", d: "M 0 0 L 10 10 C 12 14 16 18 20 20 Z", fill: "#f00" },
      ],
    }));

    expect(scene).not.toBeNull();
    expect(scene?.primitives).toHaveLength(6);
    const svg = sceneToSvg(scene!);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">');
    expect(svg).toContain('<rect x="10" y="20" width="100" height="80" rx="4" fill="#abc" stroke="#11223344" stroke-width="2"/>');
    expect(svg).toContain('<circle cx="64" cy="64" r="20" fill="none" stroke="#ffffff"/>');
    expect(svg).toContain('<ellipse cx="128" cy="64" rx="30" ry="12" fill="#123456"/>');
    expect(svg).toContain('<line x1="1" y1="2" x2="3" y2="4" stroke="#000" stroke-width="1"/>');
    expect(svg).toContain('<text x="20" y="200" font-size="18" fill="#aabbcc">Hello</text>');
    expect(svg).toContain('<path d="M 0 0 L 10 10 C 12 14 16 18 20 20 Z" fill="#f00"/>');
  });

  it("accepts JSON-only fenced model output", () => {
    const scene = parseOfflineArtScene('```json\n{"viewBox":"0 0 512 512","primitives":[{"type":"circle","cx":5,"cy":6,"r":7}]}\n```');
    expect(scene).toEqual({
      viewBox: "0 0 512 512",
      primitives: [{ type: "circle", cx: 5, cy: 6, r: 7 }],
    });
  });

  it("clamps finite coordinates and dimensions into the canvas range", () => {
    const scene = parseOfflineArtScene(JSON.stringify({
      viewBox: "0 0 512 512",
      primitives: [
        { type: "rect", x: -12, y: 900, width: 999, height: -1, rx: 700, fill: "#fff" },
        { type: "circle", cx: 700, cy: -5, r: 600 },
        { type: "path", d: "M -20 -10 L 700 900 A 700 20 -30 0 1 700 -5" },
      ],
    }));
    expect(scene?.primitives).toEqual([
      { type: "rect", x: 0, y: 512, width: 512, height: 0, rx: 512, fill: "#fff" },
      { type: "circle", cx: 512, cy: 0, r: 512 },
      { type: "path", d: "M 0 0 L 512 512 A 512 20 0 0 1 512 0" },
    ]);
  });

  it("escapes text content and never emits text as markup", () => {
    const scene = parseOfflineArtScene(JSON.stringify({
      viewBox: "0 0 512 512",
      primitives: [{ type: "text", x: 0, y: 20, text: `A&B <tag> "quoted" 'apostrophe'` }],
    }));
    expect(scene).not.toBeNull();
    const svg = sceneToSvg(scene!);
    expect(svg).toContain("A&amp;B &lt;tag&gt; &quot;quoted&quot; &apos;apostrophe&apos;");
    expect(svg).not.toContain("<tag>");
  });

  it.each([
    ["raw script markup", '{"viewBox":"0 0 512 512","primitives":[{"type":"rect","x":0,"y":0,"width":1,"height":1}]}<script>alert(1)</script>'],
    ["script primitive", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "script", content: "alert(1)" }] })],
    ["tag-like unknown key", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "rect", x: 0, y: 0, width: 1, height: 1, "<script>": "x" }] })],
    ["URL paint", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "circle", cx: 1, cy: 1, r: 1, fill: "url(https://evil.example/a)" }] })],
    ["non-allowlisted color", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "circle", cx: 1, cy: 1, r: 1, stroke: "red" }] })],
    ["malicious path markup", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "path", d: 'M0 0<image href="https://evil.example/x"/>' }] })],
    ["unsupported path command", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "path", d: "M0 0 X 2 3" }] })],
    ["invalid arc flags", JSON.stringify({ viewBox: "0 0 512 512", primitives: [{ type: "path", d: "M0 0 A4 4 0 2 1 8 8" }] })],
  ])("rejects %s as an invalid whole scene", (_label, input) => {
    expect(parseOfflineArtScene(input)).toBeNull();
  });

  it("rejects more than 32 primitives instead of truncating the scene", () => {
    const scene = {
      viewBox: "0 0 512 512",
      primitives: Array.from({ length: 33 }, () => ({ type: "circle", cx: 1, cy: 1, r: 1 })),
    };
    expect(parseOfflineArtScene(JSON.stringify(scene))).toBeNull();
  });

  it.each([
    "",
    "{not json}",
    '```json\n{"viewBox":"0 0 512 512","primitives":[]}\n``` trailing text',
    '```\n{"viewBox":"0 0 512 512","primitives":[]}\n```',
    JSON.stringify({ viewBox: "0 0 500 512", primitives: [] }),
  ])("rejects malformed, non-JSON-fenced, or non-512 scenes: %s", (input) => {
    expect(parseOfflineArtScene(input)).toBeNull();
  });

  it("fails closed when sceneToSvg receives a forged unsafe runtime value", () => {
    const forged = {
      viewBox: "0 0 512 512",
      primitives: [{ type: "text", x: 0, y: 0, text: "ok", href: "https://evil.example" }],
    } as unknown as OfflineArtScene;
    expect(sceneToSvg(forged)).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"></svg>');
  });

  it("keeps generated output within its bounded size", () => {
    const longPath = `M0 0${" L1 1".repeat(240)}`;
    const input = JSON.stringify({
      viewBox: "0 0 512 512",
      primitives: Array.from({ length: 32 }, () => ({ type: "path", d: longPath })),
    });
    expect(parseOfflineArtScene(input)).toBeNull();
  });
});
