export const MAX_DOCUMENT_BYTES = 1_048_576;

export const allowedDocumentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedDocumentType = (typeof allowedDocumentTypes)[number];

const signatures: { mime: AllowedDocumentType; matches: (bytes: Uint8Array) => boolean }[] = [
  {
    mime: "application/pdf",
    matches: (bytes) =>
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d,
  },
  {
    mime: "image/jpeg",
    matches: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mime: "image/png",
    matches: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    mime: "image/webp",
    matches: (bytes) =>
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
];

export function detectDocumentType(bytes: Uint8Array): AllowedDocumentType | null {
  return signatures.find((signature) => signature.matches(bytes))?.mime ?? null;
}
