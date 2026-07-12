# Protected server operations

`app/actions/operations.ts` is the public mutation adapter for the operational
services that already exist in TransitOps. UI features must call these Server
Actions rather than invoking a service with a client-provided `actorUserId`.

## Boundary guarantees

For every protected action, `executeProtectedFormOperation` (and its companion
`executeProtectedJsonOperation` for non-form mutations):

1. parses the submitted input with a Zod schema before invoking a domain
   service;
2. reads the actor from `auth.api.getSession` using the incoming request
   headers;
3. disables Better Auth's cookie cache for that read, so revoked database
   sessions cannot authorize a mutation;
4. fetches the actor's authoritative role from the database and exposes it on
   `AuthenticatedActor` so downstream code does not depend on session-cached
   role values; and
5. captures `x-request-id` and client IP from request headers and stores them
   in an `AsyncLocalStorage` context that audit event inserts read
   automatically via `auditMetadata()`.

The action never accepts an acting-user field. It injects only the verified
session user's ID and role into the server-only domain service. Services remain
responsible for permission and domain-state decisions, which keeps those rules
in effect for every caller.

The exported actions cover trip creation, dispatch and lifecycle changes,
maintenance creation and lifecycle changes, fuel logging, and the existing
privileged staff invitation and unlock operations. Invitation acceptance is
intentionally not part of this protected adapter because it is authenticated by
the single-use invitation token; its public flow is completed in the staff
access-management slice.

## Action response contract

Every action returns a serializable `OperationResult`:

```ts
{ ok: true, data: { /* small operation-specific DTO */ } }

{ ok: false, error: { code, message, fieldErrors? } }
```

Validation errors include per-field messages. Authentication, permission,
domain-state, conflict, and unexpected failures use stable, safe messages and
never expose database errors, stack traces, credentials, or raw records.

Unexpected (non-domain) errors are logged server-side with the request ID for
operational diagnostics, while the client receives only a generic safe message.

## Operation adapters

| Adapter | Input source | Use case |
| --- | --- | --- |
| `executeProtectedFormOperation` | `FormData` | HTML form submissions via Server Actions |
| `executeProtectedJsonOperation` | Plain object | Programmatic calls, JSON-based mutations |

Both share the same authentication, validation, error handling, and context
propagation logic.

## Request metadata propagation

The boundary extracts `x-request-id` and the client IP address from request
headers and stores them in an `AsyncLocalStorage` context for the duration of
the operation. Service functions that insert audit events can call
`auditMetadata()` from `@/lib/audit` to spread these values into the insert
without requiring them to be threaded through every function parameter.

## Transaction retries

Serializable trip-dispatch, trip-lifecycle, maintenance-lifecycle, and fuel
transactions use `withSerializableRetry`. PostgreSQL SQLSTATE `40001` retries
the full transaction at most twice after the original attempt, with capped
exponential backoff and jitter. Once the third attempt fails, callers receive
the standard `conflict` response.

## Manual verification

After a later UI slice wires a form to one of these actions, use this repeatable
check with an active Better Auth session:

1. Submit a valid form and confirm the action returns a minimal success DTO.
2. Submit malformed input (for example, a non-UUID trip ID) and confirm the
   response is `validation_failed` with field errors and no database change.
3. Add an `actorUserId` field to the submitted form with another user's ID;
   confirm the audit event records the signed-in user, not the submitted value.
4. Use a role without the action's permission and confirm the response is the
   safe `forbidden` shape.
5. Revoke the active session, submit again, and confirm the response is
   `unauthenticated` rather than performing the mutation.
6. Trigger an unexpected error and confirm the server log includes the request
   ID while the client receives only the generic `internal` error.
