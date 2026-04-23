-- ============================================
-- AI DESIGN DATABASE INITIALIZATION
-- ============================================

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS db_ts;
USE db_ts;

-- ============================================
-- TABLA: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  verified ENUM('pending', 'true', 'expired') DEFAULT 'pending' NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: tokens
-- ============================================
CREATE TABLE IF NOT EXISTS tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  type ENUM('email_verification', 'password_reset', 'account_recovery') DEFAULT 'email_verification' NOT NULL,
  state ENUM('pending', 'used', 'expired') DEFAULT 'pending' NOT NULL,
  expiresAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_users FOREIGN KEY (userId) REFERENCES users(uuid) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_token_type (userId, type),
  INDEX idx_token_state (state),
  INDEX idx_token_expires (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: designs
-- ============================================
CREATE TABLE IF NOT EXISTS designs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  userId VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('active', 'completed', 'archived', 'deleted') DEFAULT 'active' NOT NULL,
  type ENUM('2d', '3d', 'both') DEFAULT '2d' NOT NULL,
  metadata JSON,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_designs_users FOREIGN KEY (userId) REFERENCES users(uuid) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: messages
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  designId VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending' NOT NULL,
  metadata JSON,
  processingTime INT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_designs FOREIGN KEY (designId) REFERENCES designs(uuid) ON DELETE CASCADE,
  INDEX idx_designId (designId),
  INDEX idx_role (role),
  INDEX idx_status (status),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: design_files
-- ============================================
CREATE TABLE IF NOT EXISTS design_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  designId VARCHAR(36) NOT NULL,
  messageId VARCHAR(36),
  filename VARCHAR(255) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  fileType ENUM('image', 'pdf', 'dwg', 'dxf', 'skp', 'obj', 'fbx', 'gltf', 'json', 'mtl', 'svg', 'stl') NOT NULL,
  fileSize INT NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  downloadUrl VARCHAR(500),
  status ENUM('generating', 'ready', 'error', 'deleted') DEFAULT 'generating' NOT NULL,
  downloadCount INT DEFAULT 0 NOT NULL,
  lastDownloadAt DATETIME,
  metadata JSON,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_design_files_designs FOREIGN KEY (designId) REFERENCES designs(uuid) ON DELETE CASCADE,
  CONSTRAINT fk_design_files_messages FOREIGN KEY (messageId) REFERENCES messages(uuid) ON DELETE SET NULL,
  INDEX idx_designId (designId),
  INDEX idx_messageId (messageId),
  INDEX idx_fileType (fileType),
  INDEX idx_status (status),
  INDEX idx_downloadCount (downloadCount),
  INDEX idx_lastDownloadAt (lastDownloadAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Sessions (para express-session)
-- ============================================
CREATE TABLE IF NOT EXISTS Sessions (
  sid VARCHAR(255) NOT NULL PRIMARY KEY,
  expires DATETIME,
  data LONGTEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
