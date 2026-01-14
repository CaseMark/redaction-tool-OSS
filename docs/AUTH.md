# Client-Side Authentication Architecture

This document explains how authentication and authorization work in the Smart Redaction Tool, how data is stored and secured, and how to manage/clear auth data across different environments.

---

## Overview

This application uses **Better Auth** for authentication, which provides a flexible, type-safe auth system that can work with various backends. The app ships with production-ready authentication that connects to a database.

For demos and local development without a database, you can use the public-by-default auth mode that allows access to routes without authentication.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                                 │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    React Auth Client                                  │ │
│  │                                                                       │ │
│  │  Hooks:                    Methods:                                  │ │
│  │  • useSession()            • signIn.email({ email, password })       │ │
│  │  • useActiveOrganization() • signUp.email({ email, password, name }) │ │
│  │  • useListOrganizations()  • signOut()                               │ │
│  │                            • organization.create()                    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                           │                                │
└───────────────────────────────────────────┼────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           SERVER (Next.js)                                 │
│                                                                            │
│  middleware.ts:                                                            │
│  • Checks for cookie: better-auth.session_token                           │
│  • Redirects to /login if no session cookie exists                        │
│                                                                            │
│  Protected routes: /dashboard, /settings, /account, /admin                │
│  Public routes: /, /login, /signup, /api/auth/*                           │
│                                                                            │
│  API Routes:                                                               │
│  • /api/auth/[...all] - Better Auth API handlers                          │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flows

### Sign Up Flow

```
User → SignupForm → authClient.signUp.email()
                            │
                            ▼
                   ┌─────────────────┐
                   │ 1. Validate     │
                   │    input        │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │ 2. Check email  │
                   │    not exists   │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │ 3. Hash password│
                   │    & store user │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │ 4. Create       │
                   │    session      │
                   └────────┬────────┘
                            │
                            ▼
                   Navigate to /dashboard
```

### Sign In Flow

```
User → LoginForm → authClient.signIn.email()
                            │
                            ▼
                   ┌─────────────────┐
                   │ 1. Find user by │
                   │    email        │
                   └────────┬────────┘
                            │
               ┌────────────┴────────────┐
               │                         │
        User Not Found            User Found
               │                         │
               ▼                         ▼
      ┌─────────────────┐      ┌─────────────────┐
      │ Return error:   │      │ 2. Verify       │
      │ "No account     │      │    password     │
      │  exists..."     │      └────────┬────────┘
      └─────────────────┘               │
                              ┌─────────┴─────────┐
                              │                   │
                       Wrong Password      Correct Password
                              │                   │
                              ▼                   ▼
                    ┌─────────────────┐  ┌─────────────────┐
                    │ Return error:   │  │ 3. Create       │
                    │ "Incorrect      │  │    session      │
                    │  password"      │  └────────┬────────┘
                    └─────────────────┘           │
                                                  ▼
                                         Navigate to /dashboard
```

---

## Error Handling

The login form provides specific, user-friendly error messages for different authentication failures:

### Error Types & Messages

| Error Condition | User Message | Additional Action |
|-----------------|--------------|-------------------|
| **Email not found** | "No account exists for this email address." | Shows "Create an account" link |
| **Invalid credentials** | "Invalid email or password. Please check your credentials and try again." | Shows "Create an account" link |
| **Wrong password** | "Incorrect password. Please try again." | - |
| **Account locked** | "This account has been locked. Please contact support." | - |
| **Too many attempts** | "Too many login attempts. Please try again later." | - |
| **Email not verified** | "Please verify your email address before signing in." | - |
| **Generic/Unknown error** | "Failed to sign in. Please check your credentials and try again." | Shows "Create an account" link |

> **Note**: For security reasons, many authentication systems return generic "invalid credentials" errors rather than revealing whether an email exists. The login form handles this by showing the signup link for all credential-related errors, ensuring users can easily create an account if needed.

### Error Code Mapping

The `LoginForm` component includes a `getErrorMessage()` function that maps Better Auth error codes to user-friendly messages:

```typescript
// components/auth/login-form.tsx

function getErrorMessage(error: { code?: string; message?: string; status?: number }): {
  message: string;
  showSignupLink?: boolean;
} {
  // Log for debugging (visible in browser console)
  console.log('[Auth Error]', { code: error.code, message: error.message, status: error.status });

  const errorCode = (error.code || '').toLowerCase().replace(/_/g, ' ');
  const errorMessage = (error.message || '').toLowerCase();

  // User not found - email doesn't exist in database
  if (
    errorCode.includes('user not found') ||
    errorMessage.includes('user not found') ||
    errorMessage.includes('no account')
  ) {
    return {
      message: 'No account exists for this email address.',
      showSignupLink: true,
    };
  }

  // Invalid credentials - generic error (covers user not found + wrong password)
  if (
    errorCode.includes('invalid credentials') ||
    errorMessage.includes('invalid email or password')
  ) {
    return {
      message: 'Invalid email or password. Please check your credentials and try again.',
      showSignupLink: true,
    };
  }

  // Default: show signup link as fallback
  return {
    message: error.message || 'Failed to sign in. Please check your credentials and try again.',
    showSignupLink: true,
  };
}
```

### UI Treatment

When an error occurs, it's displayed in a styled alert box:

```tsx
{error && (
  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
    <p>{error.message}</p>
    {error.showSignupLink && (
      <p className="mt-2">
        <Link href="/signup">Create an account</Link> to get started.
      </p>
    )}
  </div>
)}
```

---

## Route Protection

The middleware protects routes based on the configured auth mode:

### Auth Modes

```typescript
// middleware.ts

const AUTH_MODE: "disabled" | "public-by-default" | "private-by-default" = "public-by-default";
```

| Mode | Behavior |
|------|----------|
| `disabled` | No route protection - all routes accessible |
| `public-by-default` | Only routes in `protectedRoutes` require auth |
| `private-by-default` | All routes require auth except `publicRoutes` |

### Protected Routes (default)

```typescript
const protectedRoutes = [
  "/dashboard",
  "/settings",
  "/account",
  "/admin",
];
```

### Public Routes

```typescript
const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/verify-email",
  "/accept-invite",
];
```

---

## Session Management

### Checking Session State

```typescript
import { useSession } from "@/lib/auth/client";

function MyComponent() {
  const { data: session, isPending, error } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not logged in</div>;

  return <div>Welcome, {session.user.email}</div>;
}
```

### Signing Out

```typescript
import { signOut } from "@/lib/auth/client";

async function handleSignOut() {
  await signOut();
  // Redirect handled automatically or manually
  window.location.href = "/";
}
```

---

## Troubleshooting

### "No account exists for this email address"

**Cause**: The email hasn't been registered.

**Fix**:
1. Click the "Create an account" link shown in the error
2. Or navigate to `/signup` to register

### "Incorrect password"

**Cause**: Wrong password entered.

**Fix**:
1. Try again with the correct password
2. Use "Forgot password" if available

### "Login redirects back to login page"

**Cause**: Session cookie not set or expired.

**Fix**:
1. Clear browser cookies for the site
2. Try logging in again
3. Check that `BETTER_AUTH_SECRET` is configured

### Protected routes accessible without login

**Cause**: Auth mode set to `disabled` or route not in `protectedRoutes`.

**Fix**:
1. Ensure `AUTH_MODE` is `"public-by-default"` or `"private-by-default"`
2. Add route to `protectedRoutes` array in `middleware.ts`

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/auth/client.ts` | Auth client configuration and exports |
| `lib/auth/index.ts` | Server-side Better Auth configuration |
| `lib/auth/permissions.ts` | Access control rules |
| `lib/auth/roles.ts` | Legal role definitions |
| `components/auth/login-form.tsx` | Login form with error handling |
| `components/auth/signup-form.tsx` | Signup form with validation |
| `middleware.ts` | Route protection |

---

## Environment Variables

```bash
# Required for production
BETTER_AUTH_SECRET=your-secret-key  # Generate: openssl rand -base64 32
BETTER_AUTH_URL=https://your-domain.com

# Database (required for auth persistence)
DATABASE_URL=postgresql://...

# Optional: OAuth providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

---

## Migrating to Production

When ready to deploy with real authentication:

1. **Set up a database** (Neon, Supabase, PlanetScale)
2. **Configure `BETTER_AUTH_SECRET`** - Generate a secure random string
3. **Set `BETTER_AUTH_URL`** to your production domain
4. **Update `AUTH_MODE`** to `"private-by-default"` if needed

See `skills/auth/SKILL.md` for complete Better Auth setup instructions.
