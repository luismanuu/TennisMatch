export const VERIFY_EMAIL_PAGE = '/sign-up/verify-email-address'

// Only same-origin paths; anything else (absolute URLs, protocol-relative, backslash tricks) falls back.
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }
  return value
}

export function invitationPath(token: string): string {
  return `/invitation/${encodeURIComponent(token)}`
}

// Where Better Auth sends the user after they click the verification link.
// An invitation sign-up must land back on its invitation so it gets accepted.
export function verificationCallback(invitationToken?: string | null): string {
  return invitationToken ? invitationPath(invitationToken) : `${VERIFY_EMAIL_PAGE}?verified=1`
}
