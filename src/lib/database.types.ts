export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academy_letter_characteristics: {
        Row: {
          characteristic_id: string
          letter_id: string
        }
        Insert: {
          characteristic_id: string
          letter_id: string
        }
        Update: {
          characteristic_id?: string
          letter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_letter_characteristics_characteristic_id_fkey"
            columns: ["characteristic_id"]
            isOneToOne: false
            referencedRelation: "letter_characteristics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_letter_characteristics_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "academy_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_letter_examples: {
        Row: {
          example_id: string
          letter_id: string
        }
        Insert: {
          example_id: string
          letter_id: string
        }
        Update: {
          example_id?: string
          letter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_letter_examples_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "quranic_examples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_letter_examples_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "academy_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_letters: {
        Row: {
          articulation_point_id: string | null
          audio_resource_id: string | null
          common_mistakes_md: string | null
          created_at: string
          created_by: string | null
          description_md: string | null
          id: string
          letter: string
          origin: Database["public"]["Enums"]["content_origin"]
          scientifically_verified: boolean
          sort_order: number
          source_edition_id: string | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          articulation_point_id?: string | null
          audio_resource_id?: string | null
          common_mistakes_md?: string | null
          created_at?: string
          created_by?: string | null
          description_md?: string | null
          id?: string
          letter: string
          origin?: Database["public"]["Enums"]["content_origin"]
          scientifically_verified?: boolean
          sort_order: number
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          articulation_point_id?: string | null
          audio_resource_id?: string | null
          common_mistakes_md?: string | null
          created_at?: string
          created_by?: string | null
          description_md?: string | null
          id?: string
          letter?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          scientifically_verified?: boolean
          sort_order?: number
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_letters_articulation_point_id_fkey"
            columns: ["articulation_point_id"]
            isOneToOne: false
            referencedRelation: "articulation_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_letters_audio_resource_id_fkey"
            columns: ["audio_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_letters_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachment_resource_id: string | null
          body: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["announcement_kind"]
          link_url: string | null
          pinned: boolean
          publish_at: string
          target_level_id: string | null
          title: string
        }
        Insert: {
          attachment_resource_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["announcement_kind"]
          link_url?: string | null
          pinned?: boolean
          publish_at?: string
          target_level_id?: string | null
          title: string
        }
        Update: {
          attachment_resource_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["announcement_kind"]
          link_url?: string | null
          pinned?: boolean
          publish_at?: string
          target_level_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_attachment_resource_id_fkey"
            columns: ["attachment_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_level_id_fkey"
            columns: ["target_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      articulation_points: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_md: string | null
          diagram_resource_id: string | null
          general_area: string
          id: string
          name: string
          origin: Database["public"]["Enums"]["content_origin"]
          scientifically_verified: boolean
          sort_order: number
          source_edition_id: string | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description_md?: string | null
          diagram_resource_id?: string | null
          general_area: string
          id?: string
          name: string
          origin?: Database["public"]["Enums"]["content_origin"]
          scientifically_verified?: boolean
          sort_order: number
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_md?: string | null
          diagram_resource_id?: string | null
          general_area?: string
          id?: string
          name?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          scientifically_verified?: boolean
          sort_order?: number
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articulation_points_diagram_resource_id_fkey"
            columns: ["diagram_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articulation_points_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          attempt_id: string
          exam_question_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          manual_parts: Json
          needs_manual: boolean
          part_scores: Json
          response: Json | null
          saved_at: string
          score: number | null
        }
        Insert: {
          attempt_id: string
          exam_question_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          manual_parts?: Json
          needs_manual?: boolean
          part_scores?: Json
          response?: Json | null
          saved_at?: string
          score?: number | null
        }
        Update: {
          attempt_id?: string
          exam_question_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          manual_parts?: Json
          needs_manual?: boolean
          part_scores?: Json
          response?: Json | null
          saved_at?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_exam_question_id_fkey"
            columns: ["exam_question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
          occurred_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          occurred_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          lesson_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          completion_date: string
          edition_id: string | null
          evidence: Json
          id: string
          issued_at: string
          issuer_name: string
          kind: Database["public"]["Enums"]["certificate_kind"]
          level_id: string
          revoke_reason: string | null
          revoked_at: string | null
          student_id: string
          student_name: string
          title: string
          verification_code: string
        }
        Insert: {
          completion_date?: string
          edition_id?: string | null
          evidence?: Json
          id?: string
          issued_at?: string
          issuer_name: string
          kind?: Database["public"]["Enums"]["certificate_kind"]
          level_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          student_id: string
          student_name: string
          title: string
          verification_code?: string
        }
        Update: {
          completion_date?: string
          edition_id?: string | null
          evidence?: Json
          id?: string
          issued_at?: string
          issuer_name?: string
          kind?: Database["public"]["Enums"]["certificate_kind"]
          level_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          student_id?: string
          student_name?: string
          title?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          code: string
          id: string
          label: string | null
          level_id: string
          review_note: string | null
          sort_order: number
          source_page_end: number | null
          source_page_start: number | null
          title: string
        }
        Insert: {
          code: string
          id?: string
          label?: string | null
          level_id: string
          review_note?: string | null
          sort_order: number
          source_page_end?: number | null
          source_page_start?: number | null
          title: string
        }
        Update: {
          code?: string
          id?: string
          label?: string | null
          level_id?: string
          review_note?: string | null
          sort_order?: number
          source_page_end?: number | null
          source_page_start?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: {
          affiliation_note: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          language: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          affiliation_note?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          language?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          affiliation_note?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          language?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_editions: {
        Row: {
          authors: string[]
          created_at: string
          curriculum_id: string
          id: string
          is_current: boolean
          is_published: boolean
          label: string
          publisher: string | null
          riwayah_id: string
          slug: string
          source_document: Json
          year_ah: number | null
          year_ce: number | null
        }
        Insert: {
          authors?: string[]
          created_at?: string
          curriculum_id: string
          id?: string
          is_current?: boolean
          is_published?: boolean
          label: string
          publisher?: string | null
          riwayah_id: string
          slug: string
          source_document?: Json
          year_ah?: number | null
          year_ce?: number | null
        }
        Update: {
          authors?: string[]
          created_at?: string
          curriculum_id?: string
          id?: string
          is_current?: boolean
          is_published?: boolean
          label?: string
          publisher?: string | null
          riwayah_id?: string
          slug?: string
          source_document?: Json
          year_ah?: number | null
          year_ce?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_editions_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_editions_riwayah_id_fkey"
            columns: ["riwayah_id"]
            isOneToOne: false
            referencedRelation: "riwayat"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          attempt_no: number
          auto_score: number | null
          deadline_at: string | null
          exam_id: string
          graded_at: string | null
          guest_name: string | null
          guest_token_hash: string | null
          id: string
          ip_hash: string | null
          manual_score: number | null
          max_score: number
          option_orders: Json
          passed: boolean | null
          question_order: string[]
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submitted_at: string | null
          total_score: number | null
          user_id: string | null
        }
        Insert: {
          attempt_no?: number
          auto_score?: number | null
          deadline_at?: string | null
          exam_id: string
          graded_at?: string | null
          guest_name?: string | null
          guest_token_hash?: string | null
          id?: string
          ip_hash?: string | null
          manual_score?: number | null
          max_score: number
          option_orders?: Json
          passed?: boolean | null
          question_order: string[]
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          total_score?: number | null
          user_id?: string | null
        }
        Update: {
          attempt_no?: number
          auto_score?: number | null
          deadline_at?: string | null
          exam_id?: string
          graded_at?: string | null
          guest_name?: string | null
          guest_token_hash?: string | null
          id?: string
          ip_hash?: string | null
          manual_score?: number | null
          max_score?: number
          option_orders?: Json
          passed?: boolean | null
          question_order?: string[]
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          total_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          exam_id: string
          id: string
          is_required: boolean
          question_version_id: string
          section: string | null
          sort_order: number
        }
        Insert: {
          exam_id: string
          id?: string
          is_required?: boolean
          question_version_id: string
          section?: string | null
          sort_order?: number
        }
        Update: {
          exam_id?: string
          id?: string
          is_required?: boolean
          question_version_id?: string
          section?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          chapter_id: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          edition_id: string | null
          has_manual_parts: boolean
          id: string
          is_level_final: boolean
          kind: Database["public"]["Enums"]["exam_kind"]
          lesson_id: string | null
          level_id: string | null
          max_attempts: number | null
          model_answer_visibility: Database["public"]["Enums"]["model_answer_visibility"]
          opens_at: string | null
          pass_percent: number
          requires_account: boolean
          result_release: Database["public"]["Enums"]["result_release"]
          results_release_at: string | null
          results_released: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          slug: string | null
          status: Database["public"]["Enums"]["exam_status"]
          time_limit_minutes: number | null
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          edition_id?: string | null
          has_manual_parts?: boolean
          id?: string
          is_level_final?: boolean
          kind?: Database["public"]["Enums"]["exam_kind"]
          lesson_id?: string | null
          level_id?: string | null
          max_attempts?: number | null
          model_answer_visibility?: Database["public"]["Enums"]["model_answer_visibility"]
          opens_at?: string | null
          pass_percent?: number
          requires_account?: boolean
          result_release?: Database["public"]["Enums"]["result_release"]
          results_release_at?: string | null
          results_released?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          time_limit_minutes?: number | null
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          edition_id?: string | null
          has_manual_parts?: boolean
          id?: string
          is_level_final?: boolean
          kind?: Database["public"]["Enums"]["exam_kind"]
          lesson_id?: string | null
          level_id?: string | null
          max_attempts?: number | null
          model_answer_visibility?: Database["public"]["Enums"]["model_answer_visibility"]
          opens_at?: string | null
          pass_percent?: number
          requires_account?: boolean
          result_release?: Database["public"]["Enums"]["result_release"]
          results_release_at?: string | null
          results_released?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          time_limit_minutes?: number | null
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_rate: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      heartbeat: {
        Row: {
          beat_at: string
          id: number
        }
        Insert: {
          beat_at?: string
          id?: number
        }
        Update: {
          beat_at?: string
          id?: number
        }
        Relationships: []
      }
      lesson_examples: {
        Row: {
          example_id: string
          lesson_id: string
          rule_note: string | null
          sort_order: number
        }
        Insert: {
          example_id: string
          lesson_id: string
          rule_note?: string | null
          sort_order?: number
        }
        Update: {
          example_id?: string
          lesson_id?: string
          rule_note?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_examples_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "quranic_examples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_examples_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          assessment_passed_at: string | null
          best_accuracy: number | null
          completed_at: string | null
          last_accuracy: number | null
          lesson_id: string
          mastered_at: string | null
          practice_completed_at: string | null
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          assessment_passed_at?: string | null
          best_accuracy?: number | null
          completed_at?: string | null
          last_accuracy?: number | null
          lesson_id: string
          mastered_at?: string | null
          practice_completed_at?: string | null
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          assessment_passed_at?: string | null
          best_accuracy?: number | null
          completed_at?: string | null
          last_accuracy?: number | null
          lesson_id?: string
          mastered_at?: string | null
          practice_completed_at?: string | null
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_relations: {
        Row: {
          lesson_id: string
          related_lesson_id: string
        }
        Insert: {
          lesson_id: string
          related_lesson_id: string
        }
        Update: {
          lesson_id?: string
          related_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_relations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_relations_related_lesson_id_fkey"
            columns: ["related_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          lesson_id: string
          resource_id: string
          sort_order: number
        }
        Insert: {
          lesson_id: string
          resource_id: string
          sort_order?: number
        }
        Update: {
          lesson_id?: string
          resource_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body_md: string | null
          chapter_id: string
          code: string
          created_at: string
          created_by: string | null
          definitions: Json
          description: string | null
          id: string
          objectives: string[]
          origin: Database["public"]["Enums"]["content_origin"]
          parent_lesson_id: string | null
          rules: Json
          scientifically_verified: boolean
          search_norm: string | null
          sort_order: number
          source_edition_id: string | null
          source_page_end: number | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          tables: Json
          title: string
          updated_at: string
          youtube_ids: string[]
        }
        Insert: {
          body_md?: string | null
          chapter_id: string
          code: string
          created_at?: string
          created_by?: string | null
          definitions?: Json
          description?: string | null
          id?: string
          objectives?: string[]
          origin?: Database["public"]["Enums"]["content_origin"]
          parent_lesson_id?: string | null
          rules?: Json
          scientifically_verified?: boolean
          search_norm?: string | null
          sort_order: number
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          tables?: Json
          title: string
          updated_at?: string
          youtube_ids?: string[]
        }
        Update: {
          body_md?: string | null
          chapter_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          definitions?: Json
          description?: string | null
          id?: string
          objectives?: string[]
          origin?: Database["public"]["Enums"]["content_origin"]
          parent_lesson_id?: string | null
          rules?: Json
          scientifically_verified?: boolean
          search_norm?: string | null
          sort_order?: number
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          tables?: Json
          title?: string
          updated_at?: string
          youtube_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_parent_lesson_id_fkey"
            columns: ["parent_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_characteristics: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_md: string | null
          has_opposite: boolean
          id: string
          name: string
          opposite_id: string | null
          origin: Database["public"]["Enums"]["content_origin"]
          scientifically_verified: boolean
          source_edition_id: string | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description_md?: string | null
          has_opposite: boolean
          id?: string
          name: string
          opposite_id?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          scientifically_verified?: boolean
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_md?: string | null
          has_opposite?: boolean
          id?: string
          name?: string
          opposite_id?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          scientifically_verified?: boolean
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_characteristics_opposite_id_fkey"
            columns: ["opposite_id"]
            isOneToOne: false
            referencedRelation: "letter_characteristics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_characteristics_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      level_resources: {
        Row: {
          level_id: string
          resource_id: string
          sort_order: number
        }
        Insert: {
          level_id: string
          resource_id: string
          sort_order?: number
        }
        Update: {
          level_id?: string
          resource_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "level_resources_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          code: string
          description: string | null
          edition_id: string
          id: string
          sort_order: number
          source_page_end: number | null
          source_page_start: number | null
          subtitle: string | null
          title: string
        }
        Insert: {
          code: string
          description?: string | null
          edition_id: string
          id?: string
          sort_order: number
          source_page_end?: number | null
          source_page_start?: number | null
          subtitle?: string | null
          title: string
        }
        Update: {
          code?: string
          description?: string | null
          edition_id?: string
          id?: string
          sort_order?: number
          source_page_end?: number | null
          source_page_start?: number | null
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: number
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_role_assignments: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          is_secret: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_secret?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          is_secret?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_level_id: string | null
          display_name: string | null
          full_name: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level_id?: string | null
          display_name?: string | null
          full_name?: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level_id?: string | null
          display_name?: string | null
          full_name?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_level_fk"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      question_keys: {
        Row: {
          explanation: string | null
          key: Json
          model_answer: Json
          question_version_id: string
        }
        Insert: {
          explanation?: string | null
          key: Json
          model_answer?: Json
          question_version_id: string
        }
        Update: {
          explanation?: string | null
          key?: Json
          model_answer?: Json
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_keys_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: true
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          auto_gradable: boolean
          created_at: string
          created_by: string | null
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          prompt: Json
          question_id: string
          scientifically_verified: boolean
          search_norm: string | null
          source_edition_id: string | null
          source_page_end: number | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          total_marks: number
          updated_at: string
          version_no: number
        }
        Insert: {
          auto_gradable?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          prompt: Json
          question_id: string
          scientifically_verified?: boolean
          search_norm?: string | null
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          total_marks?: number
          updated_at?: string
          version_no: number
        }
        Update: {
          auto_gradable?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          prompt?: Json
          question_id?: string
          scientifically_verified?: boolean
          search_norm?: string | null
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          total_marks?: number
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          difficulty: number
          edition_id: string | null
          id: string
          is_archived: boolean
          lesson_id: string | null
          level_id: string | null
          tags: string[]
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          difficulty?: number
          edition_id?: string | null
          id?: string
          is_archived?: boolean
          lesson_id?: string | null
          level_id?: string | null
          tags?: string[]
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          difficulty?: number
          edition_id?: string | null
          id?: string
          is_archived?: boolean
          lesson_id?: string | null
          level_id?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      quranic_examples: {
        Row: {
          ayah_end: number
          ayah_start: number
          created_at: string
          created_by: string | null
          display_text: string | null
          id: string
          note: string | null
          origin: Database["public"]["Enums"]["content_origin"]
          riwayah_id: string
          scientifically_verified: boolean
          source_edition_id: string | null
          source_page_end: number | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          surah: number
          text_source: string | null
          updated_at: string
          word_end: number | null
          word_start: number | null
        }
        Insert: {
          ayah_end: number
          ayah_start: number
          created_at?: string
          created_by?: string | null
          display_text?: string | null
          id?: string
          note?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          riwayah_id: string
          scientifically_verified?: boolean
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          surah: number
          text_source?: string | null
          updated_at?: string
          word_end?: number | null
          word_start?: number | null
        }
        Update: {
          ayah_end?: number
          ayah_start?: number
          created_at?: string
          created_by?: string | null
          display_text?: string | null
          id?: string
          note?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          riwayah_id?: string
          scientifically_verified?: boolean
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          surah?: number
          text_source?: string | null
          updated_at?: string
          word_end?: number | null
          word_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quranic_examples_riwayah_id_fkey"
            columns: ["riwayah_id"]
            isOneToOne: false
            referencedRelation: "riwayat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quranic_examples_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          external_url: string | null
          id: string
          is_downloadable: boolean
          kind: Database["public"]["Enums"]["resource_kind"]
          mime_type: string | null
          object_key: string | null
          origin: Database["public"]["Enums"]["content_origin"]
          provider: Database["public"]["Enums"]["storage_provider"]
          reciter_name: string | null
          scientifically_verified: boolean
          size_bytes: number | null
          source_edition_id: string | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          youtube_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          id?: string
          is_downloadable?: boolean
          kind: Database["public"]["Enums"]["resource_kind"]
          mime_type?: string | null
          object_key?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          provider: Database["public"]["Enums"]["storage_provider"]
          reciter_name?: string | null
          scientifically_verified?: boolean
          size_bytes?: number | null
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          youtube_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          id?: string
          is_downloadable?: boolean
          kind?: Database["public"]["Enums"]["resource_kind"]
          mime_type?: string | null
          object_key?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          provider?: Database["public"]["Enums"]["storage_provider"]
          reciter_name?: string | null
          scientifically_verified?: boolean
          size_bytes?: number | null
          source_edition_id?: string | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          entity_id: string
          entity_type: string
          reviewer_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          entity_id: string
          entity_type: string
          reviewer_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          entity_id?: string
          entity_type?: string
          reviewer_id?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          field_path: string | null
          id: number
          resolved: boolean
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          field_path?: string | null
          id?: never
          resolved?: boolean
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_path?: string | null
          id?: never
          resolved?: boolean
        }
        Relationships: []
      }
      review_events: {
        Row: {
          actor_id: string | null
          comment: string | null
          entity_id: string
          entity_type: string
          from_status: Database["public"]["Enums"]["content_status"] | null
          id: number
          occurred_at: string
          snapshot: Json
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          actor_id?: string | null
          comment?: string | null
          entity_id: string
          entity_type: string
          from_status?: Database["public"]["Enums"]["content_status"] | null
          id?: never
          occurred_at?: string
          snapshot: Json
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          actor_id?: string | null
          comment?: string | null
          entity_id?: string
          entity_type?: string
          from_status?: Database["public"]["Enums"]["content_status"] | null
          id?: never
          occurred_at?: string
          snapshot?: Json
          to_status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: []
      }
      reviewable_entities: {
        Row: {
          entity: string
        }
        Insert: {
          entity: string
        }
        Update: {
          entity?: string
        }
        Relationships: []
      }
      riwayat: {
        Row: {
          code: string
          id: string
          name_ar: string
          name_en: string | null
          tariq: string | null
        }
        Insert: {
          code: string
          id?: string
          name_ar: string
          name_en?: string | null
          tariq?: string | null
        }
        Update: {
          code?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          tariq?: string | null
        }
        Relationships: []
      }
      tajweed_topics: {
        Row: {
          created_at: string
          created_by: string | null
          definition: string | null
          explanation_md: string | null
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          riwayah_id: string | null
          rules: Json
          scientifically_verified: boolean
          search_norm: string | null
          slug: string
          source_edition_id: string | null
          source_page_end: number | null
          source_page_start: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: string | null
          explanation_md?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          riwayah_id?: string | null
          rules?: Json
          scientifically_verified?: boolean
          search_norm?: string | null
          slug: string
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: string | null
          explanation_md?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          riwayah_id?: string | null
          rules?: Json
          scientifically_verified?: boolean
          search_norm?: string | null
          slug?: string
          source_edition_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tajweed_topics_riwayah_id_fkey"
            columns: ["riwayah_id"]
            isOneToOne: false
            referencedRelation: "riwayat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tajweed_topics_source_edition_id_fkey"
            columns: ["source_edition_id"]
            isOneToOne: false
            referencedRelation: "curriculum_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_lessons: {
        Row: {
          lesson_id: string
          topic_id: string
        }
        Insert: {
          lesson_id: string
          topic_id: string
        }
        Update: {
          lesson_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "tajweed_topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_reviewer: {
        Args: { p_entity: string; p_id: string; p_reviewer: string }
        Returns: undefined
      }
      attempt_for_caller: {
        Args: { p_attempt: string; p_token: string }
        Returns: {
          attempt_no: number
          auto_score: number | null
          deadline_at: string | null
          exam_id: string
          graded_at: string | null
          guest_name: string | null
          guest_token_hash: string | null
          id: string
          ip_hash: string | null
          manual_score: number | null
          max_score: number
          option_orders: Json
          passed: boolean | null
          question_order: string[]
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submitted_at: string | null
          total_score: number | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "exam_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attempt_result_json: {
        Args: {
          a: Database["public"]["Tables"]["exam_attempts"]["Row"]
          p_staff: boolean
        }
        Returns: Json
      }
      audit: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: undefined
      }
      can_manage_announcements: { Args: never; Returns: boolean }
      can_manage_exams: { Args: never; Returns: boolean }
      claim_guest_attempts: {
        Args: { p_attempts: string[]; p_tokens: string[] }
        Returns: number
      }
      client_ip_hash: { Args: never; Returns: string }
      content_meta: {
        Args: { p_entity: string; p_id: string }
        Returns: Record<string, unknown>
      }
      edition_is_public: { Args: { p_edition: string }; Returns: boolean }
      get_attempt_paper: {
        Args: { p_attempt: string; p_token?: string }
        Returns: Json
      }
      get_attempt_result: {
        Args: { p_attempt: string; p_token?: string }
        Returns: Json
      }
      grade_answer: {
        Args: {
          p_attempt: string
          p_exam_question: string
          p_feedback?: string
          p_part_scores: Json
        }
        Returns: Database["public"]["Enums"]["attempt_status"]
      }
      grade_attempt_internal: {
        Args: { p_attempt: string }
        Returns: undefined
      }
      grade_part: {
        Args: {
          p_key: Json
          p_resp: Json
          p_type: Database["public"]["Enums"]["part_type"]
        }
        Returns: number
      }
      guest_rate_check: { Args: { p_ip_hash: string }; Returns: undefined }
      has_platform_role: {
        Args: { p_roles: Database["public"]["Enums"]["platform_role"][] }
        Returns: boolean
      }
      heartbeat: { Args: never; Returns: string }
      import_guest_progress: { Args: { p_items: Json }; Returns: number }
      is_content_staff: { Args: never; Returns: boolean }
      is_grader: { Args: never; Returns: boolean }
      is_publisher: { Args: never; Returns: boolean }
      is_scientific_reviewer: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_member: { Args: never; Returns: boolean }
      issue_level_certificate: { Args: { p_level: string }; Returns: string }
      list_grading_queue: {
        Args: { p_limit?: number }
        Returns: {
          attempt_id: string
          exam_question_id: string
          exam_title: string
          model_answer: Json
          part_scores: Json
          parts: Json
          response: Json
          stem: Json
          submitted_at: string
        }[]
      }
      list_my_attempts: {
        Args: { p_exam?: string }
        Returns: {
          attempt_id: string
          attempt_no: number
          exam_id: string
          exam_title: string
          max_score: number
          passed: boolean
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submitted_at: string
          total_score: number
        }[]
      }
      mark_lesson: {
        Args: { p_action: string; p_lesson: string }
        Returns: undefined
      }
      mark_notifications_read: { Args: { p_ids?: number[] }; Returns: number }
      model_answers_visible: {
        Args: {
          p_attempt: Database["public"]["Tables"]["exam_attempts"]["Row"]
          p_exam: Database["public"]["Tables"]["exams"]["Row"]
        }
        Returns: boolean
      }
      my_review_recommendations: {
        Args: { p_limit?: number }
        Returns: {
          accuracy: number
          lesson_id: string
          lesson_title: string
          practice_exam_ids: string[]
          questions_seen: number
        }[]
      }
      new_question_version: { Args: { p_question: string }; Returns: string }
      norm_answer: { Args: { p: string }; Returns: string }
      normalize_arabic: { Args: { p: string }; Returns: string }
      notify: {
        Args: {
          p_body?: string
          p_data?: Json
          p_kind: string
          p_link?: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      on_attempt_graded: { Args: { p_attempt: string }; Returns: undefined }
      publish_content: {
        Args: {
          p_comment?: string
          p_entity: string
          p_id: string
          p_to?: Database["public"]["Enums"]["content_status"]
        }
        Returns: Database["public"]["Enums"]["content_status"]
      }
      publish_exam: { Args: { p_exam: string }; Returns: number }
      purge_expired_guest_data: { Args: { p_batch?: number }; Returns: number }
      release_results: { Args: { p_exam: string }; Returns: undefined }
      results_released: {
        Args: { p_exam: Database["public"]["Tables"]["exams"]["Row"] }
        Returns: boolean
      }
      revoke_certificate: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      save_answer: {
        Args: {
          p_attempt: string
          p_exam_question: string
          p_response: Json
          p_token?: string
        }
        Returns: string
      }
      search_content: {
        Args: {
          p_edition?: string
          p_level?: string
          p_limit?: number
          p_query: string
        }
        Returns: {
          chapter_id: string
          id: string
          kind: string
          level_id: string
          score: number
          snippet: string
          title: string
        }[]
      }
      set_exam_status: {
        Args: {
          p_exam: string
          p_status: Database["public"]["Enums"]["exam_status"]
        }
        Returns: undefined
      }
      setting_num: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_attempt: {
        Args: { p_exam: string; p_guest_name?: string; p_guest_token?: string }
        Returns: Json
      }
      submit_attempt: {
        Args: { p_answers?: Json; p_attempt: string; p_token?: string }
        Returns: Database["public"]["Enums"]["attempt_status"]
      }
      transition_content: {
        Args: {
          p_comment?: string
          p_entity: string
          p_id: string
          p_to: Database["public"]["Enums"]["content_status"]
        }
        Returns: Database["public"]["Enums"]["content_status"]
      }
      verify_certificate: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      announcement_kind: "text" | "image" | "pdf" | "link" | "mixed"
      attempt_status: "in_progress" | "submitted" | "graded"
      certificate_kind: "level_completion"
      content_origin:
        | "curriculum_quoted"
        | "supplementary_explanation"
        | "independent_material"
      content_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "changes_requested"
        | "approved"
        | "published"
        | "archived"
      exam_kind: "practice" | "formal"
      exam_status: "draft" | "published" | "closed" | "archived"
      model_answer_visibility:
        | "never"
        | "after_submission"
        | "after_release"
        | "after_exam_end"
      part_type:
        | "single_choice"
        | "multiple_choice"
        | "true_false"
        | "short_text"
        | "long_text"
        | "fill_blank"
        | "drag_drop"
        | "table"
        | "matching"
        | "ordering"
        | "audio_response"
      platform_role:
        | "super_admin"
        | "scientific_review_admin"
        | "scientific_reviewer"
        | "content_editor"
        | "grader"
        | "moderator"
      resource_kind:
        | "pdf"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "link"
        | "diagram"
      result_release: "immediate" | "on_date" | "manual"
      storage_provider: "r2" | "supabase" | "youtube" | "external"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      announcement_kind: ["text", "image", "pdf", "link", "mixed"],
      attempt_status: ["in_progress", "submitted", "graded"],
      certificate_kind: ["level_completion"],
      content_origin: [
        "curriculum_quoted",
        "supplementary_explanation",
        "independent_material",
      ],
      content_status: [
        "draft",
        "submitted",
        "under_review",
        "changes_requested",
        "approved",
        "published",
        "archived",
      ],
      exam_kind: ["practice", "formal"],
      exam_status: ["draft", "published", "closed", "archived"],
      model_answer_visibility: [
        "never",
        "after_submission",
        "after_release",
        "after_exam_end",
      ],
      part_type: [
        "single_choice",
        "multiple_choice",
        "true_false",
        "short_text",
        "long_text",
        "fill_blank",
        "drag_drop",
        "table",
        "matching",
        "ordering",
        "audio_response",
      ],
      platform_role: [
        "super_admin",
        "scientific_review_admin",
        "scientific_reviewer",
        "content_editor",
        "grader",
        "moderator",
      ],
      resource_kind: [
        "pdf",
        "image",
        "audio",
        "video",
        "document",
        "link",
        "diagram",
      ],
      result_release: ["immediate", "on_date", "manual"],
      storage_provider: ["r2", "supabase", "youtube", "external"],
    },
  },
} as const
