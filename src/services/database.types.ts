// Tipos do schema (espelham supabase/migrations). Quando o CLI estiver
// vinculado ao projeto, podem ser regenerados com:
//   supabase gen types typescript --project-id <ref> > src/services/database.types.ts

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: { user_id: string; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      admin_vault: {
        Row: {
          user_id: string
          kdf_salt: string
          kdf_iterations: number
          wrapped_master_key: string
          wrap_iv: string
          created_at: string
        }
        Insert: {
          user_id: string
          kdf_salt: string
          kdf_iterations: number
          wrapped_master_key: string
          wrap_iv: string
        }
        Update: never
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          access_hash: string
          admin_code_ct: string
          admin_code_iv: string
          created_by: string
          created_at: string
          expires_at: string
          status: 'active' | 'purging'
          admin_label_ct: string | null
          admin_label_iv: string | null
          admin_last_read_at: string
        }
        Insert: {
          access_hash: string
          admin_code_ct: string
          admin_code_iv: string
          created_by: string
          admin_label_ct?: string | null
          admin_label_iv?: string | null
        }
        Update: {
          admin_label_ct?: string | null
          admin_label_iv?: string | null
        }
        Relationships: []
      }
      room_members: {
        Row: { room_id: string; user_id: string; role: 'guest'; joined_at: string }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'room_members_room_id_fkey'
            columns: ['room_id']
            isOneToOne: true
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          id: string
          room_id: string
          sender_id: string
          sender_role: 'admin' | 'guest' | 'system'
          ciphertext: string | null
          iv: string | null
          attachment_path: string | null
          created_at: string
          system_template: string | null
          media_viewed_at: string | null
          media_expires_at: string | null
          media_purged: boolean
        }
        Insert: {
          id: string
          room_id: string
          ciphertext: string
          iv: string
          attachment_path?: string | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      server_now: { Args: Record<PropertyKey, never>; Returns: string }
      admin_room_activity: {
        Args: Record<PropertyKey, never>
        Returns: { room_id: string; unread: number; last_message_at: string | null }[]
      }
      mark_room_read: { Args: { p_room_id: string }; Returns: undefined }
      mark_media_viewed: { Args: { p_message_id: string }; Returns: string | null }
      get_room_info: {
        Args: { p_room_id: string }
        Returns: { id: string; created_at: string; expires_at: string; server_now: string }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
