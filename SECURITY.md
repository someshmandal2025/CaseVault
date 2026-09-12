# CASEVAULT — Security Architecture & Protections

## Executive Summary
CASEVAULT is a government-grade digital case document and evidence management system designed for law enforcement agencies. Security, access control, file integrity, and auditability are enforced strictly at the Django REST Framework backend layer.

---

## 1. Security Architecture & System Boundaries

```
React SPA (Vite)
       │ (REST APIs with Auth Cookies / Session Headers)
       ▼
Django REST API (Authoritative Security Gate & Boundary)
 ┌─────┴─────────────────────┬───────────────────────────┐
 ▼                           ▼                           ▼
SQLite Database        MongoDB Store               Secure Media Storage
(Users, Passwords,     (Cases, Documents,          (Encrypted Binary Files,
Auth, Sessions, OTP)   Evidence, Audit Logs)       FIR Uploads, Media)
```

- **React SPA**: Operates strictly as a presentation layer. React never connects directly to SQLite or MongoDB, and client-side UI states are never trusted for authorization decisions.
- **Django REST Backend**: Serves as the sole authoritative enforcement boundary for authentication, RBAC, object-level authorization (IDOR protection), input validation, rate limiting, and cryptographic audit hashing.

---

## 2. Authentication & Brute-Force Rate Limiting
- **Authoritative Credentials**: User accounts and hashed passwords reside exclusively in Django's SQLite database (`AUTH_USER_MODEL = 'authentication.User'`). Passwords use Django's PBKDF2 algorithm.
- **Account Status Validation**: Disabled accounts (`status = 'Disabled'`) are rejected by authentication handlers with `403 Forbidden` (`ACCOUNT_DISABLED`).
- **Brute-Force Protection**: Server-side rate limiting (`check_rate_limit`) throttles failed login, OTP, and password-reset attempts to 10 requests per minute per IP/identifier. Exceeding limits returns `429 Too Many Requests` (`TOO_MANY_REQUESTS`) and logs a `RATE_LIMIT_TRIGGERED` audit event.
- **Single-Use OTP & Expiry**: Password reset OTPs are cryptographically generated, hashed before storage, valid for 10 minutes, single-use, and throttled by a 60-second resend cooldown.

---

## 3. RBAC Matrix & Category/Rank Hierarchy

| Category | Permitted Ranks | Access Level |
| :--- | :--- | :--- |
| **OFFICER** | Constable, Head Constable, ASI, SI | Create/view assigned cases, documents, & evidence |
| **SENIOR OFFICER** | Inspector, ACP / DSP, Addl. SP, SP / SSP, DIG, IG, ADGP, DGP | Departmental oversight, custody transfers, audit verification |
| **LEGAL OFFICER** | Legal Officer, Public Prosecutor, Legal Advisor, Law Officer | Case & document review for legal proceedings |
| **ADMINISTRATOR** | System Administrator, Administrative Officer, Department Administrator, IT / System Manager | Officer lifecycle management, full audit access & chain verification |

- Backend serializers validate Category and Rank combinations (`VALID_ROLE_RANKS`). Role escalation attempts (e.g. non-admin attempting to set `role = 'ADMINISTRATOR'`) are rejected with `403 Forbidden`.

---

## 4. IDOR (Insecure Direct Object Reference) Protection
- **Object-Level Authorization**: Every endpoint accepting `case_id`, `document_id`, `evidence_id`, or `audit_id` evaluates user permissions against the target object via `check_case_access_permission()`.
- **Enforcement**: Non-admin officers are denied access (`403 Forbidden`) if they are not the creator, assigned investigator, or department officer for the case.
- **Audit Logging**: Unauthorized access attempts are recorded as `UNAUTHORIZED_ACCESS_ATTEMPT` audit events.

---

## 5. File Upload & Secure Download Protection
- **File Size Validation**: Maximum upload size is strictly limited to 25 MB (`MAX_UPLOAD_SIZE_BYTES = 26214400`). Oversized uploads return `413 Payload Too Large`.
- **Extension Blacklisting**: Dangerous script and executable extensions (`.exe`, `.sh`, `.php`, `.py`, `.js`, `.bat`, `.vbs`, `.cmd`, `.msi`, `.ps1`, `.dll`, `.jar`, `.html`, `.htm`) are rejected with `400 Bad Request`.
- **Protected File Downloads**: Uploaded files are stored in `secure_media/` outside the public web root. Direct URL file browsing is prohibited. Files are served exclusively through `GET /api/documents/{document_id}/download/` after verifying authentication and case permissions, logging `DOCUMENT_DOWNLOADED`.

---

## 6. Cryptographic Hash Integrity & Audit Chains
- **Document SHA-256**: Calculated from raw file byte streams (`hashlib.sha256(file.read()).hexdigest()`) upon upload. `/api/documents/{document_id}/verify/` recalculates the checksum live to detect file tampering.
- **Tamper-Evident SHA-256 Audit Chain**: Every audit record embeds `previous_hash` and `record_hash`. The initial record links to `GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"`.
- **Chain Verification**: `/api/audit/verify/` recalculates the hash chain from genesis to latest record, identifying tampered or missing entries.

---

## 7. MongoDB Query Injection Prevention
- **Parameter Coercion**: All query filter parameters (`sanitize_mongo_param()`) strip PyMongo dictionary operators (`$gt`, `$where`, `$regex` injection objects) and force primitive string types before executing MongoDB queries.

---

## 8. Secrets & Environment Configuration
- Sensitive keys (`SECRET_KEY`, SMTP passwords, database URIs) are loaded from `.env`.
- `.env` files are explicitly excluded in `.gitignore`.
- Production security headers are enabled (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `SECURE_BROWSER_XSS_FILTER: True`).
