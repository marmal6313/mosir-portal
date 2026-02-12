export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      channel_departments: {
        Row: {
          channel_id: string
          department_id: number
          added_at: string | null
        }
        Insert: {
          channel_id: string
          department_id: number
          added_at?: string | null
        }
        Update: {
          channel_id?: string
          department_id?: number
          added_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_departments_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_message_mentions: {
        Row: {
          created_at: string | null
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          channel_id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          channel_id: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_channels: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_archived: boolean
          last_message_at: string | null
          name: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          name: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          name?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: number
          name: string
          whatsapp_group_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          whatsapp_group_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          whatsapp_group_id?: string | null
        }
        Relationships: []
      }
      kluby_wsparcie: {
        Row: {
          id: number
          kwota: number
          name: string
          year: number
        }
        Insert: {
          id?: never
          kwota: number
          name: string
          year: number
        }
        Update: {
          id?: never
          kwota?: number
          name?: string
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          sent_email: boolean | null
          sent_whatsapp: boolean | null
          task_id: string | null
          title: string
          type: string
          user_id: string | null
          action_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          sent_email?: boolean | null
          sent_whatsapp?: boolean | null
          task_id?: string | null
          title: string
          type: string
          user_id?: string | null
          action_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          sent_email?: boolean | null
          sent_whatsapp?: boolean | null
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
          action_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          color: string | null
          permissions: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          color?: string | null
          permissions?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          color?: string | null
          permissions?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      role_scopes: {
        Row: {
          id: string
          role_id: string
          resource: string
          scope: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          role_id: string
          resource: string
          scope: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          role_id?: string
          resource?: string
          scope?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_scopes_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      obiekty_wejscia: {
        Row: {
          id: number
          name: string
          wejscia: number
          year: number
        }
        Insert: {
          id?: never
          name: string
          wejscia: number
          year: number
        }
        Update: {
          id?: never
          name?: string
          wejscia?: number
          year?: number
        }
        Relationships: []
      }
      rezerwacje: {
        Row: {
          cena: number | null
          created_at: string
          czerwiec: number | null
          grudzien: number | null
          id: number
          korzystajacy: string
          kwiecien: number | null
          lipiec: number | null
          listopad: number | null
          lp: number | null
          luty: number | null
          maj: number | null
          marzec: number | null
          obiekt: string
          pazdziernik: number | null
          razem: number | null
          razem_kwota: number | null
          sierpien: number | null
          styczen: number | null
          wrzesien: number | null
        }
        Insert: {
          cena?: number | null
          created_at?: string
          czerwiec?: number | null
          grudzien?: number | null
          id?: number
          korzystajacy: string
          kwiecien?: number | null
          lipiec?: number | null
          listopad?: number | null
          lp?: number | null
          luty?: number | null
          maj?: number | null
          marzec?: number | null
          obiekt: string
          pazdziernik?: number | null
          razem?: number | null
          razem_kwota?: number | null
          sierpien?: number | null
          styczen?: number | null
          wrzesien?: number | null
        }
        Update: {
          cena?: number | null
          created_at?: string
          czerwiec?: number | null
          grudzien?: number | null
          id?: number
          korzystajacy?: string
          kwiecien?: number | null
          lipiec?: number | null
          listopad?: number | null
          lp?: number | null
          luty?: number | null
          maj?: number | null
          marzec?: number | null
          obiekt?: string
          pazdziernik?: number | null
          razem?: number | null
          razem_kwota?: number | null
          sierpien?: number | null
          styczen?: number | null
          wrzesien?: number | null
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          additional_comments: string | null
          age: string | null
          changing_room_accessibility: string | null
          contact_email: string | null
          created_at: string | null
          disability_type: Json | null
          entrance_accessibility: string | null
          id: number
          ip_address: unknown | null
          needed_equipment: Json | null
          pool_access: string | null
          renovation_priorities: Json | null
          safe_landing_opinion: string | null
          slide_extension_opinion: string | null
          slide_lift_opinion: string | null
          staff_prepared: string | null
          submitted_at: string | null
          suggestions: string | null
          swimming_lessons_interest: string | null
          therapy_pool_interest: string | null
          toilet_accessibility: string | null
          user_agent: string | null
        }
        Insert: {
          additional_comments?: string | null
          age?: string | null
          changing_room_accessibility?: string | null
          contact_email?: string | null
          created_at?: string | null
          disability_type?: Json | null
          entrance_accessibility?: string | null
          id?: number
          ip_address?: unknown | null
          needed_equipment?: Json | null
          pool_access?: string | null
          renovation_priorities?: Json | null
          safe_landing_opinion?: string | null
          slide_extension_opinion?: string | null
          slide_lift_opinion?: string | null
          staff_prepared?: string | null
          submitted_at?: string | null
          suggestions?: string | null
          swimming_lessons_interest?: string | null
          therapy_pool_interest?: string | null
          toilet_accessibility?: string | null
          user_agent?: string | null
        }
        Update: {
          additional_comments?: string | null
          age?: string | null
          changing_room_accessibility?: string | null
          contact_email?: string | null
          created_at?: string | null
          disability_type?: Json | null
          entrance_accessibility?: string | null
          id?: number
          ip_address?: unknown | null
          needed_equipment?: Json | null
          pool_access?: string | null
          renovation_priorities?: Json | null
          safe_landing_opinion?: string | null
          slide_extension_opinion?: string | null
          slide_lift_opinion?: string | null
          staff_prepared?: string | null
          submitted_at?: string | null
          suggestions?: string | null
          swimming_lessons_interest?: string | null
          therapy_pool_interest?: string | null
          toilet_accessibility?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      task_changes: {
        Row: {
          id: string
          task_id: string
          user_id: string
          changed_at: string
          old_description: string | null
          new_description: string | null
          old_status: string | null
          new_status: string | null
          old_due_date: string | null
          new_due_date: string | null
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          changed_at?: string
          old_description?: string | null
          new_description?: string | null
          old_status?: string | null
          new_status?: string | null
          old_due_date?: string | null
          new_due_date?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          changed_at?: string
          old_description?: string | null
          new_description?: string | null
          old_status?: string | null
          new_status?: string | null
          old_due_date?: string | null
          new_due_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_changes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          department_id: number | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          notes: string | null
          priority: string | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string | null
          week_number: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: number | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          week_number?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: number | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          week_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          created_at: string | null
          department_id: number | null
          email: string
          first_name: string
          id: string
          last_name: string
          manager_id: string | null
          phone: string | null
          position: string
          role: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          department_id?: number | null
          email: string
          first_name: string
          id?: string
          last_name: string
          manager_id?: string | null
          phone?: string | null
          position: string
          role?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          department_id?: number | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          manager_id?: string | null
          phone?: string | null
          position?: string
          role?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          average_completion_time: number | null
          completed_tasks: number | null
          completion_rate: number | null
          department_id: number | null
          generated_at: string | null
          id: string
          in_progress_tasks: number | null
          notes: string | null
          overdue_tasks: number | null
          total_tasks: number | null
          week_number: string
        }
        Insert: {
          average_completion_time?: number | null
          completed_tasks?: number | null
          completion_rate?: number | null
          department_id?: number | null
          generated_at?: string | null
          id?: string
          in_progress_tasks?: number | null
          notes?: string | null
          overdue_tasks?: number | null
          total_tasks?: number | null
          week_number: string
        }
        Update: {
          average_completion_time?: number | null
          completed_tasks?: number | null
          completion_rate?: number | null
          department_id?: number | null
          generated_at?: string | null
          id?: string
          in_progress_tasks?: number | null
          notes?: string | null
          overdue_tasks?: number | null
          total_tasks?: number | null
          week_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          id: string
          user_id: string
          department_id: number
          is_primary: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          department_id: number
          is_primary?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          department_id?: number
          is_primary?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          key: string
          value: string | null
          description: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          key: string
          value?: string | null
          description?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: string | null
          description?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wydarzenia_roczne: {
        Row: {
          created_at: string | null
          data: string
          id: number
          miejsce: string
          nazwa: string
          rok: number
          status: string
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: number
          miejsce: string
          nazwa: string
          rok: number
          status: string
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: number
          miejsce?: string
          nazwa?: string
          rok?: number
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      survey_analytics: {
        Row: {
          avg_entrance_score: number | null
          disability_breakdown: Json | null
          month: string | null
          slide_lift_supporters: number | null
          therapy_pool_interested: number | null
          total_responses: number | null
        }
        Relationships: []
      }
      tasks_with_details: {
        Row: {
          assigned_to: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          department_id: number | null
          department_name: string | null
          description: string | null
          due_date: string | null
          id: string | null
          priority: string | null
          start_date: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          week_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      users_with_details: {
        Row: {
          active: boolean | null
          department_id: number | null
          department_name: string | null
          department_ids: number[] | null
          department_names: string[] | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          last_name: string | null
          manager_name: string | null
          phone: string | null
          position: string | null
          role: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_department_ids: {
        Args: { p_user_id: string }
        Returns: number[]
      }
      get_department_stats: {
        Args: { dept_id: number; week_num: string }
        Returns: {
          total_tasks: number
          completed_tasks: number
          in_progress_tasks: number
          overdue_tasks: number
          completion_rate: number
        }[]
      }
      get_week_number: {
        Args: { date_input?: string }
        Returns: string
      }
      create_channel_message: {
        Args: {
          p_channel_id: string
          p_content: string
          p_mentions?: string[] | null
        }
        Returns: Database['public']['Tables']['channel_messages']['Row']
      }
      add_channel_member: {
        Args: {
          p_channel_id: string
          p_user_id: string
        }
        Returns: Database['public']['Tables']['channel_members']['Row']
      }
      remove_channel_member: {
        Args: {
          p_channel_id: string
          p_user_id: string
        }
        Returns: void
      }
      create_channel: {
        Args: {
          p_name: string
          p_description?: string | null
          p_visibility?: string | null
          p_departments?: number[] | null
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
