// CASEVAULT Personal Security & Password Authentication Service
// Officer password establishment and cryptographic strength verification (No OTP)

/**
 * Validates password complexity requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*(),.?":{}|<>)
 */
export function checkPasswordStrength(password) {
  const checks = {
    length: (password || '').length >= 8,
    upper: /[A-Z]/.test(password || ''),
    lower: /[a-z]/.test(password || ''),
    number: /[0-9]/.test(password || ''),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password || '')
  };

  const score = Object.values(checks).filter(Boolean).length;
  let label = 'Weak';
  let color = 'bg-red-500';

  if (score === 5) {
    label = 'Strong';
    color = 'bg-emerald-500';
  } else if (score >= 3) {
    label = 'Good';
    color = 'bg-[#0052cc]';
  } else if (score >= 2) {
    label = 'Fair';
    color = 'bg-amber-500';
  }

  return {
    isValid: score === 5,
    checks,
    score,
    label,
    color
  };
}

/**
 * Computes a PBKDF2 SHA-256 hash using the Web Crypto API.
 * Uses 10,000 iterations and a 16-byte random salt.
 */
export async function hashPasswordPbkdf2(password, saltHex = null) {
  const encoder = new TextEncoder();
  const salt = saltHex 
    ? new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => Number.parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const finalSaltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    hash: hashHex,
    salt: finalSaltHex
  };
}

/**
 * Establish officer CASEVAULT account password (Step 2 Personal Security)
 * Cryptographically validates and prepares password credentials.
 */
export async function setAccountPassword(officerId, password, confirmPassword, officerDetails = {}) {
  if (!officerId || !password || !confirmPassword) {
    return {
      success: false,
      message: 'Please enter and confirm your CASEVAULT password.'
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      message: 'Passwords do not match. Please re-enter.'
    };
  }

  const strength = checkPasswordStrength(password);
  if (!strength.isValid) {
    return {
      success: false,
      message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
    };
  }

  try {
    const { hash, salt } = await hashPasswordPbkdf2(password);

    return {
      success: true,
      message: 'CASEVAULT Password established successfully.',
      passwordHash: hash,
      passwordSalt: salt,
      officerId,
      ...officerDetails
    };
  } catch (err) {
    console.error('[CASEVAULT Password Security] Hash failed:', err);
    return {
      success: false,
      message: 'Unable to establish password. Please try again.'
    };
  }
}
