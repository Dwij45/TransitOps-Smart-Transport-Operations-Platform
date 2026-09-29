import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectDocumentType, MAX_DOCUMENT_BYTES } from "../lib/document-policy.ts";

describe("vehicle document policy", () => {
  it("recognizes PDF, JPEG, PNG, and WebP from file contents", () => {
    assert.equal(detectDocumentType(Buffer.from("%PDF-1.1")), "application/pdf");
    assert.equal(detectDocumentType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
    assert.equal(
      detectDocumentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    assert.equal(detectDocumentType(webp), "image/webp");
  });

  it("rejects a file whose contents are not an allowed type", () => {
    assert.equal(detectDocumentType(Buffer.from("hello")), null);
    assert.equal(detectDocumentType(Buffer.from("%PDF")), null);
  });

  it("caps an upload at 1 MB", () => {
    assert.equal(MAX_DOCUMENT_BYTES, 1_048_576);
  });
});
