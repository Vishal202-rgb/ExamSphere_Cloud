import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Decode JWT token payload safely in the browser without external libraries
 * @param {string} token
 * @returns {object|null}
 */
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if a token or decoded payload is expired
 * @param {string|object} tokenOrDecoded
 * @returns {boolean}
 */
export function isTokenExpired(tokenOrDecoded) {
  if (!tokenOrDecoded) return true;
  const decoded = typeof tokenOrDecoded === 'string' ? decodeToken(tokenOrDecoded) : tokenOrDecoded;
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 <= Date.now();
}
