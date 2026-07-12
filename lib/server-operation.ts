import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import { user } from "@/db/schema/auth";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { DomainError, type DomainErrorCode } from "@/lib/domain-error";
import {
  runWithOperationContext,
  type OperationContext,
} from "@/lib/operation-context";

export type OperationErrorCode =
  | DomainErrorCode
  | "unauthenticated"
  | "internal";

export type OperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: OperationErrorCode;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

export interface AuthenticatedActor {
  userId: string;
  role: "admin" | "fleet_manager" | "dispatcher" | "safety_officer" | "financial_analyst";
}

const domainErrorMessages: Record<DomainErrorCode, string> = {
  not_found: "The requested record is no longer available.",
  forbidden: "You do not have permission to perform this operation.",
  invalid_state:
    "This operation is not available in the record's current state.",
  conflict:
    "The record changed or conflicts with another operation. Try again.",
  validation_failed: "Check the submitted information and try again.",
};

function formDataToRecord(formData: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key in values) {
      // A form field must appear once. Null cannot be submitted by FormData and
      // fails each known field schema without depending on a runtime File API.
      values[key] = null;
      continue;
    }

    values[key] = value;
  }

  return values;
}

function validationResult(error: z.ZodError): OperationResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "form";
    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return {
    ok: false,
    error: {
      code: "validation_failed",
      message: "Check the submitted information and try again.",
      fieldErrors,
    },
  };
}

function failureResult(
  error: unknown,
  context: OperationContext,
): OperationResult<never> {
  if (error instanceof DomainError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: domainErrorMessages[error.code],
      },
    };
  }

  // Log unexpected errors server-side for operational diagnostics without
  // exposing any detail to the client response.
  console.error(
    "[server-operation] Unexpected error",
    {
      requestId: context.requestId,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    },
  );

  return {
    ok: false,
    error: {
      code: "internal",
      message: "The operation could not be completed. Try again.",
    },
  };
}

async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: {
      // Mutations must honour session revocation immediately rather than relying
      // on Better Auth's optional signed cookie cache.
      disableCookieCache: true,
      disableRefresh: true,
    },
  });

  if (!session?.user.id) {
    return null;
  }

  // Better Auth includes additional fields in the session user, but the role
  // type is not statically available. Read it from the database to guarantee the
  // authoritative value and avoid trusting a potentially stale session cache.
  const [dbUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!dbUser) {
    return null;
  }

  return { userId: session.user.id, role: dbUser.role };
}

async function extractRequestMetadata(): Promise<OperationContext> {
  const reqHeaders = await headers();
  const requestId = reqHeaders.get("x-request-id");

  // Best-effort client IP: prefer standard forwarding headers, fall back to
  // the direct connection address.
  const ipAddress =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    null;

  return { requestId, ipAddress };
}

/**
 * The only adapter for protected server mutations that accept FormData. It
 * validates untrusted form data and derives the actor exclusively from an
 * authoritative Better Auth session before a domain service can be invoked.
 */
export async function executeProtectedFormOperation<
  TSchema extends z.ZodType,
  TOutput,
>(
  formData: FormData,
  schema: TSchema,
  operation: (
    actor: AuthenticatedActor,
    input: z.output<TSchema>,
  ) => Promise<TOutput>,
): Promise<OperationResult<TOutput>> {
  const parsed = schema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const context = await extractRequestMetadata();

  try {
    const actor = await getAuthenticatedActor();

    if (!actor) {
      return {
        ok: false,
        error: {
          code: "unauthenticated",
          message: "Sign in to perform this operation.",
        },
      };
    }

    const data = await runWithOperationContext(context, () =>
      operation(actor, parsed.data),
    );

    return { ok: true, data };
  } catch (error) {
    return failureResult(error, context);
  }
}

/**
 * Protected server mutation adapter for JSON-shaped input. Validates a plain
 * object against a Zod schema and derives the actor from a verified Better Auth
 * session, following the same security boundary as the form-based adapter.
 *
 * Use this for mutations invoked programmatically rather than from HTML forms.
 */
export async function executeProtectedJsonOperation<
  TSchema extends z.ZodType,
  TOutput,
>(
  input: unknown,
  schema: TSchema,
  operation: (
    actor: AuthenticatedActor,
    validatedInput: z.output<TSchema>,
  ) => Promise<TOutput>,
): Promise<OperationResult<TOutput>> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const context = await extractRequestMetadata();

  try {
    const actor = await getAuthenticatedActor();

    if (!actor) {
      return {
        ok: false,
        error: {
          code: "unauthenticated",
          message: "Sign in to perform this operation.",
        },
      };
    }

    const data = await runWithOperationContext(context, () =>
      operation(actor, parsed.data),
    );

    return { ok: true, data };
  } catch (error) {
    return failureResult(error, context);
  }
}
