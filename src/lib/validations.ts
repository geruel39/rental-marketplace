import { z } from "zod";

const accountTypeSchema = z.enum(["individual", "business"]);
const pricingPeriodSchema = z.enum(["hour", "day", "week", "month"]);
const stockMovementTypeSchema = z.enum([
  "initial",
  "adjustment_add",
  "adjustment_remove",
  "adjustment_set",
  "booking_reserved",
  "booking_released",
  "booking_returned",
  "damaged",
  "lost",
]);
const reviewRoleSchema = z.enum(["as_renter", "as_lister"]);

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registerSchema = z
  .object({
    email: z.email("Please enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    confirmPassword: z.string(),
    full_name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(120, "Full name must be 120 characters or fewer."),
    display_name: z
      .string()
      .trim()
      .min(2, "Display name must be at least 2 characters.")
      .max(80, "Display name must be 80 characters or fewer."),
    account_type: accountTypeSchema.default("individual"),
    business_name: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }

    if (data.account_type === "business" && !data.business_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["business_name"],
        message: "Business name is required for business accounts.",
      });
    }
  });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  display_name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(30).optional(),
  account_type: accountTypeSchema,
  business_name: z.string().trim().max(120).optional(),
  business_registration: z.string().trim().max(120).optional(),
  website_url: z.url("Please enter a valid website URL.").optional().or(z.literal("")),
  location: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(80).default("US"),
  payout_email: z.email("Please enter a valid payout email.").optional().or(z.literal("")),
});

export const listingSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(5000),
    category_id: z.string().uuid().optional(),
    price_per_hour: z.number().nonnegative().optional(),
    price_per_day: z.number().nonnegative().optional(),
    price_per_week: z.number().nonnegative().optional(),
    price_per_month: z.number().nonnegative().optional(),
    primary_pricing_period: pricingPeriodSchema.default("day"),
    deposit_amount: z.number().nonnegative().default(0),
    minimum_rental_period: z.number().int().positive().default(1),
    location: z.string().trim().min(2).max(160),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    delivery_available: z.boolean().default(false),
    delivery_fee: z.number().nonnegative().default(0),
    delivery_radius_km: z.number().int().nonnegative().optional(),
    pickup_instructions: z.string().trim().max(1000).optional(),
    images: z.array(z.string()).max(12).default([]),
    brand: z.string().trim().max(80).optional(),
    model: z.string().trim().max(80).optional(),
    year: z.number().int().min(1900).max(3000).optional(),
    condition: z.string().trim().max(80).optional(),
    quantity_total: z.number().int().min(0).default(1),
    quantity_available: z.number().int().min(0).default(1),
    quantity_reserved: z.number().int().min(0).default(0),
    low_stock_threshold: z.number().int().min(0).optional(),
    track_inventory: z.boolean().default(true),
    sku: z.string().trim().max(80).optional(),
    rules: z.string().trim().max(2000).optional(),
    cancellation_policy: z.string().trim().max(120).default("flexible"),
    instant_book: z.boolean().default(false),
    min_renter_rating: z.number().min(0).max(5).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPrice =
      data.price_per_hour !== undefined ||
      data.price_per_day !== undefined ||
      data.price_per_week !== undefined ||
      data.price_per_month !== undefined;

    if (!hasPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price_per_day"],
        message: "At least one rental price is required.",
      });
    }

    if (data.quantity_available + data.quantity_reserved > data.quantity_total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity_available"],
        message: "Available and reserved stock cannot exceed total stock.",
      });
    }

    if (
      data.primary_pricing_period === "hour" &&
      data.price_per_hour === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primary_pricing_period"],
        message: "Primary pricing period must have a matching price.",
      });
    }

    if (data.primary_pricing_period === "day" && data.price_per_day === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primary_pricing_period"],
        message: "Primary pricing period must have a matching price.",
      });
    }

    if (
      data.primary_pricing_period === "week" &&
      data.price_per_week === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primary_pricing_period"],
        message: "Primary pricing period must have a matching price.",
      });
    }

    if (
      data.primary_pricing_period === "month" &&
      data.price_per_month === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primary_pricing_period"],
        message: "Primary pricing period must have a matching price.",
      });
    }
  });

export const bookingRequestSchema = z
  .object({
    listing_id: z.string().uuid(),
    start_date: z.string().date(),
    end_date: z.string().date(),
    quantity: z.number().int().positive().default(1),
    pricing_period: pricingPeriodSchema,
    message: z.string().trim().max(1000).optional(),
    delivery_fee: z.number().nonnegative().default(0),
    deposit_amount: z.number().nonnegative().default(0),
  })
  .superRefine((data, ctx) => {
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_date"],
        message: "Booking dates must be valid.",
      });
      return;
    }

    if (endDate <= startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "End date must be after start date.",
      });
    }
  });

export const stockAdjustmentSchema = z.object({
  listing_id: z.string().uuid(),
  adjustment_type: stockMovementTypeSchema,
  quantity: z.number().int().nonnegative(),
  reason: z.string().trim().max(500).optional(),
});

export const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  listing_id: z.string().uuid(),
  reviewee_id: z.string().uuid(),
  review_role: reviewRoleSchema,
  overall_rating: z.number().int().min(1).max(5),
  communication_rating: z.number().int().min(1).max(5).optional(),
  accuracy_rating: z.number().int().min(1).max(5).optional(),
  condition_rating: z.number().int().min(1).max(5).optional(),
  value_rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
