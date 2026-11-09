import type { RoomServerStatus } from '../domain/rooms.ts'
import {
  decryptInviteCode,
  decryptRoomLabel,
  deriveRoomKeys,
  encryptInviteCode,
  encryptRoomLabel,
  generateInviteSecret,
  normalizeRoomLabel,
  type EncryptedInviteCode,
  type EncryptedRoomLabel,
} from '../lib/crypto/index.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export interface AdminRoom {
  readonly id: string
  readonly accessHash: string
  readonly encryptedCode: EncryptedInviteCode
  /** Nome decifrado no navegador (null = sem nome ou ilegível). */
  readonly label: string | null
  readonly createdAt: Date
  readonly expiresAt: Date
  readonly status: RoomServerStatus
  readonly hasGuest: boolean
}

const ROOM_COLUMNS =
  'id, access_hash, admin_code_ct, admin_code_iv, admin_label_ct, admin_label_iv, created_at, expires_at, status'

interface RoomRow {
  id: string
  access_hash: string
  admin_code_ct: string
  admin_code_iv: string
  admin_label_ct: string | null
  admin_label_iv: string | null
  created_at: string
  expires_at: string
  status: RoomServerStatus
}

async function readLabel(masterKey: CryptoKey, row: RoomRow): Promise<string | null> {
  if (!row.admin_label_ct || !row.admin_label_iv) return null
  try {
    return await decryptRoomLabel(masterKey, row.access_hash, {
      admin_label_ct: row.admin_label_ct,
      admin_label_iv: row.admin_label_iv,
    })
  } catch {
    return null
  }
}

async function toAdminRoom(masterKey: CryptoKey, row: RoomRow, guestRoomIds: ReadonlySet<string>): Promise<AdminRoom> {
  return {
    id: row.id,
    accessHash: row.access_hash,
    encryptedCode: { admin_code_ct: row.admin_code_ct, admin_code_iv: row.admin_code_iv },
    label: await readLabel(masterKey, row),
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    status: row.status,
    hasGuest: guestRoomIds.has(row.id),
  }
}

async function labelColumns(
  masterKey: CryptoKey,
  accessHash: string,
  label: string,
): Promise<EncryptedRoomLabel | { admin_label_ct: null; admin_label_iv: null }> {
  const normalized = normalizeRoomLabel(label)
  if (!normalized) return { admin_label_ct: null, admin_label_iv: null }
  return encryptRoomLabel(masterKey, accessHash, normalized)
}

export async function listRooms(masterKey: CryptoKey): Promise<AdminRoom[]> {
  const [rooms, members] = await Promise.all([
    supabase.from('rooms').select(ROOM_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('room_members').select('room_id'),
  ])
  if (rooms.error) throw new ServiceError('Não foi possível listar as conversas.', { cause: rooms.error })
  if (members.error) throw new ServiceError('Não foi possível listar as conversas.', { cause: members.error })

  const guestRoomIds = new Set(members.data.map((m) => m.room_id))
  return Promise.all(rooms.data.map((row) => toAdminRoom(masterKey, row, guestRoomIds)))
}

/**
 * Cria uma sala. O código é gerado no navegador; o servidor recebe apenas
 * o hash do token de acesso, o código e o nome cifrados pela master key.
 */
export async function createRoom(
  adminUserId: string,
  masterKey: CryptoKey,
  label: string,
): Promise<{ room: AdminRoom; code: string }> {
  const invite = generateInviteSecret()
  const { accessHash } = await deriveRoomKeys(invite.bytes)
  const encryptedCode = await encryptInviteCode(masterKey, accessHash, invite.code)
  const encryptedLabel = await labelColumns(masterKey, accessHash, label)

  const { data, error } = await supabase
    .from('rooms')
    .insert({ access_hash: accessHash, created_by: adminUserId, ...encryptedCode, ...encryptedLabel })
    .select(ROOM_COLUMNS)
    .single()
  if (error) throw new ServiceError('Não foi possível criar a conversa.', { cause: error })

  return { room: await toAdminRoom(masterKey, data, new Set()), code: invite.code }
}

/** Define ou remove (texto vazio) o nome da conversa. */
export async function renameRoom(room: AdminRoom, masterKey: CryptoKey, label: string): Promise<string | null> {
  const columns = await labelColumns(masterKey, room.accessHash, label)
  const { data, error } = await supabase.from('rooms').update(columns).eq('id', room.id).select('id')
  if (error || data.length === 0) {
    throw new ServiceError('Não foi possível renomear a conversa.', { cause: error })
  }
  return normalizeRoomLabel(label)
}

export async function revealInviteCode(room: AdminRoom, masterKey: CryptoKey): Promise<string> {
  return decryptInviteCode(masterKey, room.accessHash, room.encryptedCode)
}

/** Exclusão imediata, executada pela Edge Function delete-room. */
export async function deleteRoom(roomId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ deleted: boolean }>('delete-room', {
    body: { room_id: roomId },
  })
  if (error || !data?.deleted) {
    throw new ServiceError('Não foi possível excluir a conversa.', { cause: error })
  }
}
