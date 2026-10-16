export type UserRole = "traveller" | "leader" | "admin";
export type TripStatus = "draft" | "published" | "archived";
export type FoodPref = "veg" | "non_veg";

export type Profile = {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  date_of_joining: string | null;
  last_active_at: string | null;
  location: string | null;
  email: string | null;
  remarks: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type TravellerDetails = {
  id: string;
  user_id: string;
  dob: string | null;
  food_preference: FoodPref | null;
  food_allergy: string | null;
  emergency_contact_name: string | null;
  emergency_contact_no: string | null;
  travel_insurance_no: string | null;
  insurance_company: string | null;
  insurance_expiry: string | null;
  created_at: string;
  updated_at: string;
};

export type Destination = {
  id: string;
  name: string;
  description: string | null;
  region: string | null;
  country: string | null;
  image_url: string | null;
  created_at: string;
};

export type Trip = {
  id: string;
  trip_code: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  leader_id: string | null;
  status: TripStatus;
  is_active: boolean;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

export type TripMember = { id: string; trip_id: string; user_id: string; created_at: string };
export type TripContact = {
  id: string;
  trip_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};
export type TripDestination = {
  id: string;
  trip_id: string;
  destination_id: string;
  visit_order: number | null;
  created_at: string;
};

export type ItineraryDay = {
  id: string;
  trip_id: string;
  day_number: number;
  destination: string | null;
  itinerary_text: string | null;
  hotel_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  itinerary_day_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  activity_order: number | null;
  created_at: string;
};

export type Feedback = {
  id: string;
  trip_id: string;
  user_id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
};

export type SurveyResponse = {
  id: string;
  trip_id: string;
  user_id: string;
  question: string;
  answer: string | null;
  created_at: string;
};

export type LocationUpdate = {
  id: string;
  trip_id: string;
  user_id: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  recorded_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  trip_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string | null;
  auth_key: string | null;
  created_at: string;
};

export type GuestDocument = {
  id: string;
  user_id: string;
  trip_id: string | null;
  doc_type: string;
  doc_number_enc: string | null;
  iv: string;
  auth_tag: string;
  expiry_date: string | null;
  issued_country: string | null;
  created_at: string;
  updated_at: string;
};

export type LoginAttempt = {
  id: string;
  phone: string;
  ip: string;
  succeeded: boolean;
  attempted_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: unknown;
  ip: string | null;
  created_at: string;
};

export type TrailLeaderView = {
  trip_id: string;
  trip_code: string;
  trip_name: string;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  leader_id: string | null;
  leader_first_name: string | null;
  leader_last_name: string | null;
  leader_phone: string | null;
  leader_email: string | null;
};