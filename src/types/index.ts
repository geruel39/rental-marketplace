export type AccountType = "individual" | "business";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";
export type ListingStatus = "draft" | "active" | "paused" | "archived";
export type PricingPeriod = "hour" | "day" | "week" | "month";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled_by_renter"
  | "cancelled_by_lister"
  | "disputed";
export type ReviewRole = "as_renter" | "as_lister";
export type StockMovementType =
  | "initial"
  | "adjustment_add"
  | "adjustment_remove"
  | "adjustment_set"
  | "booking_reserved"
  | "booking_released"
  | "booking_returned"
  | "damaged"
  | "lost";
export type PayoutStatus = "pending" | "processing" | "completed" | "failed";
export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "not_tracked";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface BankAccount {
  bank_name: string;
  account_number: string;
  routing_number: string;
  account_holder: string;
}

export interface NotificationPreferences {
  email_bookings: boolean;
  email_messages: boolean;
  email_reviews: boolean;
  email_low_stock: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  bio: string;
  account_type: AccountType;
  business_name: string | null;
  business_registration: string | null;
  website_url: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  verification_status: VerificationStatus;
  id_verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  rating_as_lister: number;
  rating_as_renter: number;
  total_reviews_as_lister: number;
  total_reviews_as_renter: number;
  total_listings: number;
  total_rentals_completed: number;
  response_rate: number;
  response_time_hours: number;
  hitpay_customer_id: string | null;
  payout_bank_account: BankAccount | null;
  payout_email: string | null;
  notification_preferences: NotificationPreferences;
  member_since: string;
  last_active: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  category_id: string | null;
  title: string;
  description: string;
  price_per_hour: number | null;
  price_per_day: number | null;
  price_per_week: number | null;
  price_per_month: number | null;
  primary_pricing_period: PricingPeriod;
  deposit_amount: number;
  minimum_rental_period: number;
  location: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_available: boolean;
  delivery_fee: number;
  delivery_radius_km: number | null;
  pickup_instructions: string | null;
  images: string[];
  brand: string | null;
  model: string | null;
  year: number | null;
  condition: string | null;
  quantity_total: number;
  quantity_available: number;
  quantity_reserved: number;
  low_stock_threshold: number | null;
  track_inventory: boolean;
  sku: string | null;
  rules: string | null;
  cancellation_policy: string;
  instant_book: boolean;
  min_renter_rating: number | null;
  status: ListingStatus;
  views_count: number;
  favorites_count: number;
  is_featured: boolean;
  search_vector: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  listing_id: string;
  renter_id: string;
  lister_id: string;
  start_date: string;
  end_date: string;
  quantity: number;
  pricing_period: PricingPeriod;
  unit_price: number;
  num_units: number;
  subtotal: number;
  delivery_fee: number;
  service_fee_renter: number;
  service_fee_lister: number;
  deposit_amount: number;
  total_price: number;
  lister_payout: number;
  status: BookingStatus;
  message: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  hitpay_payment_request_id: string | null;
  hitpay_payment_id: string | null;
  hitpay_payment_url: string | null;
  hitpay_payment_status: string | null;
  paid_at: string | null;
  payout_at: string | null;
  deposit_returned: boolean;
  renter_reviewed: boolean;
  lister_reviewed: boolean;
  stock_deducted: boolean;
  stock_restored: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  listing_id: string;
  booking_id: string | null;
  user_id: string | null;
  movement_type: StockMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  lister_id: string;
  booking_id: string | null;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payout_method: string | null;
  reference_number: string | null;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  listing_id: string;
  reviewer_id: string;
  reviewee_id: string;
  review_role: ReviewRole;
  overall_rating: number;
  communication_rating: number | null;
  accuracy_rating: number | null;
  condition_rating: number | null;
  value_rating: number | null;
  comment: string | null;
  response: string | null;
  responded_at: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  booking_id: string | null;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count_1: number;
  unread_count_2: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: JsonObject | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  listing_id: string | null;
  booking_id: string | null;
  from_user_id: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface HitPayPaymentRequest {
  amount: number;
  currency: string;
  email: string;
  name: string;
  purpose: string;
  reference_number: string;
  redirect_url: string;
  webhook: string;
}

export type HitPayPaymentResponse = {
  id: string;
  url: string;
  status: string;
  amount?: number;
  currency?: string;
  reference_number?: string;
  payment_type?: string;
  purpose?: string;
  email?: string;
  name?: string;
  redirect_url?: string;
  webhook?: string;
  created_at?: string;
} & Record<string, unknown>;

export interface HitPayWebhookPayload {
  payment_id: string;
  payment_request_id: string;
  status: string;
  reference_number: string;
  amount: number;
  currency: string;
  hmac: string;
}

export type ListingWithOwner = Listing & {
  owner: Profile;
};

export type BookingWithDetails = Booking & {
  listing: Listing;
  renter: Profile;
  lister: Profile;
};

export type ConversationWithDetails = Conversation & {
  other_user: Profile;
  listing?: Listing;
  unread_count: number;
};

export type ReviewWithUsers = Review & {
  reviewer: Profile;
  reviewee: Profile;
};

export interface InventorySummary {
  totalListings: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalItemsAvailable: number;
  totalItemsReserved: number;
}

export interface ListerDashboardStats {
  totalListings: number;
  activeListings: number;
  totalBookings: number;
  pendingRequests: number;
  activeRentals: number;
  completedBookings: number;
  totalEarnings: number;
  averageRating: number;
}

export interface RenterDashboardStats {
  totalBookings: number;
  pendingBookings: number;
  activeRentals: number;
  completedRentals: number;
  totalSpent: number;
  favoritesCount: number;
  averageRating: number;
}

export interface DashboardStats {
  lister: ListerDashboardStats;
  renter: RenterDashboardStats;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface PricingCalculation {
  subtotal: number;
  serviceFeeRenter: number;
  serviceFeeLister: number;
  depositAmount: number;
  deliveryFee: number;
  totalPrice: number;
  listerPayout: number;
  numUnits: number;
  unitPrice: number;
}

export interface ActionResponse {
  success?: string;
  error?: string;
}
