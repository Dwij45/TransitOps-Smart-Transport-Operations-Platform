import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptStaffInvitation } from "@/lib/services/staff-management";

const schema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
});

/**
 * POST /api/auth/accept-invitation
 *
 * Accepts a staff invitation by consuming the single-use token and setting
 * a permanent password on the account.
 *
 * Body: { token: string, password: string, confirmPassword: string }
 *
 * Success 200: { ok: true, userId: string, email: string, role: string }
 * Error  422:  Validation failure or expired/used token
 * Error  409:  Invitation already accepted
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { token, password, confirmPassword } = parsed.data;

  // Edge case: passwords must match before we even hit the DB
  if (password !== confirmPassword) {
    return NextResponse.json(
      { ok: false, error: "Passwords do not match", issues: { confirmPassword: ["Passwords do not match"] } },
      { status: 422 },
    );
  }

  try {
    const activatedUser = await acceptStaffInvitation({ token, password });

    return NextResponse.json({
      ok: true,
      data: {
        userId: activatedUser.id,
        email: activatedUser.email,
        role: activatedUser.role,
        emailVerified: activatedUser.emailVerified,
        message: "Invitation accepted. You can now sign in with your email and password.",
      },
    });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    const code: string = errorObj?.code ?? "internal";

    if (code === "validation_failed") {
      return NextResponse.json(
        { ok: false, error: errorObj.message ?? "Invitation is invalid or expired" },
        { status: 422 },
      );
    }
    if (code === "conflict") {
      return NextResponse.json(
        { ok: false, error: "This invitation has already been accepted. Please sign in instead." },
        { status: 409 },
      );
    }
    if (code === "not_found") {
      return NextResponse.json(
        { ok: false, error: "The invited user account no longer exists. Contact your administrator." },
        { status: 404 },
      );
    }

    console.error("[accept-invitation] Unexpected error:", errorObj?.message ?? err);
    return NextResponse.json(
      { ok: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
