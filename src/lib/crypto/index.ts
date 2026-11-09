export { CryptoError, type CryptoErrorCode } from './errors.ts'
export { generateInviteSecret, parseInviteCode, type InviteSecret } from './inviteCode.ts'
export { deriveRoomKeys, sha256Hex, type RoomKeys } from './keys.ts'
export { decryptMessage, encryptMessage, type EncryptedMessage } from './messageCipher.ts'
export { decryptFile, encryptFile, FILE_CHUNK_SIZE, MAX_FILE_BYTES } from './fileCipher.ts'
export {
  assertPassphraseStrength,
  MIN_PASSPHRASE_LENGTH,
  createVault,
  decryptInviteCode,
  decryptRoomLabel,
  encryptInviteCode,
  encryptRoomLabel,
  MAX_ROOM_LABEL_LENGTH,
  normalizeRoomLabel,
  type EncryptedRoomLabel,
  unlockVault,
  type EncryptedInviteCode,
  type VaultRecord,
} from './vault.ts'
