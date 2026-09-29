import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("accessibility shell", () => {
  it("exposes a skip link, a main landmark, and reduced motion", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    assert.match(layout, /href="#main"/);
    assert.match(layout, /id="main"/);
    assert.match(css, /prefers-reduced-motion/);
  });
});
