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
const philippineMobilePattern = /^(\+63|0)9\d{9}$/;
const approvedBankNames = [
  "BDO",
  "BPI",
  "Metrobank",
  "Land Bank",
  "Landbank",
  "PNB",
  "Security Bank",
  "UnionBank",
  "Union Bank",
  "RCBC",
  "Chinabank",
  "EastWest Bank",
  "Maybank",
  "AUB",
  "Bank of Commerce",
  "CIMB",
  "GoTyme",
  "Tonik",
  "SeaBank",
];

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

export const individualRegisterSchema = z
  .object({
    first_name: z.string().min(2).max(50),
    last_name: z.string().min(2).max(50),
    display_name: z.string().min(2).max(50),
    email: z.string().email(),
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/(?=.*[A-Z])/, "Must contain uppercase letter")
      .regex(/(?=.*[0-9])/, "Must contain a number"),
    confirm_password: z.string(),
    terms_agreed: z.literal(true, {
      message: "You must agree to the Terms of Service",
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const businessRegisterSchema = z
  .object({
    representative_first_name: z.string().min(2).max(50),
    representative_last_name: z.string().min(2).max(50),
    display_name: z.string().min(2).max(50),
    business_name: z.string().min(2).max(200),
    business_registration: z.string().min(2).max(100),
    email: z.string().email(),
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/(?=.*[A-Z])/, "Must contain uppercase")
      .regex(/(?=.*[0-9])/, "Must contain a number"),
    confirm_password: z.string(),
    terms_agreed: z.literal(true, {
      message: "You must agree to the Terms of Service",
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

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

export const bookingSchema = z.object({
  listing_id: z.string().uuid(),
  rental_units: z.coerce
    .number()
    .int()
    .min(1, "Must rent for at least 1 unit"),
  quantity: z.coerce.number().int().min(1).default(1),
  pricing_period: pricingPeriodSchema,
  message: z.string().max(500).optional(),
});

export const individualVerificationSchema = z.object({
  phone_number: z
    .string()
    .regex(/^(\+63|0)?9\d{9}$/, "Invalid Philippine mobile number"),
  gov_id_document_type: z.enum([
    "national_id",
    "drivers_license",
    "passport",
    "voter_id",
  ]),
});

export const businessVerificationSchema = z.object({
  business_phone: z
    .string()
    .regex(/^(\+63|0)?[0-9]{7,11}$/, "Invalid phone number")
    .optional(),
  business_address: z.string().min(10).max(500),
  tin: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{3}-\d{3}$/, "TIN format: XXX-XXX-XXX-XXX"),
  business_document_type: z.enum([
    "dti_certificate",
    "sec_registration",
    "mayors_permit",
    "bir_certificate",
    "business_permit",
    "other",
  ]),
  rep_gov_id_type: z.enum([
    "national_id",
    "drivers_license",
    "passport",
    "voter_id",
  ]),
});

export const listerCancelSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
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

export const payoutMethodSchema = z
  .object({
    method: z.enum(["bank", "gcash", "maya"]),
    bank_name: z
      .string()
      .trim()
      .min(2, "Bank name is required")
      .max(100, "Bank name is too long")
      .refine(
        (value) =>
          approvedBankNames.some(
            (bankName) => bankName.toLowerCase() === value.toLowerCase(),
          ) || /^[A-Za-z0-9&().,'/\-\s]+$/.test(value),
        "Enter a valid bank name",
      )
      .optional(),
    bank_account_number: z
      .string()
      .trim()
      .regex(/^\d{10,20}$/, "Account number must be 10 to 20 digits")
      .optional(),
    bank_account_name: z
      .string()
      .trim()
      .min(2, "Account name must be at least 2 characters")
      .max(120, "Account name is too long")
      .optional(),
    gcash_phone_number: z
      .string()
      .regex(philippineMobilePattern, "Invalid Philippine mobile number")
      .optional(),
    maya_phone_number: z
      .string()
      .regex(philippineMobilePattern, "Invalid Philippine mobile number")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === "bank") {
      if (!data.bank_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bank name is required",
          path: ["bank_name"],
        });
      }

      if (!data.bank_account_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bank account number is required",
          path: ["bank_account_number"],
        });
      }

      if (!data.bank_account_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bank account name is required",
          path: ["bank_account_name"],
        });
      }
    }

    if (data.method === "gcash" && !data.gcash_phone_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GCash phone number is required",
        path: ["gcash_phone_number"],
      });
    }

    if (data.method === "maya" && !data.maya_phone_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maya phone number is required",
        path: ["maya_phone_number"],
      });
    }
  });

export const kycUploadSchema = z.object({
  user_id: z.string().uuid(),
  document_type: z.enum(["national_id", "drivers_license", "passport"]),
});

export const disputeResolutionSchema = z
  .object({
    booking_id: z.string().uuid(),
    resolution_type: z.enum([
      "full_refund_renter",
      "full_payout_lister",
      "split",
    ]),
    renter_refund_percent: z.coerce.number().min(0).max(100).optional(),
    lister_payout_percent: z.coerce.number().min(0).max(100).optional(),
    resolution_notes: z
      .string()
      .min(10, "Please provide detailed resolution notes"),
    evidence_reviewed: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.resolution_type !== "split") {
      return;
    }

    if (
      data.renter_refund_percent === undefined ||
      data.lister_payout_percent === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Split resolutions require both refund and payout percentages",
        path: ["renter_refund_percent"],
      });
      return;
    }

    if (data.renter_refund_percent + data.lister_payout_percent !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "For split resolutions, renter refund percent and lister payout percent must total 100",
        path: ["lister_payout_percent"],
      });
    }
  });

export const payoutRetrySchema = z.object({
  payout_id: z.string().uuid(),
});

export const feeConfigUpdateSchema = z.object({
  key: z.string(),
  value: z.coerce.number().min(0),
});

// Deprecated compatibility exports for existing actions/components during migration.
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
export const bookingRequestSchema = bookingSchema;

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type IndividualRegisterInput = z.infer<typeof individualRegisterSchema>;
export type BusinessRegisterInput = z.infer<typeof businessRegisterSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type IndividualVerificationInput = z.infer<
  typeof individualVerificationSchema
>;
export type BusinessVerificationInput = z.infer<
  typeof businessVerificationSchema
>;
export type ListerCancelInput = z.infer<typeof listerCancelSchema>;
export type HandoverProofFormInput = z.infer<typeof handoverProofSchema>;
export type ReturnProofFormInput = z.infer<typeof returnProofSchema>;
export type ReturnItemInput = z.infer<typeof returnItemSchema>;
export type ConfirmReturnInput = z.infer<typeof confirmReturnSchema>;
export type MarkDeliveredInput = z.infer<typeof markDeliveredSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>;
export type KYCUploadInput = z.infer<typeof kycUploadSchema>;
export type DisputeResolutionInput = z.infer<typeof disputeResolutionSchema>;
export type PayoutRetryInput = z.infer<typeof payoutRetrySchema>;
export type FeeConfigUpdateInput = z.infer<typeof feeConfigUpdateSchema>;
export type RegisterInput = IndividualRegisterInput;
export type BookingRequestInput = BookingInput;
