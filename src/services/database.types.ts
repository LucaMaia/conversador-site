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
        }
        Insert: {
          access_hash: string
          admin_code_ct: string
          admin_code_iv: string
          created_by: string
        }
        Update: never
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
          sender_role: 'admin' | 'guest'
          ciphertext: string
          iv: string
          attachment_path: string | null
          created_at: string
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
      get_room_info: {
        Args: { p_room_id: string }
        Returns: { id: string; created_at: string; expires_at: string; server_now: string }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
