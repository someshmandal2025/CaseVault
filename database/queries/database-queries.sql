-- CASEVAULT Common Database Queries Reference

-- 1. Fetch Officer User Credentials by Email
SELECT id, officer_id, name, rank, police_station, email, password_hash, password_salt 
FROM users 
WHERE email = ?;

-- 2. Fetch Active Case Details with Document Summary
SELECT c.*, COUNT(d.id) AS verified_docs 
FROM cases c 
LEFT JOIN documents d ON c.id = d.case_id 
WHERE c.id = ? 
GROUP BY c.id;

-- 3. Insert New Security Audit Log Entry
INSERT INTO audit_logs (log_id, timestamp, officer, badge_number, action, action_badge, details, ip_address) 
VALUES (?, NOW(), ?, ?, ?, ?, ?, ?);

-- 4. Update Officer Password Hash (Argon2id / PBKDF2 HMAC-SHA256)
UPDATE users
SET password_hash = ?,
    password_salt = ?,
    updated_at = NOW()
WHERE email = ?;
