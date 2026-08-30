/**
 * Class-name joiner.
 *
 * Lives in its own module with no `'use client'` directive so both server and
 * client components can call it. A plain function exported from a client
 * module cannot be invoked during a server render — only components can cross
 * that boundary — so keeping this separate avoids an entire class of error.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
