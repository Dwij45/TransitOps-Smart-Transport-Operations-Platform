import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { DomainError } from "@/lib/domain-error";

function storageRoot(): string {
  const bucket = process.env.OBJECT_STORAGE_BUCKET?.trim() ?? "";
  const directory = process.env.OBJECT_STORAGE_DIR?.trim() ?? "";

  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket) || !directory) {
    throw new DomainError("invalid_state", "Object storage is not configured");
  }

  return path.resolve(process.cwd(), directory, bucket);
}

function resolveKey(storageKey: string): string {
  if (!/^[A-Za-z0-9/_.-]+$/.test(storageKey)) {
    throw new DomainError("validation_failed", "Storage key is invalid");
  }

  const root = storageRoot();
  const full = path.resolve(root, ...storageKey.split("/"));
  const relative = path.relative(root, full);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new DomainError("validation_failed", "Storage key is invalid");
  }

  return full;
}

export async function putObject(storageKey: string, body: Buffer): Promise<void> {
  const full = resolveKey(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

export async function readObject(storageKey: string): Promise<Buffer> {
  try {
    return await readFile(resolveKey(storageKey));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      throw new DomainError("not_found", "Stored file is missing");
    }
    throw error;
  }
}

export async function removeObject(storageKey: string): Promise<void> {
  await rm(resolveKey(storageKey), { force: true });
}
