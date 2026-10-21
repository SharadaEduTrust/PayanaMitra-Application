/**
 * Database type definitions for Payana Mitra.
 * Keep in sync with supabase/migrations/*.sql.
 * Never add fields not present in the migrations.
 */

export type UserRoleEnum = 'traveller' | 'admin' | 'leader'
export type TripStatus = 'draft' | 'published' | 'archived'
export type FoodPref = 'veg' | 'non_veg'
export type RoleStatus = 'active' | 'inactive'

// ─── user_roles ──────────────────────────────────────────────
export interface UserRoleRecord {
  id: number
  role_name: string
  status: RoleStatus
  created_at: string
  updated_at: string
}

// ─── profiles ────────────────────────────────────────────────
export interface Profile {
  id: string
  phone: string
  first_name: string
  last_name: string
  role: UserRoleEnum
  is_active: boolean
  must_change_password: boolean
  leader_id: string | null         // FK to profiles.id (assigned leader)
  date_of_joining: string | null   // ISO date
  last_active_at: string | null    // ISO timestamptz
  location: string | null
  email: string | null
  remarks: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ─── traveller_details ────────────────────────────────────────
export interface TravellerDetails {
  id: string
  user_id: string
  dob: string | null
  food_preference: FoodPref | null
  food_allergy: string | null
  emergency_contact_name: string | null
  emergency_contact_no: string | null
  travel_insurance_no: string | null
  insurance_company: string | null
  insurance_expiry: string | null
  passport_issued_location: string | null
  created_at: string
  updated_at: string
}

// ─── trips ────────────────────────────────────────────────────
export interface Trip {
  id: string
  trip_code: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  leader_id: string | null
  status: TripStatus
  is_active: boolean
  remarks: string | null
  created_at: string
  updated_at: string
}

// ─── trip_members ─────────────────────────────────────────────
export interface TripMember {
  id: string
  trip_id: string
  user_id: string
  created_at: string
}

// ─── trip_contacts ────────────────────────────────────────────
export interface TripContact {
  id: string
  trip_id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  created_at: string
}

// ─── destinations ─────────────────────────────────────────────
export interface Destination {
  id: string
  name: string
  description: string | null
  region: string | null
  country: string | null
  image_url: string | null
  created_at: string
}

// ─── trip_destinations ────────────────────────────────────────
export interface TripDestination {
  id: string
  trip_id: string
  destination_id: string
  visit_order: number | null
  created_at: string
}

// ─── itinerary_days ───────────────────────────────────────────
export interface ItineraryDay {
  id: string
  trip_id: string
  day_number: number
  destination: string | null
  itinerary_text: string | null
  hotel_name: string | null
  meal_plan?: string | null
  created_at: string
  updated_at: string
}

// ─── activities ───────────────────────────────────────────────
export interface Activity {
  id: string
  itinerary_day_id: string
  title: string
  description: string | null
  start_time: string | null   // HH:MM:SS
  end_time: string | null
  activity_order: number | null
  created_at: string
}

// ─── feedback ─────────────────────────────────────────────────
export interface Feedback {
  id: string
  trip_id: string
  user_id: string
  rating: number | null   // 1–5
  comment: string | null
  created_at: string
}

// ─── survey_responses ─────────────────────────────────────────
export interface SurveyResponse {
  id: string
  trip_id: string
  user_id: string
  question: string
  answer: string | null
  created_at: string
}

// ─── guest_documents ──────────────────────────────────────────
/** Encrypted document. doc_number_enc is AES-256-GCM ciphertext. */
export interface GuestDocument {
  id: string
  user_id: string
  trip_id: string | null
  doc_type: string
  doc_number_enc: string | null
  iv: string
  auth_tag: string
  expiry_date: string | null
  issued_country: string | null
  issued_date?: string | null
  issued_place?: string | null
  storage_path?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  created_at: string
  updated_at: string
}

// ─── notifications ──────────────────────────────────────────────
export interface Notification {
  id: string
  user_id: string
  trip_id: string | null
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

// ─── push_subscriptions ───────────────────────────────────────
export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string | null
  auth_key: string | null
  created_at: string
}

// ─── audit_log ────────────────────────────────────────────────
export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  payload: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

// ─── login_attempts ───────────────────────────────────────────
export interface LoginAttempt {
  id: string
  phone: string
  ip: string
  succeeded: boolean
  attempted_at: string
}

// ─── trail_leader_view ────────────────────────────────────────
export interface TrailLeaderView {
  trip_id: string
  trip_code: string
  trip_name: string
  start_date: string | null
  end_date: string | null
  status: TripStatus
  leader_id: string | null
  leader_first_name: string | null
  leader_last_name: string | null
  leader_phone: string | null
  leader_email: string | null
}

// ─── leader_guests_view ───────────────────────────────────────
export interface LeaderGuestsView {
  leader_id: string
  leader_first_name: string
  leader_last_name: string
  leader_phone: string
  guest_id: string
  guest_first_name: string
  guest_last_name: string
  guest_phone: string
  guest_email: string | null
  guest_is_active: boolean
}

// ─── trip_summary_view ────────────────────────────────────────
export interface TripSummaryView {
  trip_id: string
  trip_code: string
  trip_name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  status: TripStatus
  is_active: boolean
  leader_id: string | null
  leader_first_name: string | null
  leader_last_name: string | null
  leader_phone: string | null
  member_count: number
}

// ─── Database helper type ─────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      user_roles: { Row: UserRoleRecord; Insert: Omit<UserRoleRecord, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<UserRoleRecord, 'id'>> }
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Omit<Profile, 'id'>> }
      traveller_details: { Row: TravellerDetails; Insert: Omit<TravellerDetails, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<TravellerDetails, 'id'>> }
      trips: { Row: Trip; Insert: Omit<Trip, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Trip, 'id'>> }
      trip_members: { Row: TripMember; Insert: Omit<TripMember, 'id' | 'created_at'>; Update: never }
      trip_contacts: { Row: TripContact; Insert: Omit<TripContact, 'id' | 'created_at'>; Update: Partial<Omit<TripContact, 'id'>> }
      destinations: { Row: Destination; Insert: Omit<Destination, 'id' | 'created_at'>; Update: Partial<Omit<Destination, 'id'>> }
      trip_destinations: { Row: TripDestination; Insert: Omit<TripDestination, 'id' | 'created_at'>; Update: never }
      itinerary_days: { Row: ItineraryDay; Insert: Omit<ItineraryDay, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ItineraryDay, 'id'>> }
      activities: { Row: Activity; Insert: Omit<Activity, 'id' | 'created_at'>; Update: Partial<Omit<Activity, 'id'>> }
      feedback: { Row: Feedback; Insert: Omit<Feedback, 'id' | 'created_at'>; Update: never }
      survey_responses: { Row: SurveyResponse; Insert: Omit<SurveyResponse, 'id' | 'created_at'>; Update: never }
      guest_documents: { Row: GuestDocument; Insert: Omit<GuestDocument, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<GuestDocument, 'id'>> }
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Pick<Notification, 'is_read'>> }
      push_subscriptions: { Row: PushSubscription; Insert: Omit<PushSubscription, 'id' | 'created_at'>; Update: Partial<Omit<PushSubscription, 'id' | 'user_id'>> }
      audit_log: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: never }
      login_attempts: { Row: LoginAttempt; Insert: Omit<LoginAttempt, 'id' | 'attempted_at'>; Update: never }
    }
    Views: {
      trail_leader_view: { Row: TrailLeaderView }
      leader_guests_view: { Row: LeaderGuestsView }
      trip_summary_view: { Row: TripSummaryView }
    }
    Functions: {
      copy_trip: {
        Args: { source_trip_id: string; new_trip_code: string; new_name: string; new_start_date?: string }
        Returns: string
      }
      is_admin: { Args: Record<never, never>; Returns: boolean }
      is_trip_member: { Args: { trip: string }; Returns: boolean }
      is_leader_of_trip: { Args: { trip: string }; Returns: boolean }
      is_leader_of_user: { Args: { target_user_id: string }; Returns: boolean }
    }
  }
}
