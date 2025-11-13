// 简单的加密工具类
// 使用Web Crypto API进行加密
export class CryptoUtil {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
  }

  // 生成密钥（基于用户密码）
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 加密数据
  async encrypt(data, password) {
    try {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const key = await this.deriveKey(password, salt);
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encoder.encode(JSON.stringify(data))
      );

      // 组合 salt + iv + 加密数据
      const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

      // 转换为 base64
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error('加密失败');
    }
  }

  // 解密数据
  async decrypt(encryptedBase64, password) {
    try {
      const combined = this.base64ToArrayBuffer(encryptedBase64);
      
      // 提取 salt, iv 和加密数据
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encryptedData = combined.slice(28);

      const key = await this.deriveKey(password, salt);

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decryptedData));
    } catch (error) {
      console.error('解密失败:', error);
      throw new Error('解密失败，密码可能不正确');
    }
  }

  // 辅助方法：ArrayBuffer 转 Base64
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // 辅助方法：Base64 转 ArrayBuffer
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // 生成随机密码
  generatePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const values = crypto.getRandomValues(new Uint8Array(length));
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[values[i] % charset.length];
    }
    return password;
  }

  // 哈希密码（用于验证）
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.arrayBufferToBase64(hashBuffer);
  }
}

// 安全存储管理器
export class SecureStorage {
  constructor() {
    this.crypto = new CryptoUtil();
    this.passwordKey = 'ai-toolbox-password-hash';
    this.encryptedDataKey = 'ai-toolbox-encrypted-data';
    this.isUnlocked = false;
    this.currentPassword = null;
  }

  // 检查是否已设置密码
  hasPassword() {
    return localStorage.getItem(this.passwordKey) !== null;
  }

  // 设置密码
  async setPassword(password) {
    try {
      const hash = await this.crypto.hashPassword(password);
      localStorage.setItem(this.passwordKey, hash);
      this.currentPassword = password;
      this.isUnlocked = true;
      return true;
    } catch (error) {
      console.error('设置密码失败:', error);
      return false;
    }
  }

  // 验证密码
  async verifyPassword(password) {
    try {
      const hash = await this.crypto.hashPassword(password);
      const storedHash = localStorage.getItem(this.passwordKey);
      const isValid = hash === storedHash;
      
      if (isValid) {
        this.currentPassword = password;
        this.isUnlocked = true;
      }
      
      return isValid;
    } catch (error) {
      console.error('验证密码失败:', error);
      return false;
    }
  }

  // 保存加密数据
  async saveEncrypted(key, data) {
    if (!this.isUnlocked || !this.currentPassword) {
      throw new Error('请先解锁');
    }

    try {
      // 获取现有加密数据
      let allData = {};
      const encrypted = localStorage.getItem(this.encryptedDataKey);
      if (encrypted) {
        allData = await this.crypto.decrypt(encrypted, this.currentPassword);
      }

      // 更新数据
      allData[key] = data;

      // 重新加密并保存
      const newEncrypted = await this.crypto.encrypt(allData, this.currentPassword);
      localStorage.setItem(this.encryptedDataKey, newEncrypted);
      
      return true;
    } catch (error) {
      console.error('保存加密数据失败:', error);
      throw error;
    }
  }

  // 读取加密数据
  async loadEncrypted(key) {
    if (!this.isUnlocked || !this.currentPassword) {
      throw new Error('请先解锁');
    }

    try {
      const encrypted = localStorage.getItem(this.encryptedDataKey);
      if (!encrypted) return null;

      const allData = await this.crypto.decrypt(encrypted, this.currentPassword);
      return allData[key] || null;
    } catch (error) {
      console.error('读取加密数据失败:', error);
      throw error;
    }
  }

  // 读取所有加密数据
  async loadAllEncrypted() {
    if (!this.isUnlocked || !this.currentPassword) {
      throw new Error('请先解锁');
    }

    try {
      const encrypted = localStorage.getItem(this.encryptedDataKey);
      if (!encrypted) return {};

      return await this.crypto.decrypt(encrypted, this.currentPassword);
    } catch (error) {
      console.error('读取所有加密数据失败:', error);
      throw error;
    }
  }

  // 删除加密数据中的某个键
  async deleteEncrypted(key) {
    if (!this.isUnlocked || !this.currentPassword) {
      throw new Error('请先解锁');
    }

    try {
      const encrypted = localStorage.getItem(this.encryptedDataKey);
      if (!encrypted) return true;

      const allData = await this.crypto.decrypt(encrypted, this.currentPassword);
      delete allData[key];

      const newEncrypted = await this.crypto.encrypt(allData, this.currentPassword);
      localStorage.setItem(this.encryptedDataKey, newEncrypted);
      
      return true;
    } catch (error) {
      console.error('删除加密数据失败:', error);
      throw error;
    }
  }

  // 锁定
  lock() {
    this.isUnlocked = false;
    this.currentPassword = null;
  }

  // 更改密码
  async changePassword(oldPassword, newPassword) {
    try {
      // 验证旧密码
      const isValid = await this.verifyPassword(oldPassword);
      if (!isValid) {
        throw new Error('旧密码不正确');
      }

      // 读取所有数据
      const allData = await this.loadAllEncrypted();

      // 设置新密码
      await this.setPassword(newPassword);

      // 用新密码重新加密数据
      const newEncrypted = await this.crypto.encrypt(allData, newPassword);
      localStorage.setItem(this.encryptedDataKey, newEncrypted);

      return true;
    } catch (error) {
      console.error('更改密码失败:', error);
      throw error;
    }
  }

  // 重置（删除所有加密数据和密码）
  reset() {
    localStorage.removeItem(this.passwordKey);
    localStorage.removeItem(this.encryptedDataKey);
    this.isUnlocked = false;
    this.currentPassword = null;
  }
}