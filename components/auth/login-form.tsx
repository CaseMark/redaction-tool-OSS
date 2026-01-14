"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  /** URL to redirect to after successful login */
  callbackUrl?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Maps auth error codes/messages to user-friendly error messages.
 * Better Auth returns specific error codes that we translate for better UX.
 */
function getErrorMessage(error: { code?: string; message?: string; status?: number }): string {
  // Log the full error for debugging (visible in browser console)
  console.log('[Auth Error]', { code: error.code, message: error.message, status: error.status });

  const errorCode = (error.code || '').toLowerCase().replace(/_/g, ' ');
  const errorMessage = (error.message || '').toLowerCase();

  // User not found - email doesn't exist in database
  if (
    errorCode.includes('user not found') ||
    errorCode.includes('invalid email') ||
    errorCode.includes('no user') ||
    errorMessage.includes('user not found') ||
    errorMessage.includes('no user') ||
    errorMessage.includes('account not found') ||
    errorMessage.includes('does not exist') ||
    errorMessage.includes('user does not exist') ||
    errorMessage.includes('email not found') ||
    errorMessage.includes('no account')
  ) {
    return 'No account exists for this email address.';
  }

  // Invalid credentials - could be wrong password OR user not found (depending on config)
  if (
    errorCode.includes('invalid email or password') ||
    errorCode.includes('invalid credentials') ||
    errorCode.includes('credential') ||
    errorMessage.includes('invalid email or password') ||
    errorMessage.includes('invalid credentials') ||
    errorMessage.includes('incorrect password') ||
    errorMessage.includes('wrong password') ||
    errorMessage.includes('password is incorrect')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  // Specifically wrong password (if server distinguishes this)
  if (
    errorCode.includes('invalid password') ||
    errorCode.includes('wrong password') ||
    errorMessage.includes('invalid password') ||
    errorMessage.includes('password incorrect')
  ) {
    return 'Incorrect password. Please try again.';
  }

  // Account locked/disabled
  if (
    errorCode.includes('locked') ||
    errorCode.includes('disabled') ||
    errorCode.includes('suspended') ||
    errorMessage.includes('locked') ||
    errorMessage.includes('disabled') ||
    errorMessage.includes('suspended')
  ) {
    return 'This account has been locked. Please contact support.';
  }

  // Too many attempts
  if (
    errorCode.includes('too many') ||
    errorCode.includes('rate limit') ||
    errorMessage.includes('too many') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('try again later')
  ) {
    return 'Too many login attempts. Please try again later.';
  }

  // Email not verified
  if (
    errorCode.includes('not verified') ||
    errorCode.includes('unverified') ||
    errorMessage.includes('not verified') ||
    errorMessage.includes('verify your email') ||
    errorMessage.includes('email verification')
  ) {
    return 'Please verify your email address before signing in.';
  }

  // Default error message
  return error.message || 'Failed to sign in. Please try again.';
}

/**
 * Login Form Component
 *
 * Handles email/password authentication with Better Auth.
 * Automatically redirects to 2FA verification if enabled.
 * Provides specific error messages for common auth failures.
 *
 * @example
 * <LoginForm callbackUrl="/dashboard" />
 */
export function LoginForm({ callbackUrl = "/dashboard", className }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(getErrorMessage(authError));
        setLoading(false);
        return;
      }

      // Check if 2FA verification is required
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        router.push("/verify-2fa");
        return;
      }

      router.push(callbackUrl);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
