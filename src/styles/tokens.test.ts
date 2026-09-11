import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { colorsDark, radius, spacing, typography } from "../shared/theme";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

function cssVar(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("tokens.css mirrors the phone theme", () => {
  it.each(Object.entries(colorsDark))("color %s", (key, value) => {
    expect(cssVar(`color-${kebab(key)}`)?.toUpperCase()).toBe(value.toUpperCase());
  });

  it.each(Object.entries(spacing))("spacing %s", (key, value) => {
    expect(cssVar(`space-${key}`)).toBe(`${value}px`);
  });

  it.each(Object.entries(radius))("radius %s", (key, value) => {
    expect(cssVar(`radius-${key}`)).toBe(`${value}px`);
  });

  it.each(["header", "title", "body", "caption"] as const)("typography %s", (key) => {
    const token = typography[key];
    expect(cssVar(`type-${key}-size`)).toBe(`${token.fontSize}px`);
    expect(cssVar(`type-${key}-weight`)).toBe(token.fontWeight);
  });
});
