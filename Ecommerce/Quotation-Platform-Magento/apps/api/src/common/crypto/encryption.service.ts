import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Encrypts/decrypts secrets (connector credentials, e.g. Magento OAuth1
 * tokens) before they touch the database — they must never sit at rest as
 * plaintext.
 *
 * Uses AES-256-GCM with a key from ENCRYPTION_KEY (32 bytes, hex-encoded).
 * Output format: "<iv>:<authTag>:<ciphertext>", all hex, so it's a single
 * safely-storable string.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const keyHex = config.get<string>('app.encryptionKey');
    if (!keyHex || keyHex.length !== 64) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY must be set and be a 64-character hex string (32 bytes). ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
  }

  decrypt(payload: string): string {
    const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new InternalServerErrorException('Malformed encrypted payload');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
