/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import indexCss from "./index.css?raw";

function readHexToken(tokenName: string): string {
  const match = indexCss.match(
    new RegExp(`--color-${tokenName}:\\s*(#[0-9a-fA-F]{6});`),
  );

  if (match?.[1] === undefined) {
    throw new Error(`Colour token --color-${tokenName} was not found.`);
  }

  return match[1];
}

function calculateRelativeLuminance(hexColour: string): number {
  function calculateChannel(offset: number): number {
    const channel = Number.parseInt(hexColour.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }

  return (
    0.2126 * calculateChannel(1) +
    0.7152 * calculateChannel(3) +
    0.0722 * calculateChannel(5)
  );
}

function calculateContrastRatio(firstColour: string, secondColour: string): number {
  const firstLuminance = calculateRelativeLuminance(firstColour);
  const secondLuminance = calculateRelativeLuminance(secondColour);
  const lighterLuminance = Math.max(firstLuminance, secondLuminance);
  const darkerLuminance = Math.min(firstLuminance, secondLuminance);

  return (lighterLuminance + 0.05) / (darkerLuminance + 0.05);
}

describe("design token contrast", () => {
  const accent = readHexToken("accent");
  const background = readHexToken("background");
  const card = readHexToken("card");
  const ring = readHexToken("ring");

  it("keeps small accent text readable on page and card backgrounds", () => {
    expect(calculateContrastRatio(accent, background)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(accent, card)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the focus ring distinguishable on page and card backgrounds", () => {
    expect(calculateContrastRatio(ring, background)).toBeGreaterThanOrEqual(3);
    expect(calculateContrastRatio(ring, card)).toBeGreaterThanOrEqual(3);
  });
});
