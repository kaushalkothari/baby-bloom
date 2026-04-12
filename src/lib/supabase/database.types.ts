/**
 * Supabase public schema (snake_case) — keep in sync with supabase/migrations.
 * Used for typed client; app domain types stay in @/types (camelCase).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      children: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          date_of_birth: string;
          gender: string;
          blood_group: string | null;
          photo_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          date_of_birth: string;
          gender: string;
          blood_group?: string | null;
          photo_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          date_of_birth?: string;
          gender?: string;
          blood_group?: string | null;
          photo_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hospital_visits: {
        Row: {
          id: string;
          child_id: string;
          visit_date: string;
          hospital_name: string;
          doctor_name: string;
          reason: string;
          description: string;
          weight_kg: number | null;
          height_cm: number | null;
          head_circumference_cm: number | null;
          temperature_f: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          visit_date: string;
          hospital_name: string;
          doctor_name?: string;
          reason: string;
          description?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          head_circumference_cm?: number | null;
          temperature_f?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          visit_date?: string;
          hospital_name?: string;
          doctor_name?: string;
          reason?: string;
          description?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          head_circumference_cm?: number | null;
          temperature_f?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vaccinations: {
        Row: {
          id: string;
          child_id: string;
          vaccine_name: string;
          due_date: string;
          completed_date: string | null;
          batch_number: string | null;
          expiry_date: string | null;
          administered_by: string | null;
          location: string | null;
          notes: string | null;
          card_photo_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          vaccine_name: string;
          due_date: string;
          completed_date?: string | null;
          batch_number?: string | null;
          expiry_date?: string | null;
          administered_by?: string | null;
          location?: string | null;
          notes?: string | null;
          card_photo_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          vaccine_name?: string;
          due_date?: string;
          completed_date?: string | null;
          batch_number?: string | null;
          expiry_date?: string | null;
          administered_by?: string | null;
          location?: string | null;
          notes?: string | null;
          card_photo_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prescriptions: {
        Row: {
          id: string;
          child_id: string;
          visit_id: string | null;
          medicine_name: string | null;
          dosage: string | null;
          frequency: string | null;
          duration: string | null;
          prescribing_doctor: string;
          prescription_date: string;
          active: boolean;
          notes: string | null;
          prescription_image_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          visit_id?: string | null;
          medicine_name?: string | null;
          dosage?: string | null;
          frequency?: string | null;
          duration?: string | null;
          prescribing_doctor?: string;
          prescription_date: string;
          active?: boolean;
          notes?: string | null;
          prescription_image_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          visit_id?: string | null;
          medicine_name?: string | null;
          dosage?: string | null;
          frequency?: string | null;
          duration?: string | null;
          prescribing_doctor?: string;
          prescription_date?: string;
          active?: boolean;
          notes?: string | null;
          prescription_image_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prescription_medicines_prescription_id_fkey';
            columns: [];
            isOneToOne: false;
            referencedRelation: 'prescription_medicines';
            referencedColumns: ['prescription_id'];
          },
        ];
      };
      prescription_medicines: {
        Row: {
          id: string;
          prescription_id: string;
          name: string;
          dosage: string;
          frequency: string;
          duration: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          prescription_id: string;
          name: string;
          dosage?: string;
          frequency?: string;
          duration?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          prescription_id?: string;
          name?: string;
          dosage?: string;
          frequency?: string;
          duration?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prescription_medicines_prescription_id_fkey';
            columns: ['prescription_id'];
            isOneToOne: false;
            referencedRelation: 'prescriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          child_id: string;
          visit_id: string | null;
          name: string;
          document_type: string;
          storage_path: string;
          file_type: string;
          file_size_bytes: number | null;
          document_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          visit_id?: string | null;
          name: string;
          document_type: string;
          storage_path: string;
          file_type: string;
          file_size_bytes?: number | null;
          document_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          visit_id?: string | null;
          name?: string;
          document_type?: string;
          storage_path?: string;
          file_type?: string;
          file_size_bytes?: number | null;
          document_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_records: {
        Row: {
          id: string;
          child_id: string;
          visit_id: string | null;
          bill_date: string;
          amount: number;
          hospital_name: string;
          description: string;
          receipt_image_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          visit_id?: string | null;
          bill_date: string;
          amount: number;
          hospital_name: string;
          description?: string;
          receipt_image_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          visit_id?: string | null;
          bill_date?: string;
          amount?: number;
          hospital_name?: string;
          description?: string;
          receipt_image_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
