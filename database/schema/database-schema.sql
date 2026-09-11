-- CASEVAULT Relational Database Schema Specification (MySQL / MariaDB Compatible)
-- Engine: InnoDB | Character Set: utf8mb4
-- STRICT SECURITY: Passwords, OTPs, and Reset Tokens are stored strictly as cryptographic hashes.

CREATE DATABASE IF NOT EXISTS casevault_db;
USE casevault_db;

-- 1. Officers & System Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    officer_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    rank VARCHAR(100) NOT NULL DEFAULT 'Police Officer',
    police_station VARCHAR(150) NOT NULL,
    district VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    password_salt VARCHAR(64) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'police_officer',
    role_label VARCHAR(100) NOT NULL DEFAULT 'Police Officer',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    avatar VARCHAR(10) DEFAULT '👮',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_officer_id (officer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Criminal Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(50) PRIMARY KEY,
    fir_number VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    case_type VARCHAR(100) NOT NULL,
    police_station VARCHAR(150) NOT NULL,
    investigating_officer VARCHAR(150) NOT NULL,
    officer_rank VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Investigation',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    description TEXT NULL,
    incident_date DATE NOT NULL,
    created_date DATE NOT NULL,
    last_updated DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_case_fir (fir_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Case Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    doc_type VARCHAR(100) NOT NULL,
    file_size VARCHAR(50) NOT NULL,
    uploaded_by VARCHAR(150) NOT NULL,
    uploaded_date DATE NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    blockchain_tx VARCHAR(100) NOT NULL,
    content LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    INDEX idx_doc_case (case_id),
    INDEX idx_doc_sha256 (sha256_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Security Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id VARCHAR(50) NOT NULL UNIQUE,
    timestamp DATETIME NOT NULL,
    officer VARCHAR(150) NOT NULL,
    badge_number VARCHAR(100) NULL,
    action VARCHAR(100) NOT NULL,
    action_badge VARCHAR(50) DEFAULT 'INFO',
    details TEXT NOT NULL,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


