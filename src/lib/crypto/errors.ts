export type CryptoErrorCode =
  | 'invalid_code'
  | 'decrypt_failed'
  | 'wrong_passphrase'
  | 'weak_passphrase'
  | 'invalid_payload'
  | 'file_too_large'
  | 'malformed_file'

export class CryptoError extends Error {
  readonly code: CryptoErrorCode

  constructor(code: CryptoErrorCode, message: string) {
    super(message)
    this.name = 'CryptoError'
    this.code = code
  }
}
