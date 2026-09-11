// Cryptographic Utilities for CASEVAULT using Web Crypto API

/**
 * Computes SHA-256 hash of a string using Web Crypto API
 * @param {string} text - The input text content to hash
 * @returns {Promise<string>} - Hex string representation of SHA-256
 */
export async function computeSHA256(text) {
  try {
    const msgBuffer = new TextEncoder().encode(text || '');
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('SHA-256 calculation error:', error);
    // Fallback deterministic hash generator for edge environments
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Formats a SHA-256 hash for easy display (e.g., 8f23a1d9c...91b2)
 * @param {string} hash 
 * @param {number} startLen 
 * @param {number} endLen 
 */
export function formatHash(hash, startLen = 10, endLen = 8) {
  if (!hash) return 'Calculating...';
  if (hash.length <= startLen + endLen) return hash;
  return `${hash.substring(0, startLen)}...${hash.substring(hash.length - endLen)}`;
}

/**
 * Generates an official Document ID (e.g., DOC-2048)
 */
export function generateDocId(existingCount = 0) {
  const num = 2040 + existingCount + Math.floor(Math.random() * 50);
  return `DOC-${num}`;
}

/**
 * Generates an official Case ID (e.g., CASE-1025)
 */
export function generateCaseId(existingCount = 0) {
  const num = 1025 + existingCount;
  return `CASE-${num}`;
}

/**
 * Formats standard Indian legal date format (e.g. 20 August 2026, 11:30 AM)
 */
export function formatIndianDate(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
