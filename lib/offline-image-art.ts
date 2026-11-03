/**
 * A deliberately small, data-only vocabulary for locally generated artwork.
 * Scenes use the fixed `0 0 512 512` viewBox; arbitrary SVG markup is never
 * accepted. Optional paint properties are limited to hex colors or `none`.
 */
export type OfflineArtPaint = `#${string}` | "none";

export type OfflineArtRect = {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
  fill?: OfflineArtPaint;
  stroke?: OfflineArtPaint;
  strokeWidth?: number;
};

export type OfflineArtCircle = {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  fill?: OfflineArtPaint;
  stroke?: OfflineArtPaint;
  strokeWidth?: number;
};

export type OfflineArtEllipse = {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill?: OfflineArtPaint;
  stroke?: OfflineArtPaint;
  strokeWidth?: number;
};

export type OfflineArtLine = {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: OfflineArtPaint;
  strokeWidth?: number;
};

export type OfflineArtText = {
  type: "text";
  x: number;
  y: number;
  text: string;
  fill?: OfflineArtPaint;
  stroke?: OfflineArtPaint;
  strokeWidth?: number;
  fontSize?: number;
};

export type OfflineArtPath = {
  type: "path";
  d: string;
  fill?: OfflineArtPaint;
  stroke?: OfflineArtPaint;
  strokeWidth?: number;
};

export type OfflineArtPrimitive =
  | OfflineArtRect
  | OfflineArtCircle
  | OfflineArtEllipse
  | OfflineArtLine
  | OfflineArtText
  | OfflineArtPath;

/** A validated 512×512 scene containing no more than 32 safe primitives. */
export type OfflineArtScene = {
  viewBox: "0 0 512 512";
  primitives: OfflineArtPrimitive[];
};

const VIEW_BOX = "0 0 512 512" as const;
const MAX_PRIMITIVES = 32;
const MAX_TEXT_LENGTH = 240;
const MAX_PATH_LENGTH = 1500;
const MAX_MODEL_OUTPUT_LENGTH = 64_000;
const MAX_SVG_OUTPUT_LENGTH = 32_768;
const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"></svg>';
const PATH_COMMANDS = new Set(["M", "m", "L", "l", "H", "h", "V", "v", "C", "c", "S", "s", "Q", "q", "T", "t", "A", "a", "Z", "z"]);
const PATH_ARITY: Record<string, number> = {
  M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1,
  C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7,
};
const NUMBER_PATTERN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key));
}

function boundedNumber(value: unknown, min = 0, max = 512): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.min(max, Math.max(min, value));
  return Object.is(clamped, -0) ? 0 : clamped;
}

function readPaint(record: UnknownRecord, key: "fill" | "stroke"): OfflineArtPaint | undefined | null {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (typeof value !== "string") return null;
  if (value === "none" || /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6}|[\da-fA-F]{8})$/.test(value)) {
    return value as OfflineArtPaint;
  }
  return null;
}

function readOptionalNumber(record: UnknownRecord, key: string, min = 0, max = 512): number | undefined | null {
  if (!(key in record)) return undefined;
  return boundedNumber(record[key], min, max);
}

function isXmlSafeText(value: string): boolean {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(value)) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) return false;
  }
  return true;
}

/** Validates and bounds the restricted SVG path grammar without evaluating markup. */
function normalizedPathData(data: string): string | null {
  if (data.length === 0 || data.length > MAX_PATH_LENGTH) return null;

  const tokens: Array<{ command?: string; value?: number }> = [];
  let index = 0;
  let previousWasCommand = false;
  let commaPending = false;
  let sawToken = false;

  while (index < data.length) {
    while (index < data.length && /\s/.test(data[index]!)) index += 1;
    if (index >= data.length) break;

    if (data[index] === ",") {
      if (!sawToken || previousWasCommand || commaPending) return null;
      commaPending = true;
      index += 1;
      continue;
    }

    const character = data[index]!;
    if (PATH_COMMANDS.has(character)) {
      if (commaPending) return null;
      tokens.push({ command: character });
      index += 1;
      previousWasCommand = true;
      sawToken = true;
      continue;
    }

    NUMBER_PATTERN.lastIndex = index;
    const match = NUMBER_PATTERN.exec(data);
    if (!match || match.index !== index) return null;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) return null;
    if (commaPending && previousWasCommand) return null;
    tokens.push({ value });
    index = NUMBER_PATTERN.lastIndex;
    previousWasCommand = false;
    commaPending = false;
    sawToken = true;
  }

  if (!tokens.length || commaPending || !tokens[0]!.command) return null;

  let tokenIndex = 0;
  const normalized: string[] = [];
  while (tokenIndex < tokens.length) {
    const command = tokens[tokenIndex]!.command;
    if (!command) return null;
    tokenIndex += 1;

    if (command === "Z" || command === "z") {
      normalized.push(command);
      continue;
    }
    const arity = PATH_ARITY[command];
    if (!arity) return null;

    const numbers: number[] = [];
    while (tokenIndex < tokens.length && tokens[tokenIndex]!.command === undefined) {
      numbers.push(tokens[tokenIndex]!.value!);
      tokenIndex += 1;
    }
    if (numbers.length === 0 || numbers.length % arity !== 0) return null;

    if (command === "A" || command === "a") {
      for (let offset = 0; offset < numbers.length; offset += 7) {
        if (![0, 1].includes(numbers[offset + 3]!) || ![0, 1].includes(numbers[offset + 4]!)) return null;
      }
    }

    const relative = command === command.toLowerCase();
    const bounded = numbers.map((number, offset) => {
      if (command === "A" || command === "a") {
        const positionInArc = offset % 7;
        if (positionInArc === 0 || positionInArc === 1) return Math.min(512, Math.max(0, number));
        if (positionInArc === 2) return Math.min(360, Math.max(0, number));
        if (positionInArc === 3 || positionInArc === 4) return number;
        return Math.min(512, Math.max(relative ? -512 : 0, number));
      }
      if (command === "H" || command === "h" || command === "V" || command === "v") {
        return Math.min(512, Math.max(relative ? -512 : 0, number));
      }
      return Math.min(512, Math.max(relative ? -512 : 0, number));
    }).map((number) => Object.is(number, -0) ? 0 : number);
    normalized.push(`${command} ${bounded.join(" ")}`);
  }

  return normalized.join(" ");
}

function normalizedPrimitive(value: unknown): OfflineArtPrimitive | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  const type = value.type;
  const paintKeys = ["fill", "stroke", "strokeWidth"] as const;
  const fill = readPaint(value, "fill");
  const stroke = readPaint(value, "stroke");
  const strokeWidth = readOptionalNumber(value, "strokeWidth", 0, 64);
  if (fill === null || stroke === null || strokeWidth === null) return null;

  const paint = {
    ...(fill === undefined ? {} : { fill }),
    ...(stroke === undefined ? {} : { stroke }),
    ...(strokeWidth === undefined ? {} : { strokeWidth }),
  };

  if (type === "rect") {
    if (!hasOnlyKeys(value, ["type", "x", "y", "width", "height", "rx", "ry", ...paintKeys])) return null;
    const x = boundedNumber(value.x);
    const y = boundedNumber(value.y);
    const width = boundedNumber(value.width);
    const height = boundedNumber(value.height);
    const rx = readOptionalNumber(value, "rx");
    const ry = readOptionalNumber(value, "ry");
    if (x === null || y === null || width === null || height === null || rx === null || ry === null) return null;
    return { type, x, y, width, height, ...(rx === undefined ? {} : { rx }), ...(ry === undefined ? {} : { ry }), ...paint };
  }

  if (type === "circle") {
    if (!hasOnlyKeys(value, ["type", "cx", "cy", "r", ...paintKeys])) return null;
    const cx = boundedNumber(value.cx);
    const cy = boundedNumber(value.cy);
    const r = boundedNumber(value.r);
    if (cx === null || cy === null || r === null) return null;
    return { type, cx, cy, r, ...paint };
  }

  if (type === "ellipse") {
    if (!hasOnlyKeys(value, ["type", "cx", "cy", "rx", "ry", ...paintKeys])) return null;
    const cx = boundedNumber(value.cx);
    const cy = boundedNumber(value.cy);
    const rx = boundedNumber(value.rx);
    const ry = boundedNumber(value.ry);
    if (cx === null || cy === null || rx === null || ry === null) return null;
    return { type, cx, cy, rx, ry, ...paint };
  }

  if (type === "line") {
    if (!hasOnlyKeys(value, ["type", "x1", "y1", "x2", "y2", "stroke", "strokeWidth"]) || fill !== undefined) return null;
    const x1 = boundedNumber(value.x1);
    const y1 = boundedNumber(value.y1);
    const x2 = boundedNumber(value.x2);
    const y2 = boundedNumber(value.y2);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return { type, x1, y1, x2, y2, ...(stroke === undefined ? {} : { stroke }), ...(strokeWidth === undefined ? {} : { strokeWidth }) };
  }

  if (type === "text") {
    if (!hasOnlyKeys(value, ["type", "x", "y", "text", "fill", "stroke", "strokeWidth", "fontSize"])) return null;
    const x = boundedNumber(value.x);
    const y = boundedNumber(value.y);
    const fontSize = readOptionalNumber(value, "fontSize", 1, 128);
    if (x === null || y === null || fontSize === null || typeof value.text !== "string" || value.text.length > MAX_TEXT_LENGTH || !isXmlSafeText(value.text)) return null;
    return { type, x, y, text: value.text, ...(fill === undefined ? {} : { fill }), ...(stroke === undefined ? {} : { stroke }), ...(strokeWidth === undefined ? {} : { strokeWidth }), ...(fontSize === undefined ? {} : { fontSize }) };
  }

  if (type === "path") {
    if (!hasOnlyKeys(value, ["type", "d", ...paintKeys]) || typeof value.d !== "string") return null;
    const d = normalizedPathData(value.d);
    if (d === null) return null;
    return { type, d, ...paint };
  }

  return null;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&apos;";
    }
  });
}

function attribute(name: string, value: string | number): string {
  return ` ${name}="${escapeXml(String(value))}"`;
}

function primitiveToSvg(primitive: OfflineArtPrimitive): string {
  const paintAttrs = (item: { fill?: OfflineArtPaint; stroke?: OfflineArtPaint; strokeWidth?: number }) =>
    `${item.fill === undefined ? "" : attribute("fill", item.fill)}${item.stroke === undefined ? "" : attribute("stroke", item.stroke)}${item.strokeWidth === undefined ? "" : attribute("stroke-width", item.strokeWidth)}`;

  switch (primitive.type) {
    case "rect":
      return `<rect${attribute("x", primitive.x)}${attribute("y", primitive.y)}${attribute("width", primitive.width)}${attribute("height", primitive.height)}${primitive.rx === undefined ? "" : attribute("rx", primitive.rx)}${primitive.ry === undefined ? "" : attribute("ry", primitive.ry)}${paintAttrs(primitive)}/>`;
    case "circle":
      return `<circle${attribute("cx", primitive.cx)}${attribute("cy", primitive.cy)}${attribute("r", primitive.r)}${paintAttrs(primitive)}/>`;
    case "ellipse":
      return `<ellipse${attribute("cx", primitive.cx)}${attribute("cy", primitive.cy)}${attribute("rx", primitive.rx)}${attribute("ry", primitive.ry)}${paintAttrs(primitive)}/>`;
    case "line":
      return `<line${attribute("x1", primitive.x1)}${attribute("y1", primitive.y1)}${attribute("x2", primitive.x2)}${attribute("y2", primitive.y2)}${primitive.stroke === undefined ? "" : attribute("stroke", primitive.stroke)}${primitive.strokeWidth === undefined ? "" : attribute("stroke-width", primitive.strokeWidth)}/>`;
    case "text":
      return `<text${attribute("x", primitive.x)}${attribute("y", primitive.y)}${primitive.fontSize === undefined ? "" : attribute("font-size", primitive.fontSize)}${paintAttrs(primitive)}>${escapeXml(primitive.text)}</text>`;
    case "path":
      return `<path${attribute("d", primitive.d)}${paintAttrs(primitive)}/>`;
  }
}

function serializeValidatedScene(scene: OfflineArtScene): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">${scene.primitives.map(primitiveToSvg).join("")}</svg>`;
  return svg.length <= MAX_SVG_OUTPUT_LENGTH ? svg : EMPTY_SVG;
}

function validateScene(value: unknown): OfflineArtScene | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["viewBox", "primitives"]) || value.viewBox !== VIEW_BOX || !Array.isArray(value.primitives) || value.primitives.length > MAX_PRIMITIVES) return null;

  const primitives: OfflineArtPrimitive[] = [];
  for (const primitive of value.primitives) {
    const normalized = normalizedPrimitive(primitive);
    if (!normalized) return null;
    primitives.push(normalized);
  }

  const scene: OfflineArtScene = { viewBox: VIEW_BOX, primitives };
  if (serializeValidatedScene(scene) === EMPTY_SVG && primitives.length > 0) return null;
  return scene;
}

/**
 * Parse JSON scene data (or a JSON-only ```json fenced block) from the local
 * model. Invalid, oversized, or partially unsafe scenes are rejected as a
 * whole; no SVG/HTML markup is evaluated or repaired.
 */
export function parseOfflineArtScene(modelOutput: string): OfflineArtScene | null {
  if (typeof modelOutput !== "string" || modelOutput.length > MAX_MODEL_OUTPUT_LENGTH) return null;

  let json = modelOutput.trim();
  const fenced = /^```json\s*([\s\S]*?)\s*```$/i.exec(json);
  if (fenced) json = fenced[1]!;

  try {
    return validateScene(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

/**
 * Construct a bounded SVG document using only known node/attribute names.
 * The input is revalidated at runtime; forged or invalid scenes become an
 * empty safe SVG rather than being interpolated into markup.
 */
export function sceneToSvg(scene: OfflineArtScene): string {
  const validated = validateScene(scene);
  if (!validated) return EMPTY_SVG;
  return serializeValidatedScene(validated);
}
