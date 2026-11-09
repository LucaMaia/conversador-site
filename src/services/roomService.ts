import type { RoomServerStatus } from '../domain/rooms.ts'
import {
  decryptInviteCode,
  deriveRoomKeys,
  encryptInviteCode,
  generateInviteSecret,
  type EncryptedInviteCode,
} from '../lib/crypto/index.ts'
import { ServiceError } from './errors.ts'
import { supabase } from './supabaseClient.ts'

export interface AdminRoom {
  readonly id: string
  readonly accessHash: string
  readonly encryptedCode: EncryptedInviteCode
  readonly createdAt: Date
  readonly expiresAt: Date
  readonly status: RoomServerStatus
  readonly hasGuest: boolean
}

const ROOM_COLUMNS = 'id, access_hash, admin_code_ct, admin_code_iv, created_at, expires_at, status'

interface RoomRow {
  id: string
  access_hash: string
  admin_code_ct: string
  admin_code_iv: string
  created_at: string
  expires_at: string
  status: RoomServerStatus
}

function toAdminRoom(row: RoomRow, guestRoomIds: ReadonlySet<string>): AdminRoom {
  return {
    id: row.id,
    accessHash: row.access_hash,
    encryptedCode: { admin_code_ct: row.admin_code_ct, admin_code_iv: row.admin_code_iv },
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    status: row.status,
    hasGuest: guestRoomIds.has(row.id),
  }
}

export async function listRooms(): Promise<AdminRoom[]> {
  const [rooms, members] = await Promise.all([
    supabase.from('rooms').select(ROOM_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('room_members').select('room_id'),
  ])
  if (rooms.error) throw new ServiceError('Não foi possível listar as conversas.', { cause: rooms.error })
  if (members.error) throw new ServiceError('Não foi possível listar as conversas.', { cause: members.error })

  const guestRoomIds = new Set(members.data.map((m) => m.room_id))
  return rooms.data.map((row) => toAdminRoom(row, guestRoomIds))
}

/**
 * Cria uma sala. O código é gerado no navegador; o servidor recebe apenas
 * o hash do token de acesso e o código cifrado pela master key do cofre.
 */
export async function createRoom(
  adminUserId: string,
  masterKey: CryptoKey,
): Promise<{ room: AdminRoom; code: string }> {
  const invite = generateInviteSecret()
  const { accessHash } = await deriveRoomKeys(invite.bytes)
  const encryptedCode = await encryptInviteCode(masterKey, accessHash, invite.code)

  const { data, error } = await supabase
    .from('rooms')
    .insert({ access_hash: accessHash, created_by: adminUserId, ...encryptedCode })
    .select(ROOM_COLUMNS)
    .single()
  if (error) throw new ServiceError('Não foi possível criar a conversa.', { cause: error })

  return { room: toAdminRoom(data, new Set()), code: invite.code }
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
