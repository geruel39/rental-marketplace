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
  | "awaiting_payment"
  | "confirmed"
  /** @deprecated Legacy status retained temporarily for backward compatibility. */
  | "out_for_delivery"
  | "active"
  | "returned"
  | "completed"
  | "cancelled_by_renter"
  | "cancelled_by_lister"
  | "disputed";
/** @deprecated Deprecated booking fulfillment flow. */
export type FulfillmentType = "pickup" | "delivery";
/** @deprecated Deprecated booking return flow. */
export type ReturnMethod = "pickup_by_lister" | "dropoff_by_renter";
export type ReturnCondition =
  | "excellent"
  | "good"
  | "fair"
  | "damaged"
  | "missing_parts";
export type TimelineActorRole = "system" | "renter" | "lister" | "admin";
export type ReviewRole = "as_renter" | "as_lister";
export type ReportType =
  | "spam"
  | "inappropriate"
  | "fraud"
  | "harassment"
  | "misleading"
  | "counterfeit"
  | "safety"
  | "other";
export type ReportStatus = "open" | "investigating" | "resolved" | "dismissed";
export type AdminTargetType =
  | "user"
  | "listing"
  | "booking"
  | "review"
  | "payout"
  | "category"
  | "report"
  | "settings";
export type ModerationStatus = "pending" | "approved" | "rejected" | "flagged";
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
export type PayoutMethod = "bank" | "gcash" | "maya";
export type PaymentEventType =
  | "payment_initiated"
  | "payment_completed"
  | "payment_failed"
  | "payment_expired"
  | "refund_initiated"
  | "refund_completed"
  | "refund_failed"
  | "payout_initiated"
  | "payout_completed"
  | "payout_failed"
  | "payout_retry_requested"
  | "dispute_hold"
  | "dispute_released_lister"
  | "dispute_released_renter"
  | "dispute_split";
export type RefundReason =
  | "booking_cancelled_by_renter"
  | "booking_cancelled_by_lister"
  | "booking_declined"
  | "payment_expired"
  | "dispute_resolved_renter"
  | "dispute_split"
  | "admin_manual_refund";
export type PayoutTrigger =
  | "auto_after_completion"
  | "admin_manual"
  | "dispute_resolved"
  | "retry_after_failure";
export type DisputeResolutionType =
  | "full_refund_renter"
  | "full_payout_lister"
  | "split";
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
  payout_method?: PayoutMethod;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_kyc_verified?: boolean;
  bank_kyc_document_url?: string;
  bank_kyc_verified_at?: string;
  gcash_phone_number?: string;
  maya_phone_number?: string;
  payout_setup_completed?: boolean;
  payout_setup_completed_at?: string;
  /** @deprecated Replaced by specific payout fields. */
  payout_bank_account?: BankAccount | null;
  /** @deprecated Replaced by payout method-specific fields. */
  payout_email?: string | null;
  notification_preferences: NotificationPreferences;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  suspended_by: string | null;
  admin_notes: string | null;
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
  is_flagged: boolean;
  flagged_reason: string | null;
  moderation_status: ModerationStatus;
  moderation_notes: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
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
  rental_units: number;
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
  fulfillment_type?: string;
  /** @deprecated Legacy delivery field retained for compatibility. */
  delivery_address?: string;
  /** @deprecated Legacy delivery field retained for compatibility. */
  delivery_city?: string;
  /** @deprecated Legacy delivery field retained for compatibility. */
  delivery_state?: string;
  /** @deprecated Legacy delivery field retained for compatibility. */
  delivery_postal_code?: string;
  /** @deprecated Legacy delivery field retained for compatibility. */
  delivery_latitude?: number;
  /** @deprecated Legacy delivery field retained for compatibility. */
  delivery_longitude?: number;
  /** @deprecated Legacy fulfillment scheduling field retained for compatibility. */
  delivery_scheduled_at?: string;
  /** @deprecated Legacy fulfillment field retained for compatibility. */
  delivery_notes?: string;
  /** @deprecated Legacy fulfillment field retained for compatibility. */
  delivered_at?: string;
  /** @deprecated Legacy fulfillment scheduling field retained for compatibility. */
  pickup_scheduled_at?: string;
  /** @deprecated Legacy fulfillment field retained for compatibility. */
  pickup_notes?: string;
  /** @deprecated Legacy fulfillment field retained for compatibility. */
  picked_up_at?: string;
  /** @deprecated Legacy return scheduling field retained for compatibility. */
  return_method?: string;
  /** @deprecated Legacy return scheduling field retained for compatibility. */
  return_scheduled_at?: string;
  rental_started_at?: string;
  rental_ends_at?: string;
  handover_proof_urls: string[];
  handover_at?: string;
  handover_notes?: string;
  return_proof_urls: string[];
  return_notes?: string;
  returned_at?: string;
  return_condition?: ReturnCondition;
  return_condition_notes?: string;
  payment_expires_at?: string;
  stock_reserved?: boolean;
  stock_reserved_at?: string;
  message: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  hitpay_payment_request_id: string | null;
  hitpay_payment_id: string | null;
  hitpay_payment_url: string | null;
  hitpay_payment_status: string | null;
  hitpay_fee?: number;
  net_collected?: number;
  paid_at: string | null;
  payout_at: string | null;
  refund_id?: string;
  refunded_at?: string;
  refund_amount?: number;
  payout_id?: string;
  last_webhook_at?: string;
  deposit_returned: boolean;
  renter_reviewed: boolean;
  lister_reviewed: boolean;
  stock_deducted: boolean;
  stock_restored: boolean;
  admin_notes: string | null;
  dispute_resolved_by: string | null;
  dispute_resolved_at: string | null;
  dispute_resolution: string | null;
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
  trigger_type: PayoutTrigger;
  gross_amount: number;
  platform_fee: number;
  hitpay_fee: number;
  net_amount: number;
  currency: string;
  status: PayoutStatus;
  payout_method: string | null;
  reference_number: string | null;
  notes: string | null;
  failure_reason?: string | null;
  retry_count: number;
  last_retry_at?: string | null;
  can_retry: boolean;
  transaction_id?: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  booking_id?: string;
  renter_id: string;
  lister_id: string;
  event_type: PaymentEventType;
  gross_amount: number;
  hitpay_fee: number;
  platform_fee: number;
  net_amount: number;
  currency: string;
  hitpay_payment_request_id?: string;
  hitpay_payment_id?: string;
  hitpay_refund_id?: string;
  hitpay_transfer_id?: string;
  external_reference?: string;
  external_notes?: string;
  status: "pending" | "processing" | "completed" | "failed";
  failure_reason?: string;
  idempotency_key?: string;
  triggered_by?: string;
  triggered_by_role?: "system" | "renter" | "lister" | "admin";
  metadata: Record<string, unknown>;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: string;
  booking_id: string;
  transaction_id?: string;
  renter_id: string;
  refund_reason: RefundReason;
  original_amount: number;
  refund_amount: number;
  platform_fee_retained: number;
  deposit_refund: number;
  cancellation_fee: number;
  cancellation_policy?: string;
  hours_before_start?: number;
  currency: string;
  hitpay_refund_id?: string;
  hitpay_payment_id?: string;
  status: "pending" | "processing" | "completed" | "failed";
  failure_reason?: string;
  note?: string;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DisputeResolution {
  id: string;
  booking_id: string;
  admin_id: string;
  resolution_type: DisputeResolutionType;
  renter_refund_amount: number;
  lister_payout_amount: number;
  platform_keeps_amount: number;
  renter_refund_percent: number;
  lister_payout_percent: number;
  resolution_notes: string;
  evidence_reviewed?: string;
  renter_notified: boolean;
  lister_notified: boolean;
  created_at: string;
}

export interface FeeConfig {
  id: string;
  key: string;
  value: number;
  description?: string;
  updated_at: string;
}

export interface PlatformFees {
  hitpay_percentage_fee: number;
  hitpay_fixed_fee: number;
  platform_service_fee_renter: number;
  platform_service_fee_lister: number;
  platform_absorbs_hitpay_fee: boolean;
  cancellation_flexible_full_refund_hours: number;
  cancellation_moderate_full_refund_hours: number;
  cancellation_strict_full_refund_hours: number;
  payout_delay_days: number;
  max_payout_retry_count: number;
}

export interface CancellationRefundCalculation {
  refund_amount: number;
  cancellation_fee: number;
  platform_fee_retained: number;
  deposit_refund: number;
  reason: string;
  policy_applied: string;
  hours_since_payment?: number;
  full_refund_threshold_hours?: number;
}

export interface PaymentBreakdown {
  subtotal: number;
  service_fee_renter: number;
  deposit_amount: number;
  hitpay_fee: number;
  platform_absorbs_hitpay: boolean;
  total_charged_to_renter: number;
  lister_gross: number;
  service_fee_lister: number;
  lister_payout: number;
  platform_total_kept: number;
}

export interface Review {
  id: string;
  booking_id: string;
  listing_id: string;
  reviewer_id: string;
  reviewee_id: string;
  review_role: ReviewRole;
  overall_rating: number;
  communication_rating?: number | null;
  accuracy_rating?: number | null;
  condition_rating?: number | null;
  value_rating?: number | null;
  comment: string | null;
  response: string | null;
  responded_at: string | null;
  is_public: boolean;
  is_flagged: boolean;
  is_hidden: boolean;
  flagged_reason: string | null;
  moderated_by: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id?: string | null;
  reported_listing_id?: string | null;
  reported_review_id?: string | null;
  reported_message_id?: string | null;
  report_type: ReportType;
  description: string;
  status: ReportStatus;
  admin_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: AdminTargetType;
  target_id: string;
  details: JsonObject;
  ip_address?: string | null;
  created_at: string;
}

export type PlatformSettings = JsonObject;

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
  timeline?: BookingTimelineWithActor[];
};

export interface BookingTimeline {
  id: string;
  booking_id: string;
  status: BookingStatus;
  previous_status?: BookingStatus;
  actor_id?: string;
  actor_role: TimelineActorRole;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type BookingTimelineWithActor = BookingTimeline & {
  actor?: Profile;
};

export type TransactionWithDetails = Transaction & {
  renter: Profile;
  lister: Profile;
  booking?: Booking;
};

export type RefundWithDetails = Refund & {
  renter: Profile;
  booking: Booking;
};

export type PayoutWithDetails = Payout & {
  lister: Profile;
  booking: Booking;
};

export type DisputeResolutionWithAdmin = DisputeResolution & {
  admin: Profile;
};

/** @deprecated Deprecated delivery address model retained for compatibility. */
export type DeliveryAddress = {
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
};

export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    color: string;
    icon: string;
    description: string;
    next: BookingStatus[];
  }
> = {
  pending: {
    label: "Pending Review",
    color: "bg-yellow-100 text-yellow-800",
    icon: "Clock",
    description: "Waiting for lister to review",
    next: ["awaiting_payment", "cancelled_by_lister", "cancelled_by_renter"],
  },
  awaiting_payment: {
    label: "Awaiting Payment",
    color: "bg-orange-100 text-orange-800",
    icon: "CreditCard",
    description: "Accepted - waiting for renter to pay",
    next: ["confirmed", "cancelled_by_renter", "cancelled_by_lister"],
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    icon: "CheckCircle",
    description: "Paid - waiting for lister to hand over item",
    next: ["active", "cancelled_by_lister", "disputed"],
  },
  out_for_delivery: {
    label: "In Transit",
    color: "bg-blue-100 text-blue-800",
    icon: "Truck",
    description: "Deprecated status from previous fulfillment flow",
    next: ["active"],
  },
  active: {
    label: "Active Rental",
    color: "bg-green-100 text-green-800",
    icon: "Play",
    description: "Item with renter - rental period running",
    next: ["returned", "disputed"],
  },
  returned: {
    label: "Returned",
    color: "bg-indigo-100 text-indigo-800",
    icon: "RotateCcw",
    description: "Item returned - awaiting lister inspection",
    next: ["completed", "disputed"],
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-100 text-emerald-800",
    icon: "CheckCircle2",
    description: "Rental completed",
    next: [],
  },
  cancelled_by_renter: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: "XCircle",
    description: "Cancelled by renter",
    next: [],
  },
  cancelled_by_lister: {
    label: "Declined",
    color: "bg-red-100 text-red-800",
    icon: "XCircle",
    description: "Declined by lister",
    next: [],
  },
  disputed: {
    label: "Disputed",
    color: "bg-red-100 text-red-800",
    icon: "AlertTriangle",
    description: "Under dispute - admin reviewing",
    next: ["completed", "cancelled_by_lister"],
  },
};

export interface HandoverProofInput {
  booking_id: string;
  proof_photos: File[];
  notes?: string;
}

export interface ReturnProofInput {
  booking_id: string;
  proof_photos: File[];
  notes?: string;
}

export type ConversationWithDetails = Conversation & {
  other_user: Profile;
  listing?: Listing;
  unread_count: number;
};

export type ReviewWithUsers = Review & {
  reviewer: Profile;
  reviewee: Profile;
  listing?: Listing;
};

export type ReportWithDetails = Report & {
  reporter: Profile;
  reported_user?: Profile;
  reported_listing?: Listing;
  reported_review?: Review;
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
  itemsRentedOut: number;
  earningsThisMonth: number;
  inventorySummary: InventorySummary;
  lowStockListings: Listing[];
  recentIncomingRequests: BookingWithDetails[];
}

export interface RenterDashboardStats {
  totalBookings: number;
  pendingBookings: number;
  activeRentals: number;
  completedRentals: number;
  totalSpent: number;
  favoritesCount: number;
  averageRating: number;
  pendingRequests: number;
  recentRentals: BookingWithDetails[];
}

export interface DashboardStats {
  lister: ListerDashboardStats;
  renter: RenterDashboardStats;
  notifications: Notification[];
  pendingReviewsCount: number;
  pendingReviewsAsLister: number;
  pendingReviewsAsRenter: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  newUsersThisMonth: number;
  totalListings: number;
  activeListings: number;
  flaggedListings: number;
  totalBookings: number;
  activeBookings: number;
  disputedBookings: number;
  totalRevenue: number;
  revenueThisMonth: number;
  platformFeesFromRentersThisMonth: number;
  platformFeesFromListersThisMonth: number;
  platformFeesCollectedThisMonth: number;
  hitpayFeesAbsorbedThisMonth: number;
  netPlatformRevenueThisMonth: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
  openReports: number;
  totalInventoryItems: number;
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

export interface PayoutMethodDetails {
  method: PayoutMethod;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_kyc_verified?: boolean;
  gcash_phone_number?: string;
  maya_phone_number?: string;
}

export interface PayoutSetupStatus {
  is_complete: boolean;
  current_method?: PayoutMethod;
  missing_fields?: string[];
  kyc_status?: "not_submitted" | "pending" | "verified" | "rejected";
}

