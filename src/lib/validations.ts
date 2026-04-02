import { z } from "zod";

const pricingPeriodSchema = z.enum(["hour", "day", "week", "month"]);
const cancellationPolicySchema = z.enum(["flexible", "moderate", "strict"]);
const stockAdjustmentTypeSchema = z.enum([
  "adjustment_add",
  "adjustment_remove",
  "adjustment_set",
  "damaged",
  "lost",
]);
const dateValueSchema = z.string().or(z.date());

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6).max(72),
    confirmPassword: z.string(),
    full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
    display_name: z.string().min(2).max(50).optional(),
    account_type: z.enum(["individual", "business"]).default("individual"),
    business_name: z.string().min(2).max(200).optional(),
    business_registration: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => data.account_type !== "business" || Boolean(data.business_name),
    {
      message: "Business name is required",
      path: ["business_name"],
    },
  );

export const listingSchema = z
  .object({
    title: z.string().min(3).max(100),
    description: z.string().min(20).max(5000),
    category_id: z.string().uuid().optional(),
    price_per_hour: z.coerce.number().positive().optional(),
    price_per_day: z.coerce.number().positive().optional(),
    price_per_week: z.coerce.number().positive().optional(),
    price_per_month: z.coerce.number().positive().optional(),
    primary_pricing_period: pricingPeriodSchema.default("day"),
    deposit_amount: z.coerce.number().min(0).default(0),
    minimum_rental_period: z.coerce.number().int().min(1).default(1),
    location: z.string().min(2),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    delivery_available: z.boolean().default(false),
    delivery_fee: z.coerce.number().min(0).default(0),
    delivery_radius_km: z.coerce.number().int().optional(),
    images: z.array(z.string()).min(1, "At least one image required"),
    brand: z.string().optional(),
    model: z.string().optional(),
    condition: z.string().optional(),
    quantity_total: z.coerce.number().int().min(1).default(1),
    track_inventory: z.boolean().default(true),
    low_stock_threshold: z.coerce.number().int().min(0).default(1),
    sku: z.string().max(50).optional(),
    rules: z.string().max(2000).optional(),
    cancellation_policy: cancellationPolicySchema.default("flexible"),
    instant_book: z.boolean().default(false),
    min_renter_rating: z.coerce.number().min(0).max(5).optional(),
  })
  .refine(
    (data) =>
      data.price_per_hour !== undefined ||
      data.price_per_day !== undefined ||
      data.price_per_week !== undefined ||
      data.price_per_month !== undefined,
    {
      message: "At least one price field is required",
      path: ["price_per_day"],
    },
  );

export const bookingRequestSchema = z.object({
  listing_id: z.string().uuid(),
  rental_units: z.coerce
    .number()
    .int()
    .min(1, "Must rent for at least 1 unit"),
  start_date: dateValueSchema,
  end_date: dateValueSchema,
  quantity: z.coerce.number().int().min(1).default(1),
  pricing_period: pricingPeriodSchema,
  fulfillment_type: z.enum(["pickup", "delivery"]).default("pickup"),
  delivery_address: z.string().min(5).optional(),
  delivery_city: z.string().min(2).optional(),
  delivery_state: z.string().optional(),
  delivery_postal_code: z.string().min(3).optional(),
  delivery_notes: z.string().max(500).optional(),
  delivery_scheduled_at: z.string().optional(),
  pickup_scheduled_at: z.string().optional(),
  pickup_notes: z.string().max(500).optional(),
  message: z.string().max(500).optional(),
});

export const handoverProofSchema = z.object({
  booking_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const returnProofSchema = z.object({
  booking_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

// Deprecated compatibility exports for existing components/actions.
export const returnItemSchema = z.object({
  booking_id: z.string().uuid(),
  return_method: z.enum(["pickup_by_lister", "dropoff_by_renter"]),
  return_scheduled_at: z.string(),
  return_notes: z.string().max(500).optional(),
});

export const confirmReturnSchema = z.object({
  booking_id: z.string().uuid(),
  return_condition: z.enum([
    "excellent",
    "good",
    "fair",
    "damaged",
    "missing_parts",
  ]),
  return_condition_notes: z.string().max(1000).optional(),
});

// Deprecated compatibility export for existing actions.
export const markDeliveredSchema = z.object({
  booking_id: z.string().uuid(),
  delivery_notes: z.string().max(500).optional(),
});

export const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  overall_rating: z.coerce.number().int().min(1).max(5),
  communication_rating: z.coerce.number().int().min(1).max(5).optional(),
  accuracy_rating: z.coerce.number().int().min(1).max(5).optional(),
  condition_rating: z.coerce.number().int().min(1).max(5).optional(),
  value_rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

export const messageSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  recipient_id: z.string().uuid().optional(),
  content: z.string().min(1).max(2000),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  display_name: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal("")),
});

export const stockAdjustmentSchema = z.object({
  listing_id: z.string().uuid(),
  adjustment_type: stockAdjustmentTypeSchema,
  quantity: z.coerce.number().int().min(1),
  reason: z.string().min(3, "Reason is required").max(500),
});

export const payoutSettingsSchema = z.object({
  payout_email: z.string().email().optional(),
  payout_bank_account: z
    .object({
      bank_name: z.string().min(2),
      account_number: z.string().min(4),
      routing_number: z.string().optional(),
      account_holder: z.string().min(2),
    })
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
export type HandoverProofFormInput = z.infer<typeof handoverProofSchema>;
export type ReturnProofFormInput = z.infer<typeof returnProofSchema>;
export type ReturnItemInput = z.infer<typeof returnItemSchema>;
export type ConfirmReturnInput = z.infer<typeof confirmReturnSchema>;
export type MarkDeliveredInput = z.infer<typeof markDeliveredSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type PayoutSettingsInput = z.infer<typeof payoutSettingsSchema>;
