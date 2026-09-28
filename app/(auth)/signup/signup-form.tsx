"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || "Failed to sign up");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-2 text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          Enter your details below to start your free trial
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="first-name" className="text-muted-foreground">First name</Label>
              <Input
                id="first-name"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last-name" className="text-muted-foreground">Last name</Label>
              <Input
                id="last-name"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-11"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-muted-foreground">Email</Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password" className="text-muted-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="bg-muted border-border text-foreground h-11"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 font-medium">
              {error}
            </div>
          )}

          <Button disabled={loading} type="submit" className="w-full h-11 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all hover:shadow-lg hover:shadow-primary/20">
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
          Sign in
        </Link>
      </p>
    </>
  );
}
