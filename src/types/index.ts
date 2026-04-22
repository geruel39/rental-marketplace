export type AccountType = "individual" | "business";
export type VerificationStatus =
  | "incomplete"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  /** @deprecated Legacy value retained until verification flow consumers are migrated. */
  | "unverified"
  /** @deprecated Legacy value retained until verification flow consumers are migrated. */
  | "verified";
export type GovernmentIDType =
  | "national_id"
  | "drivers_license"
  | "passport"
  | "voter_id";
export type BusinessDocumentType =
  | "dti_certificate"
  | "sec_registration"
  | "mayors_permit"
  | "bir_certificate"
  | "business_permit"
  | "other";
export type ListingStatus = "draft" | "active" | "paused" | "archived";
export type PricingPeriod = "hour" | "day" | "week" | "month";
export type BookingStatus =
  | "lister_confirmation"
  | "confirmed"
  | "active"
  | "returned"
  | "completed"
  | "cancelled_by_renter"
  | "cancelled_by_lister"
  | "disputed"
  /** @deprecated Legacy status retained until booking flow consumers are migrated. */
  | "pending"
  /** @deprecated Legacy status retained until booking flow consumers are migrated. */
  | "awaiting_payment"
  /** @deprecated Legacy status retained until booking flow consumers are migrated. */
  | "out_for_delivery";
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
  first_name?: string;
  last_name?: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  bio: string;
  account_type: AccountType;
  business_name: string | null;
  business_registration: string | null;
  representative_first_name?: string;
  representative_last_name?: string;
  terms_agreed_at?: string;
  terms_version?: string;
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

export interface IndividualVerification {
  id: string;
  user_id: string;
  // email_verified and phone_verified are collected but NOT required for listing eligibility
  email_verified: boolean;
  email_verified_at?: string;
  phone_number?: string;
  phone_verified: boolean;
  phone_verified_at?: string;
  gov_id_document_type?: GovernmentIDType;
  gov_id_front_url?: string;
  gov_id_back_url?: string;
  gov_id_submitted_at?: string;
  gov_id_verified: boolean;
  gov_id_verified_at?: string;
  gov_id_rejection_reason?: string;
  selfie_url?: string;
  selfie_submitted_at?: string;
  selfie_verified: boolean;
  selfie_verified_at?: string;
  selfie_rejection_reason?: string;
  overall_status: VerificationStatus;
  overall_approved_at?: string;
  overall_approved_by?: string;
  overall_rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessVerification {
  id: string;
  user_id: string;
  // business_phone is collected but NOT required for listing eligibility
  business_phone?: string;
  business_phone_verified: boolean;
  business_address?: string;
  business_address_verified: boolean;
  tin?: string;
  tin_verified: boolean;
  business_document_type?: BusinessDocumentType;
  business_document_url?: string;
  business_document_submitted_at?: string;
  business_document_verified: boolean;
  business_document_verified_at?: string;
  business_document_rejection_reason?: string;
  rep_gov_id_type?: GovernmentIDType;
  rep_gov_id_front_url?: string;
  rep_gov_id_back_url?: string;
  rep_gov_id_submitted_at?: string;
  rep_gov_id_verified: boolean;
  rep_gov_id_verified_at?: string;
  rep_gov_id_rejection_reason?: string;
  rep_selfie_url?: string;
  rep_selfie_submitted_at?: string;
  rep_selfie_verified: boolean;
  rep_selfie_verified_at?: string;
  rep_selfie_rejection_reason?: string;
  overall_status: VerificationStatus;
  overall_approved_at?: string;
  overall_approved_by?: string;
  overall_rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ListingEligibility {
  allowed: boolean;
  reason?: string;
  message?: string;
}

export type IndividualVerificationStepKey =
  | "gov_id"
  | "selfie"
  | "admin_approval";

export type BusinessVerificationStepKey =
  | "business_details"
  | "business_document"
  | "rep_gov_id"
  | "rep_selfie"
  | "admin_approval";

export type VerificationStepKey =
  | IndividualVerificationStepKey
  | BusinessVerificationStepKey;

export interface VerificationStep {
  key: VerificationStepKey;
  label: string;
  description: string;
  completed: boolean;
  status: "complete" | "pending" | "rejected" | "not_started";
  actionLabel?: string;
  actionUrl?: string;
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
  lister_confirmation_deadline?: string;
  lister_confirmed_at?: string;
  lister_confirmed_by?: string;
  auto_cancelled_reason?: string;
  listing_paused_due_to_cancellation?: boolean;
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

export interface BundlePreviewItem {
  text: string;
  from_name?: string;
  related_title?: string;
  created_at: string;
}

export const NOTIFICATION_CONFIG = {
  new_message: {
    label: "New Message",
    icon: "MessageSquare",
    color: "text-blue-500",
    shouldBundle: true,
    bundleKey: "messages_{userId}",
    bundleTitleTemplate: "You have {count} new message(s)",
    defaultActionUrl: "/dashboard/messages",
    priority: "low",
  },
  review_received: {
    label: "New Review",
    icon: "Star",
    color: "text-yellow-500",
    shouldBundle: true,
    bundleKey: "reviews_{userId}",
    bundleTitleTemplate: "You have {count} new review(s)",
    defaultActionUrl: "/dashboard/reviews",
    priority: "low",
  },
  low_stock: {
    label: "Low Stock",
    icon: "AlertTriangle",
    color: "text-yellow-500",
    shouldBundle: true,
    bundleKey: "low_stock_{userId}",
    bundleTitleTemplate: "{count} of your listing(s) are running low on stock",
    defaultActionUrl: "/dashboard/inventory",
    priority: "medium",
  },
  out_of_stock: {
    label: "Out of Stock",
    icon: "XCircle",
    color: "text-red-500",
    shouldBundle: true,
    bundleKey: "out_of_stock_{userId}",
    bundleTitleTemplate: "{count} of your listing(s) are out of stock",
    defaultActionUrl: "/dashboard/inventory",
    priority: "medium",
  },
  booking_request: {
    label: "Booking Request",
    icon: "CalendarPlus",
    color: "text-brand-navy",
    shouldBundle: true,
    bundleKey: "booking_requests_{userId}",
    bundleTitleTemplate: "You have {count} new booking request(s)",
    defaultActionUrl: "/lister/bookings",
    priority: "medium",
  },
  booking_confirmation_required: {
    label: "Booking Confirmation Required",
    icon: "Clock",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/lister/bookings",
    priority: "medium",
  },
  booking_accepted: {
    label: "Booking Accepted",
    icon: "CheckCircle",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "urgent",
  },
  booking_declined: {
    label: "Booking Declined",
    icon: "XCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/my-rentals",
    priority: "high",
  },
  booking_cancelled: {
    label: "Booking Cancelled",
    icon: "XCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "high",
  },
  booking_completed: {
    label: "Booking Completed",
    icon: "CheckCircle2",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "medium",
  },
  payment_confirmed: {
    label: "Payment Confirmed",
    icon: "CreditCard",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "urgent",
  },
  payment_received: {
    label: "Payment Received",
    icon: "DollarSign",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/earnings",
    priority: "urgent",
  },
  payment_failed: {
    label: "Payment Failed",
    icon: "AlertCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/my-rentals",
    priority: "urgent",
  },
  payout_initiated: {
    label: "Payout Initiated",
    icon: "Banknote",
    color: "text-blue-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/earnings",
    priority: "medium",
  },
  payout_completed: {
    label: "Payout Completed",
    icon: "Banknote",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/earnings",
    priority: "high",
  },
  payout_failed: {
    label: "Payout Failed",
    icon: "AlertCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/settings/payments",
    priority: "urgent",
  },
  refund_initiated: {
    label: "Refund Initiated",
    icon: "RefreshCcw",
    color: "text-blue-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "high",
  },
  refund_completed: {
    label: "Refund Completed",
    icon: "RefreshCcw",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "high",
  },
  dispute_raised: {
    label: "Dispute Raised",
    icon: "AlertTriangle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "urgent",
  },
  dispute_resolved: {
    label: "Dispute Resolved",
    icon: "Shield",
    color: "text-blue-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "high",
  },
  rental_started: {
    label: "Rental Started",
    icon: "Play",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "high",
  },
  item_returned: {
    label: "Item Returned",
    icon: "RotateCcw",
    color: "text-blue-500",
    shouldBundle: false,
    defaultActionUrl: "/lister/bookings",
    priority: "high",
  },
  booking_expired: {
    label: "Booking Expired",
    icon: "Clock",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/renter/rentals",
    priority: "high",
  },
  kyc_verified: {
    label: "KYC Verified",
    icon: "BadgeCheck",
    color: "text-green-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/settings/payments",
    priority: "high",
  },
  kyc_rejected: {
    label: "KYC Rejected",
    icon: "AlertCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/settings/payments",
    priority: "urgent",
  },
  payout_retry_requested: {
    label: "Payout Retry Requested",
    icon: "RefreshCw",
    color: "text-orange-500",
    shouldBundle: false,
    defaultActionUrl: "/admin/payouts",
    priority: "high",
  },
  return_condition_issue: {
    label: "Return Condition Issue",
    icon: "AlertTriangle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/dashboard/bookings",
    priority: "urgent",
  },
  admin_alert: {
    label: "Admin Alert",
    icon: "AlertCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/admin",
    priority: "urgent",
  },
  new_kyc_submission: {
    label: "KYC Submission",
    icon: "FileText",
    color: "text-blue-500",
    shouldBundle: true,
    bundleKey: "kyc_submissions_admin",
    bundleTitleTemplate: "{count} new KYC document(s) to review",
    defaultActionUrl: "/admin/kyc-verification",
    priority: "medium",
  },
  system_error: {
    label: "System Error",
    icon: "AlertCircle",
    color: "text-red-500",
    shouldBundle: false,
    defaultActionUrl: "/admin",
    priority: "urgent",
  },
} as const satisfies Record<
  string,
  {
    label: string;
    icon: string;
    color: string;
    shouldBundle: boolean;
    bundleKey?: string;
    bundleTitleTemplate?: string;
    defaultActionUrl: string;
    priority: "low" | "medium" | "high" | "urgent";
  }
>;

export type NotificationType = keyof typeof NOTIFICATION_CONFIG;
export type NotificationConfig = (typeof NOTIFICATION_CONFIG)[NotificationType];

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  listing_id: string | null;
  booking_id: string | null;
  from_user_id: string | null;
  action_url: string | null;
  is_read: boolean;
  bundle_key?: string;
  bundle_count: number;
  is_bundled: boolean;
  bundle_preview: BundlePreviewItem[];
  last_bundled_at?: string;
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
    next_statuses: BookingStatus[];
  }
> = {
  pending: {
    label: "Pending Review",
    color: "bg-yellow-100 text-yellow-800",
    icon: "Clock",
    description: "Legacy status awaiting booking flow migration",
    next_statuses: ["awaiting_payment", "cancelled_by_lister", "cancelled_by_renter"],
  },
  awaiting_payment: {
    label: "Awaiting Payment",
    color: "bg-orange-100 text-orange-800",
    icon: "CreditCard",
    description: "Legacy status awaiting booking flow migration",
    next_statuses: ["confirmed", "cancelled_by_renter", "cancelled_by_lister"],
  },
  lister_confirmation: {
    label: "Awaiting Lister Confirmation",
    color: "bg-orange-100 text-orange-800",
    icon: "Clock",
    description: "Paid - lister must confirm within 24 hours",
    next_statuses: ["confirmed", "cancelled_by_lister", "cancelled_by_renter"],
  },
  out_for_delivery: {
    label: "In Transit",
    color: "bg-blue-100 text-blue-800",
    icon: "Truck",
    description: "Legacy status from the previous fulfillment flow",
    next_statuses: ["active"],
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    icon: "CheckCircle",
    description: "Paid - waiting for lister to hand over item",
    next_statuses: ["active", "cancelled_by_lister", "disputed"],
  },
  active: {
    label: "Active Rental",
    color: "bg-green-100 text-green-800",
    icon: "Play",
    description: "Item with renter - rental period running",
    next_statuses: ["returned", "disputed"],
  },
  returned: {
    label: "Returned",
    color: "bg-indigo-100 text-indigo-800",
    icon: "RotateCcw",
    description: "Item returned - awaiting lister inspection",
    next_statuses: ["completed", "disputed"],
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-100 text-emerald-800",
    icon: "CheckCircle2",
    description: "Rental completed",
    next_statuses: [],
  },
  cancelled_by_renter: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: "XCircle",
    description: "Cancelled by renter",
    next_statuses: [],
  },
  cancelled_by_lister: {
    label: "Declined",
    color: "bg-red-100 text-red-800",
    icon: "XCircle",
    description: "Declined by lister",
    next_statuses: [],
  },
  disputed: {
    label: "Disputed",
    color: "bg-red-100 text-red-800",
    icon: "AlertTriangle",
    description: "Under dispute - admin reviewing",
    next_statuses: ["completed", "cancelled_by_lister"],
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

