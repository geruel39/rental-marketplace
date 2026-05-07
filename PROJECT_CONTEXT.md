# RentHub Project Context

## 1. Project Overview

RentHub is a peer-to-peer rental marketplace built around the idea that any authenticated user can participate on both sides of a transaction. Users can browse listings, favorite items, message other users, book rentals, pay through HitPay, manage proof-based handovers and returns, leave reviews, and track notifications, payouts, disputes, and verification status.

The product model is explicitly dual-role. A single account can act as a renter when booking other users' items and as a lister when creating and managing listings. The UI reflects this with dedicated `/renter/*` and `/lister/*` shells, while shared account concerns live under `/account/*`. Older `/dashboard/*` routes still exist, but `next.config.ts` redirects most of them to the newer renter/lister/account structure.

The main product differentiators implemented in code are: paid bookings that can either auto-confirm (`instant_book`) or wait for lister confirmation, inventory-aware stock reservation at payment time, photo-proof handover and return flows, payout-method gating before listing creation, dispute handling with admin resolution, and operational tooling for moderation, KYC, payouts, fee settings, and reporting.

## 2. Tech Stack

Note: the prompt says Next.js 14, but `package.json` currently uses `next@^16.2.4`.

### Core Framework

| Dependency | Version | Why it is used |
|---|---:|---|
| `next` | `^16.2.4` | App Router framework, routing, server actions, API routes, SSR. |
| `react` | `19.2.4` | UI runtime. |
| `react-dom` | `19.2.4` | DOM renderer for React. |
| `typescript` | `^5` | Strictly typed app code. |

### Database & Auth

| Dependency | Version | Why it is used |
|---|---:|---|
| `@supabase/supabase-js` | `^2.99.3` | Supabase database, auth, storage, realtime, RPC access. |
| `@supabase/ssr` | `^0.9.0` | Supabase SSR/browser client helpers for App Router. |

### Payments

| Dependency | Version | Why it is used |
|---|---:|---|
| No dedicated HitPay SDK | n/a | HitPay is integrated through direct `fetch` calls to sandbox REST endpoints. |

### Email

| Dependency | Version | Why it is used |
|---|---:|---|
| `resend` | `^6.1.3` | Transactional email delivery. |
| `@react-email/components` | `^1.0.12` | Email-safe React components. |
| `@react-email/render` | `^2.0.7` | Renders React Email templates to HTML. |

### UI Components

| Dependency | Version | Why it is used |
|---|---:|---|
| `tailwindcss` | `^4` | Utility-first styling. |
| `@tailwindcss/postcss` | `^4` | Tailwind/PostCSS integration. |
| `lucide-react` | `^0.577.0` | Icons. |
| `radix-ui` | `^1.4.3` | Primitive UI building blocks used by shadcn components. |
| `cmdk` | `^1.1.1` | Command palette foundation for the command component. |
| `react-day-picker` | `^9.14.0` | Calendar/date selection. |
| `sonner` | `^2.0.7` | Toast notifications. |
| `next-themes` | `^0.4.6` | Theme-aware toaster support; dark variables also exist in CSS. |
| `class-variance-authority` | `^0.7.1` | Variant-based class composition in shadcn-style components. |
| `clsx` | `^2.1.1` | Conditional class joining. |
| `tailwind-merge` | `^3.5.0` | Tailwind class conflict resolution. |

### Forms & Validation

| Dependency | Version | Why it is used |
|---|---:|---|
| `react-hook-form` | `^7.71.2` | Client form state. |
| `@hookform/resolvers` | `^5.2.2` | Zod + React Hook Form integration. |
| `zod` | `^4.3.6` | Runtime schema validation. |

### Utilities

| Dependency | Version | Why it is used |
|---|---:|---|
| `date-fns` | `^4.1.0` | Date math, formatting, deadlines, booking duration logic. |

### Dev Dependencies

| Dependency | Version | Why it is used |
|---|---:|---|
| `eslint` | `^9` | Linting. |
| `eslint-config-next` | `16.2.0` | Next.js lint rules. |
| `@types/node` | `^20` | Node typings. |
| `@types/react` | `^19` | React typings. |
| `@types/react-dom` | `^19` | React DOM typings. |

## 3. Environment Variables

| Variable | Purpose | Example / Source | Required |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for browser/server SSR clients. | `https://<project>.supabase.co` from Supabase project settings. | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for SSR/browser auth and data access. | Supabase API settings. | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client key for webhooks and privileged server-side operations. | Supabase API settings. | Required for admin/webhooks |
| `NEXT_PUBLIC_APP_URL` | Canonical app base URL used in auth redirects and email links. | `http://localhost:3000` or production domain. | Required by `getAppUrl()` |
| `HITPAY_API_KEY` | HitPay business API key. | HitPay sandbox business dashboard. | Required for payment/payout/refund API calls |
| `HITPAY_WEBHOOK_SALT` | Secret used to validate HitPay webhook signatures. | HitPay webhook configuration. | Required for webhook verification |
| `NEXT_PUBLIC_HITPAY_API_URL` | Override for HitPay API base URL. Defaults to sandbox. | `https://api.sandbox.hit-pay.com/v1` | Optional |
| `RESEND_API_KEY` | Resend API key. | Resend dashboard. | Optional in development, required to actually send mail |
| `RESEND_FROM_EMAIL` | Sender email address used in `FROM`. | `noreply@renthub.com` | Optional with fallback |
| `RESEND_FROM_NAME` | Sender display name used in `FROM`. | `RentHub` | Optional with fallback |
| `CRON_SECRET` | Shared secret for `/api/cron/check-deadlines`. | Arbitrary secret string. | Required for cron route auth |
| `NODE_ENV` | Used to block `/api/test-email` in production. | `development` / `production` | Standard |

## 4. Database Schema

### Important Schema State

The repo has two schema layers:

1. `sql/schema.sql`, `sql/payout.sql`, `sql/admin.sql`, and `sql/mark-item-returned-by-renter.sql` define the checked-in SQL schema.
2. The TypeScript app expects additional newer columns/functions/tables that are **not fully represented in the checked-in SQL**.

Where this happens, the table docs below call out:

- `SQL columns`: columns explicitly present in checked-in SQL.
- `App-expected additions`: fields referenced by the TypeScript app but missing from the checked-in SQL migrations.

### `profiles`

Purpose: user identity, trust, admin flags, payout setup, and account metadata.

SQL columns:

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | — | PK; references `auth.users.id`. |
| `email` | `text` | Yes | `''` | Email; intentionally not `NOT NULL`. |
| `full_name` | `text` | Yes | `''` | Full display name. |
| `display_name` | `text` | Yes | `''` | Public display name. |
| `avatar_url` | `text` | Yes | `null` | Avatar image URL. |
| `phone` | `text` | Yes | `null` | Phone number. |
| `bio` | `text` | Yes | `''` | Profile bio. |
| `account_type` | `account_type` | Yes | `'individual'` | Individual or business. |
| `business_name` | `text` | Yes | `null` | Business name. |
| `business_registration` | `text` | Yes | `null` | Business registration number. |
| `website_url` | `text` | Yes | `null` | Website URL. |
| `location` | `text` | Yes | `null` | Freeform location. |
| `city` | `text` | Yes | `null` | City. |
| `state` | `text` | Yes | `null` | State/region. |
| `country` | `text` | Yes | `'US'` | Country. |
| `latitude` | `decimal(10,7)` | Yes | `null` | Geo latitude. |
| `longitude` | `decimal(10,7)` | Yes | `null` | Geo longitude. |
| `verification_status` | `verification_status` | Yes | `'unverified'` | Legacy profile-level verification state. |
| `id_verified` | `boolean` | Yes | `false` | Legacy ID flag. |
| `email_verified` | `boolean` | Yes | `false` | Email verified flag. |
| `phone_verified` | `boolean` | Yes | `false` | Phone verified flag. |
| `rating_as_lister` | `decimal(3,2)` | Yes | `0` | Average rating as lister. |
| `rating_as_renter` | `decimal(3,2)` | Yes | `0` | Average rating as renter. |
| `total_reviews_as_lister` | `integer` | Yes | `0` | Count of lister reviews. |
| `total_reviews_as_renter` | `integer` | Yes | `0` | Count of renter reviews. |
| `total_listings` | `integer` | Yes | `0` | Listing count. |
| `total_rentals_completed` | `integer` | Yes | `0` | Completed rental count. |
| `response_rate` | `decimal(5,2)` | Yes | `100` | Response-rate metric. |
| `response_time_hours` | `integer` | Yes | `0` | Response-time metric. |
| `hitpay_customer_id` | `text` | Yes | `null` | HitPay customer reference. |
| `payout_bank_account` | `jsonb` | Yes | `null` | Deprecated payout bank JSON. |
| `payout_email` | `text` | Yes | `null` | Deprecated payout email. |
| `notification_preferences` | `jsonb` | Yes | JSON default | Email preference flags. |
| `member_since` | `timestamptz` | Yes | `now()` | Membership start. |
| `last_active` | `timestamptz` | Yes | `now()` | Last active time. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |
| `updated_at` | `timestamptz` | Yes | `now()` | Updated timestamp. |
| `is_admin` | `boolean` | Yes | `false` | Added in `sql/admin.sql`. |
| `is_suspended` | `boolean` | Yes | `false` | Suspension flag. |
| `suspended_at` | `timestamptz` | Yes | `null` | Suspension time. |
| `suspended_reason` | `text` | Yes | `null` | Suspension reason. |
| `suspended_by` | `uuid` | Yes | `null` | Admin who suspended. |
| `admin_notes` | `text` | Yes | `null` | Internal notes. |

App-expected additions not present in checked-in SQL:

- `first_name`
- `last_name`
- `representative_first_name`
- `representative_last_name`
- `terms_agreed_at`
- `terms_version`
- `payout_method`
- `bank_name`
- `bank_account_number`
- `bank_account_name`
- `bank_kyc_verified`
- `bank_kyc_document_url`
- `bank_kyc_verified_at`
- `gcash_phone_number`
- `maya_phone_number`
- `payout_setup_completed`
- `payout_setup_completed_at`

FKs:

- `id -> auth.users(id)`
- `suspended_by -> profiles(id)`

Indexes:

- `idx_profiles_admin`
- `idx_profiles_suspended`

RLS:

- Public select.
- Open insert policy to avoid signup/trigger failure.
- Users may update only their own row.

### `categories`

Purpose: category taxonomy for listings.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `name` | `text` | No | — | Unique category name. |
| `slug` | `text` | No | — | Unique slug used in search/filter URLs. |
| `icon` | `text` | Yes | `null` | Display icon/emoji. |
| `description` | `text` | Yes | `null` | Optional description. |
| `parent_id` | `uuid` | Yes | `null` | Self-reference for nesting. |
| `sort_order` | `integer` | Yes | `0` | Sort order. |
| `is_active` | `boolean` | Yes | `true` | Category enabled flag. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |

FKs: `parent_id -> categories(id)`

Indexes: none explicitly defined in SQL.

RLS: not explicitly enabled in checked-in SQL; access is through server/admin clients.

### `listings`

Purpose: rentable inventory listings owned by users.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `owner_id` | `uuid` | No | — | Listing owner. |
| `category_id` | `uuid` | Yes | `null` | Category. |
| `title` | `text` | No | — | Listing title. |
| `description` | `text` | No | `''` | Description. |
| `price_per_hour` | `decimal(10,2)` | Yes | `null` | Hourly price. |
| `price_per_day` | `decimal(10,2)` | Yes | `null` | Daily price. |
| `price_per_week` | `decimal(10,2)` | Yes | `null` | Weekly price. |
| `price_per_month` | `decimal(10,2)` | Yes | `null` | Monthly price. |
| `primary_pricing_period` | `pricing_period` | Yes | `'day'` | Primary displayed unit. |
| `deposit_amount` | `decimal(10,2)` | Yes | `0` | Security deposit per quantity. |
| `minimum_rental_period` | `integer` | Yes | `1` | Minimum units. |
| `location` | `text` | No | `''` | Base location text. |
| `city` | `text` | Yes | `null` | City. |
| `state` | `text` | Yes | `null` | State/region. |
| `latitude` | `decimal(10,7)` | Yes | `null` | Geo latitude. |
| `longitude` | `decimal(10,7)` | Yes | `null` | Geo longitude. |
| `delivery_available` | `boolean` | Yes | `false` | Delivery option. |
| `delivery_fee` | `decimal(10,2)` | Yes | `0` | Delivery fee. |
| `delivery_radius_km` | `integer` | Yes | `null` | Delivery radius. |
| `pickup_instructions` | `text` | Yes | `null` | Pickup notes. |
| `images` | `text[]` | Yes | `'{}'` | Public image URLs. |
| `brand` | `text` | Yes | `null` | Optional brand. |
| `model` | `text` | Yes | `null` | Optional model. |
| `year` | `integer` | Yes | `null` | Optional year. |
| `condition` | `text` | Yes | `null` | Condition label. |
| `quantity_total` | `integer` | No | `1` | Total stock. |
| `quantity_available` | `integer` | No | `1` | Available stock. |
| `quantity_reserved` | `integer` | No | `0` | Reserved stock. |
| `low_stock_threshold` | `integer` | Yes | `1` | Threshold for low stock alerts. |
| `track_inventory` | `boolean` | Yes | `true` | Whether stock is tracked. |
| `sku` | `text` | Yes | `null` | Optional SKU. |
| `rules` | `text` | Yes | `null` | Listing rules. |
| `cancellation_policy` | `text` | Yes | `'flexible'` | Flexible/moderate/strict string. |
| `instant_book` | `boolean` | Yes | `false` | Auto-confirm paid booking. |
| `min_renter_rating` | `decimal(3,2)` | Yes | `null` | Optional renter rating floor. |
| `status` | `listing_status` | Yes | `'active'` | Draft/active/paused/archived. |
| `views_count` | `integer` | Yes | `0` | View counter. |
| `favorites_count` | `integer` | Yes | `0` | Favorite counter. |
| `is_featured` | `boolean` | Yes | `false` | Featured flag. |
| `search_vector` | `tsvector` | Yes | `null` | Full-text search vector. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |
| `updated_at` | `timestamptz` | Yes | `now()` | Updated timestamp. |
| `is_flagged` | `boolean` | Yes | `false` | Added in admin schema. |
| `flagged_reason` | `text` | Yes | `null` | Flag reason. |
| `flagged_at` | `timestamptz` | Yes | `null` | Flag time. |
| `flagged_by` | `uuid` | Yes | `null` | Admin who flagged. |
| `moderation_status` | `text` | Yes | `'approved'` | Pending/approved/rejected/flagged. |
| `moderation_notes` | `text` | Yes | `null` | Internal moderation notes. |
| `moderated_by` | `uuid` | Yes | `null` | Admin who moderated. |
| `moderated_at` | `timestamptz` | Yes | `null` | Moderation time. |

FKs:

- `owner_id -> profiles(id)`
- `category_id -> categories(id)`
- `flagged_by -> profiles(id)`
- `moderated_by -> profiles(id)`

Indexes:

- `idx_listings_search`
- `idx_listings_owner`
- `idx_listings_category`
- `idx_listings_status`
- `idx_listings_city`
- `idx_listings_price`
- `idx_listings_created`
- `idx_listings_stock`
- `idx_listings_low_stock`
- `idx_listings_flagged`
- `idx_listings_moderation`

RLS:

- Public can select active listings; owners can also see their own.
- Owners can insert/update/delete their own listings.

### `bookings`

Purpose: rental bookings, payment state, lifecycle state, and return/dispute metadata.

SQL columns:

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `listing_id` | `uuid` | No | — | Booked listing. |
| `renter_id` | `uuid` | No | — | Renter. |
| `lister_id` | `uuid` | No | — | Lister. |
| `start_date` | `date` | No | — | Start date. |
| `end_date` | `date` | No | — | End date. |
| `quantity` | `integer` | No | `1` | Units of stock reserved. |
| `pricing_period` | `pricing_period` | No | `'day'` | Hour/day/week/month. |
| `unit_price` | `decimal(10,2)` | No | `0` | Unit price. |
| `num_units` | `integer` | No | `1` | Quantity of pricing units. |
| `subtotal` | `decimal(10,2)` | No | `0` | Rental subtotal. |
| `delivery_fee` | `decimal(10,2)` | Yes | `0` | Delivery fee. |
| `service_fee_renter` | `decimal(10,2)` | Yes | `0` | Renter service fee. |
| `service_fee_lister` | `decimal(10,2)` | Yes | `0` | Lister fee deduction. |
| `deposit_amount` | `decimal(10,2)` | Yes | `0` | Deposit total. |
| `total_price` | `decimal(10,2)` | No | `0` | Total charged before HitPay fee overlay. |
| `lister_payout` | `decimal(10,2)` | No | `0` | Target lister payout. |
| `status` | `booking_status` | Yes | `'pending'` | Legacy SQL enum state. |
| `message` | `text` | Yes | `null` | Booking note. |
| `cancelled_at` | `timestamptz` | Yes | `null` | Cancellation time. |
| `cancelled_by` | `uuid` | Yes | `null` | Cancelling user. |
| `cancellation_reason` | `text` | Yes | `null` | Cancellation reason. |
| `hitpay_payment_request_id` | `text` | Yes | `null` | HitPay payment request id. |
| `hitpay_payment_id` | `text` | Yes | `null` | HitPay payment id. |
| `hitpay_payment_url` | `text` | Yes | `null` | Hosted checkout URL. |
| `hitpay_payment_status` | `text` | Yes | `null` | Raw payment status. |
| `paid_at` | `timestamptz` | Yes | `null` | Payment time. |
| `payout_at` | `timestamptz` | Yes | `null` | Payout time. |
| `deposit_returned` | `boolean` | Yes | `false` | Deposit disposition flag. |
| `renter_reviewed` | `boolean` | Yes | `false` | Renter review submitted. |
| `lister_reviewed` | `boolean` | Yes | `false` | Lister review submitted. |
| `stock_deducted` | `boolean` | Yes | `false` | Stock reserved/deducted flag. |
| `stock_restored` | `boolean` | Yes | `false` | Stock returned/released flag. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |
| `updated_at` | `timestamptz` | Yes | `now()` | Updated timestamp. |
| `hitpay_fee` | `decimal(10,2)` | Yes | `0` | Added in payout SQL. |
| `net_collected` | `decimal(10,2)` | Yes | `0` | Gross renter payment collected. |
| `refund_id` | `uuid` | Yes | `null` | Linked refund. |
| `refunded_at` | `timestamptz` | Yes | `null` | Refund time. |
| `refund_amount` | `decimal(10,2)` | Yes | `0` | Refunded amount. |
| `payout_id` | `uuid` | Yes | `null` | Linked payout. |
| `webhook_events` | `jsonb` | Yes | `[]` | Received webhook audit. |
| `last_webhook_at` | `timestamptz` | Yes | `null` | Last webhook receipt. |
| `admin_notes` | `text` | Yes | `null` | Added in admin schema. |
| `dispute_resolved_by` | `uuid` | Yes | `null` | Admin resolver. |
| `dispute_resolved_at` | `timestamptz` | Yes | `null` | Resolution time. |
| `dispute_resolution` | `text` | Yes | `null` | Resolution summary. |

App-expected additions not present in checked-in SQL:

- `rental_units`
- `lister_confirmation_deadline`
- `lister_confirmed_at`
- `lister_confirmed_by`
- `auto_cancelled_reason`
- `listing_paused_due_to_cancellation`
- `fulfillment_type`
- `rental_started_at`
- `rental_ends_at`
- `handover_proof_urls`
- `handover_at`
- `handover_notes`
- `return_proof_urls`
- `return_notes`
- `returned_at`
- `return_condition`
- `return_condition_notes`
- `payment_expires_at`
- `stock_reserved`
- `stock_reserved_at`

FKs:

- `listing_id -> listings(id)`
- `renter_id -> profiles(id)`
- `lister_id -> profiles(id)`
- `cancelled_by -> profiles(id)`
- `refund_id -> refunds(id)`
- `payout_id -> payouts(id)`
- `dispute_resolved_by -> profiles(id)`

Indexes:

- `idx_bookings_renter`
- `idx_bookings_lister`
- `idx_bookings_listing`
- `idx_bookings_status`
- `idx_bookings_dates`

RLS:

- Renters and listers can select their own bookings.
- Inserts require `auth.uid() = renter_id`.
- Updates allowed for either renter or lister.

### `booking_timeline`

Purpose: booking lifecycle audit trail.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `booking_id` | `uuid` | No | — | Booking. |
| `status` | `booking_status` | No | — | Resulting booking status. |
| `previous_status` | `booking_status` | Yes | `null` | Prior status. |
| `actor_id` | `uuid` | Yes | `null` | User/admin actor. |
| `actor_role` | `text` | No | `'system'` | Actor role text. |
| `title` | `text` | No | `''` | Short label. |
| `description` | `text` | Yes | `null` | Long description. |
| `metadata` | `jsonb` | No | `{}` | Structured event metadata. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |

FKs: `booking_id -> bookings(id)`, `actor_id -> profiles(id)`

Index: `idx_booking_timeline_booking_created`

RLS:

- Visible to booking renter/lister and admins (`profiles.is_admin = true`).

### `inventory_movements`

Purpose: stock audit log for manual and booking-driven inventory changes.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `listing_id` | `uuid` | No | — | Listing. |
| `booking_id` | `uuid` | Yes | `null` | Booking if movement is booking-related. |
| `user_id` | `uuid` | Yes | `null` | Actor user. |
| `movement_type` | `stock_movement_type` | No | — | Movement classification. |
| `quantity_change` | `integer` | No | — | Signed change. |
| `quantity_before` | `integer` | No | `0` | Available stock before change. |
| `quantity_after` | `integer` | No | `0` | Available stock after change. |
| `reason` | `text` | Yes | `null` | Human reason. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |

FKs: `listing_id -> listings(id)`, `booking_id -> bookings(id)`, `user_id -> profiles(id)`

Indexes:

- `idx_inventory_movements_listing`
- `idx_inventory_movements_booking`

RLS:

- Listers can select/insert movements only for listings they own.

### `transactions`

Purpose: immutable ledger of payment, refund, payout, and dispute money movements.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `booking_id` | `uuid` | Yes | `null` | Related booking. |
| `renter_id` | `uuid` | No | — | Renter party. |
| `lister_id` | `uuid` | No | — | Lister party. |
| `event_type` | `payment_event_type` | No | — | Ledger event type. |
| `gross_amount` | `decimal(10,2)` | No | `0` | Total money moved before fees. |
| `hitpay_fee` | `decimal(10,2)` | No | `0` | HitPay fee. |
| `platform_fee` | `decimal(10,2)` | No | `0` | Platform fee. |
| `net_amount` | `decimal(10,2)` | No | `0` | Net amount after fees. |
| `currency` | `text` | No | `'SGD'` | Currency. |
| `hitpay_payment_request_id` | `text` | Yes | `null` | Payment request ref. |
| `hitpay_payment_id` | `text` | Yes | `null` | Payment ref. |
| `hitpay_refund_id` | `text` | Yes | `null` | Refund ref. |
| `hitpay_transfer_id` | `text` | Yes | `null` | Transfer ref. |
| `external_reference` | `text` | Yes | `null` | Non-HitPay external ref. |
| `external_notes` | `text` | Yes | `null` | Extra notes. |
| `status` | `text` | No | `'pending'` | Pending/processing/completed/failed. |
| `failure_reason` | `text` | Yes | `null` | Failure reason. |
| `idempotency_key` | `text` | Yes | `null` | Uniqueness guard. |
| `triggered_by` | `uuid` | Yes | `null` | Triggering user/admin. |
| `triggered_by_role` | `text` | Yes | `null` | System/renter/lister/admin. |
| `metadata` | `jsonb` | Yes | `{}` | Event metadata. |
| `processed_at` | `timestamptz` | Yes | `null` | Process time. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |
| `updated_at` | `timestamptz` | Yes | `now()` | Updated timestamp. |

FKs: `booking_id -> bookings(id)`, `renter_id -> profiles(id)`, `lister_id -> profiles(id)`, `triggered_by -> profiles(id)`

Indexes:

- `idx_transactions_booking`
- `idx_transactions_renter`
- `idx_transactions_lister`
- `idx_transactions_event`
- `idx_transactions_status`
- `idx_transactions_idempotency`

RLS:

- Renters/listers can view their own transactions.
- Admins can also view them.

### `refunds`

Purpose: refund records and HitPay refund tracking.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `booking_id` | `uuid` | No | — | Booking refunded. |
| `transaction_id` | `uuid` | Yes | `null` | Initiating ledger transaction. |
| `renter_id` | `uuid` | No | — | Recipient renter. |
| `refund_reason` | `refund_reason` | No | — | Refund reason enum. |
| `original_amount` | `decimal(10,2)` | No | — | Original booking charge. |
| `refund_amount` | `decimal(10,2)` | No | — | Amount refunded. |
| `platform_fee_retained` | `decimal(10,2)` | Yes | `0` | Fee kept by platform. |
| `deposit_refund` | `decimal(10,2)` | Yes | `0` | Deposit portion refunded. |
| `cancellation_fee` | `decimal(10,2)` | Yes | `0` | Cancellation fee withheld. |
| `cancellation_policy` | `text` | Yes | `null` | Applied policy label. |
| `hours_before_start` | `integer` | Yes | `null` | Recorded timing. |
| `currency` | `text` | Yes | `'SGD'` | Currency. |
| `hitpay_refund_id` | `text` | Yes | `null` | HitPay refund ref. |
| `hitpay_payment_id` | `text` | Yes | `null` | Original payment id. |
| `status` | `text` | Yes | `'pending'` | Pending/processing/completed/failed. |
| `failure_reason` | `text` | Yes | `null` | Failure reason. |
| `note` | `text` | Yes | `null` | Note shown to renter/admin. |
| `processed_by` | `uuid` | Yes | `null` | Admin if manual. |
| `processed_at` | `timestamptz` | Yes | `null` | Process time. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |
| `updated_at` | `timestamptz` | Yes | `now()` | Updated timestamp. |

FKs: `booking_id -> bookings(id)`, `transaction_id -> transactions(id)`, `renter_id -> profiles(id)`, `processed_by -> profiles(id)`

Indexes:

- `idx_refunds_booking`
- `idx_refunds_renter`
- `idx_refunds_status`

RLS:

- Refund owner renter and admins can view.

### `payouts`

Purpose: lister payout records and payout processing state.

Base and extended columns:

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `lister_id` | `uuid` | No | — | Lister paid out. |
| `booking_id` | `uuid` | Yes | `null` | Related booking. |
| `amount` | `decimal(10,2)` | No | `0` | Display amount. |
| `currency` | `text` | Yes | `'SGD'` | Currency. |
| `status` | `payout_status` / text usage | Yes | `'pending'` | Pending/processing/completed/failed. |
| `payout_method` | `text` | Yes | `null` | Bank/GCash/Maya/manual. |
| `reference_number` | `text` | Yes | `null` | Transfer reference. |
| `notes` | `text` | Yes | `null` | Internal notes. |
| `processed_at` | `timestamptz` | Yes | `null` | Process time. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |
| `updated_at` | `timestamptz` | Yes | `now()` | Updated timestamp. |
| `trigger_type` | `payout_trigger` | Yes | `'auto_after_completion'` | Trigger source. |
| `gross_amount` | `decimal(10,2)` | Yes | `0` | Gross payout amount. |
| `platform_fee` | `decimal(10,2)` | Yes | `0` | Platform fee. |
| `hitpay_fee` | `decimal(10,2)` | Yes | `0` | HitPay fee. |
| `net_amount` | `decimal(10,2)` | Yes | `0` | Net payout. |
| `failure_reason` | `text` | Yes | `null` | Failure reason. |
| `retry_count` | `integer` | Yes | `0` | Retry attempts. |
| `last_retry_at` | `timestamptz` | Yes | `null` | Retry timestamp. |
| `can_retry` | `boolean` | Yes | `false` | Whether lister can request retry. |
| `transaction_id` | `uuid` | Yes | `null` | Related transaction. |
| `processed_by` | `uuid` | Yes | `null` | Admin processor. |

App-expected addition not present in checked-in SQL:

- `hitpay_transfer_id`

FKs:

- `lister_id -> profiles(id)`
- `booking_id -> bookings(id)`
- `transaction_id -> transactions(id)`
- `processed_by -> profiles(id)`

Indexes:

- `idx_payouts_lister`
- `idx_payouts_booking`

RLS:

- Lister can view own payouts.

### `dispute_resolutions`

Purpose: admin dispute decision records.

| Column | Type | Nullable | Default | Description |
|---|---|---:|---|---|
| `id` | `uuid` | No | `uuid_generate_v4()` | PK. |
| `booking_id` | `uuid` | No | — | Disputed booking. |
| `admin_id` | `uuid` | No | — | Admin who resolved. |
| `resolution_type` | `text` | No | — | `full_refund_renter`, `full_payout_lister`, `split`. |
| `renter_refund_amount` | `decimal(10,2)` | Yes | `0` | Refund amount. |
| `lister_payout_amount` | `decimal(10,2)` | Yes | `0` | Payout amount. |
| `platform_keeps_amount` | `decimal(10,2)` | Yes | `0` | Platform retained amount. |
| `renter_refund_percent` | `decimal(5,2)` | Yes | `0` | Percent reference. |
| `lister_payout_percent` | `decimal(5,2)` | Yes | `0` | Percent reference. |
| `resolution_notes` | `text` | No | — | Admin notes. |
| `evidence_reviewed` | `text` | Yes | `null` | Evidence notes. |
| `renter_notified` | `boolean` | Yes | `false` | Notification sent flag. |
| `lister_notified` | `boolean` | Yes | `false` | Notification sent flag. |
| `created_at` | `timestamptz` | Yes | `now()` | Created timestamp. |

FKs: `booking_id -> bookings(id)`, `admin_id -> profiles(id)`

Index: `idx_dispute_booking`

RLS:

- Involved parties and admins can select.

### `reviews`

Purpose: mutual renter/lister reviews.

Columns: `id`, `booking_id`, `listing_id`, `reviewer_id`, `reviewee_id`, `review_role`, `overall_rating`, `communication_rating`, `accuracy_rating`, `condition_rating`, `value_rating`, `comment`, `response`, `responded_at`, `is_public`, `created_at`, plus admin additions `is_flagged`, `is_hidden`, `flagged_reason`, `moderated_by`.

FKs:

- `booking_id -> bookings(id)`
- `listing_id -> listings(id)`
- `reviewer_id -> profiles(id)`
- `reviewee_id -> profiles(id)`
- `moderated_by -> profiles(id)`

Indexes:

- `idx_reviews_reviewee`
- `idx_reviews_listing`

RLS:

- Public select.
- Only reviewer inserts.
- Only reviewee updates (used for responses).

### `conversations`

Purpose: conversation headers between two users, optionally linked to listing/booking.

Columns: `id`, `listing_id`, `booking_id`, `participant_1`, `participant_2`, `last_message_at`, `last_message_preview`, `unread_count_1`, `unread_count_2`, `created_at`.

FKs: `listing_id -> listings(id)`, `booking_id -> bookings(id)`, both participants to `profiles(id)`.

Indexes: no explicit SQL index beyond unique constraint.

RLS:

- Participant-only select/insert.

### `messages`

Purpose: individual message records in conversations.

Columns: `id`, `conversation_id`, `sender_id`, `content`, `message_type`, `metadata`, `is_read`, `read_at`, `created_at`.

FKs: `conversation_id -> conversations(id)`, `sender_id -> profiles(id)`.

Index: `idx_messages_conversation`

RLS:

- Participant-only select via conversation subquery.
- Sender-only insert.

### `favorites`

Purpose: user favorites/bookmarks on listings.

Columns: `id`, `user_id`, `listing_id`, `created_at`.

FKs: `user_id -> profiles(id)`, `listing_id -> listings(id)`

Index: `idx_favorites_user`

RLS:

- Single `FOR ALL` policy requiring `auth.uid() = user_id`.

### `notifications`

Purpose: in-app notifications.

Checked-in SQL columns: `id`, `user_id`, `type`, `title`, `body`, `listing_id`, `booking_id`, `from_user_id`, `action_url`, `is_read`, `created_at`.

App-expected additions not present in checked-in SQL:

- `bundle_key`
- `bundle_count`
- `is_bundled`
- `bundle_preview`
- `last_bundled_at`

FKs: `user_id`, `listing_id`, `booking_id`, `from_user_id`

Index: `idx_notifications_user`

RLS:

- Users can select/update their own.
- Inserts allowed when auth user is recipient or sender.

### `individual_verifications`

Purpose: individual-account verification workflow.

Columns include:

- identity: `id`, `user_id`
- email: `email_verified`, `email_verified_at`
- phone: `phone_number`, `phone_verified`, `phone_verified_at`
- ID doc: `gov_id_document_type`, `gov_id_front_url`, `gov_id_back_url`, `gov_id_submitted_at`, `gov_id_verified`, `gov_id_verified_at`, `gov_id_rejection_reason`
- selfie: `selfie_url`, `selfie_submitted_at`, `selfie_verified`, `selfie_verified_at`, `selfie_rejection_reason`
- overall: `overall_status`, `overall_approved_at`, `overall_approved_by`, `overall_rejection_reason`
- timestamps: `created_at`, `updated_at`

FKs: `user_id -> profiles(id)`, `overall_approved_by -> profiles(id)`

Indexes: unique `user_id`.

RLS:

- User can select own row; admins can select all.
- User can insert own row.
- User can update own row while not approved.
- Admins can update all.

### `business_verifications`

Purpose: business-account verification workflow.

Columns include:

- identity: `id`, `user_id`
- business details: `business_phone`, `business_phone_verified`, `business_address`, `business_address_verified`, `tin`, `tin_verified`
- business document: `business_document_type`, `business_document_url`, `business_document_submitted_at`, `business_document_verified`, `business_document_verified_at`, `business_document_rejection_reason`
- representative ID: `rep_gov_id_type`, `rep_gov_id_front_url`, `rep_gov_id_back_url`, `rep_gov_id_submitted_at`, `rep_gov_id_verified`, `rep_gov_id_verified_at`, `rep_gov_id_rejection_reason`
- representative selfie: `rep_selfie_url`, `rep_selfie_submitted_at`, `rep_selfie_verified`, `rep_selfie_verified_at`, `rep_selfie_rejection_reason`
- overall: `overall_status`, `overall_approved_at`, `overall_approved_by`, `overall_rejection_reason`
- timestamps: `created_at`, `updated_at`

FKs: `user_id -> profiles(id)`, `overall_approved_by -> profiles(id)`

Indexes: unique `user_id`.

RLS: same model as individual verifications.

### `payout_method_history`

Purpose: payout method change history.

Status: **APP EXPECTED, SQL TABLE NOT FOUND IN CHECKED-IN MIGRATIONS**.

Referenced fields in app: `user_id`, `previous_method`, `new_method`.

### `fee_config`

Purpose: fee and threshold configuration.

Columns: `id`, `key`, `value`, `description`, `updated_at`.

Seeded keys:

- `hitpay_percentage_fee`
- `hitpay_fixed_fee`
- `platform_service_fee_renter`
- `platform_service_fee_lister`
- `platform_absorbs_hitpay_fee`
- `cancellation_flexible_full_refund_hours`
- `cancellation_moderate_full_refund_hours`
- `cancellation_strict_full_refund_hours`
- `payout_delay_days`
- `max_payout_retry_count`

RLS:

- Public select.
- Admin-only write policy.

### `platform_settings`

Purpose: key/value platform configuration.

Columns: `key`, `value`, `description`, `updated_by`, `updated_at`.

Seeded examples:

- `service_fee_renter_percent`
- `service_fee_lister_percent`
- `max_images_per_listing`
- `max_listing_title_length`
- `min_listing_description_length`
- `platform_currency`
- `platform_name`
- `maintenance_mode`
- `new_listing_requires_approval`
- `min_payout_amount`

RLS:

- Public select.
- Admin-only write.

### `reports`

Purpose: user-generated moderation reports.

Columns: `id`, `reporter_id`, `reported_user_id`, `reported_listing_id`, `reported_review_id`, `reported_message_id`, `report_type`, `description`, `status`, `admin_notes`, `resolved_by`, `resolved_at`, `created_at`, `updated_at`.

Indexes:

- `idx_reports_status`
- `idx_reports_type`
- `idx_reports_created`

RLS:

- Reporter can insert/select own.
- Admins can select/update all.

### `admin_audit_log`

Purpose: audit log of admin actions.

Columns: `id`, `admin_id`, `action`, `target_type`, `target_id`, `details`, `ip_address`, `created_at`.

Indexes:

- `idx_audit_log_admin`
- `idx_audit_log_target`

RLS:

- Admin-only.

## 5. Enums

### PostgreSQL enums present in checked-in SQL

| Enum | Values | Used by |
|---|---|---|
| `account_type` | `individual`, `business` | `profiles.account_type` |
| `verification_status` | `unverified`, `pending`, `verified`, `rejected` | Legacy `profiles.verification_status` |
| `listing_status` | `draft`, `active`, `paused`, `archived` | `listings.status` |
| `pricing_period` | `hour`, `day`, `week`, `month` | `listings.primary_pricing_period`, `bookings.pricing_period` |
| `booking_status` | `pending`, `confirmed`, `active`, `completed`, `cancelled_by_renter`, `cancelled_by_lister`, `disputed` | `bookings.status`, `booking_timeline.status` |
| `review_role` | `as_renter`, `as_lister` | `reviews.review_role` |
| `stock_movement_type` | `initial`, `adjustment_add`, `adjustment_remove`, `adjustment_set`, `booking_reserved`, `booking_released`, `booking_returned`, `damaged`, `lost` | `inventory_movements.movement_type` |
| `payout_status` | `pending`, `processing`, `completed`, `failed` | `payouts.status` |
| `payment_event_type` | `payment_initiated`, `payment_completed`, `payment_failed`, `payment_expired`, `refund_initiated`, `refund_completed`, `refund_failed`, `payout_initiated`, `payout_completed`, `payout_failed`, `payout_retry_requested`, `dispute_hold`, `dispute_released_lister`, `dispute_released_renter`, `dispute_split` | `transactions.event_type` |
| `refund_reason` | `booking_cancelled_by_renter`, `booking_cancelled_by_lister`, `booking_declined`, `payment_expired`, `dispute_resolved_renter`, `dispute_split`, `admin_manual_refund` | `refunds.refund_reason` |
| `payout_trigger` | `auto_after_completion`, `admin_manual`, `dispute_resolved`, `retry_after_failure` | `payouts.trigger_type` |

### App-only string unions not backed by checked-in SQL enum

- `BookingStatus` in TypeScript additionally expects: `lister_confirmation`, `returned`, `awaiting_payment`, `out_for_delivery`.
- Verification overall statuses use strings: `incomplete`, `pending`, `approved`, `rejected`, `suspended`.
- Several notification and payout helper types exist only in TypeScript.

## 6. Database Functions & Triggers

### Present in checked-in SQL

| Function | Purpose | Params | Returns | Called by | Side effects |
|---|---|---|---|---|---|
| `handle_new_user` | Creates profile row from `auth.users` metadata. | none; trigger uses `NEW` | `trigger` | `on_auth_user_created` trigger | inserts `profiles` row; normalizes metadata |
| `update_listing_search_vector` | Rebuilds full-text vector from listing fields. | none; uses `NEW` | `trigger` | `listing_search_update` trigger | mutates `NEW.search_vector` |
| `update_user_reputation` | Recomputes rating/review counts after new review. | none; uses `NEW` | `trigger` | `on_review_created` | updates `profiles` aggregate fields |
| `update_favorites_count` | Recomputes `listings.favorites_count`. | none; uses `NEW`/`OLD` | `trigger` | `on_favorite_changed` | updates `listings.favorites_count` |
| `increment_views` | Increments listing view counter. | `p_listing_id uuid` | `void` | listing details action | updates `listings.views_count` |
| `check_low_stock_alert` | Creates low/out-of-stock notifications. | `p_listing_id uuid` | `void` | stock functions | inserts `notifications` |
| `reserve_stock` | Moves stock from available to reserved. | `p_listing_id`, `p_booking_id`, `p_quantity`, `p_user_id` | `boolean` | payment/booking flow RPC | updates `listings`, inserts `inventory_movements`, sets `bookings.stock_deducted`, may notify low stock |
| `release_stock` | Returns reserved stock to available on cancellation. | same four params | `void` | cancellation flow | updates `listings`, inserts `inventory_movements`, sets `bookings.stock_restored` |
| `return_stock` | Returns reserved stock to available on completion. | same four params | `void` | completion flow | updates `listings`, inserts `inventory_movements`, sets `bookings.stock_restored` |
| `adjust_stock` | Manual stock adjustment by owner. | `p_listing_id`, `p_user_id`, `p_adjustment_type`, `p_quantity`, `p_reason` | `void` | inventory/listing updates | updates `listings`, inserts `inventory_movements`, may notify low stock |
| `get_available_stock` | Computes remaining stock for a date range. | `p_listing_id`, `p_start_date`, `p_end_date` | `integer` | available for RPC use; not directly used in current app | reads `bookings`, `listings` |
| `can_user_create_listing` | Returns true if account-specific verification overall status is approved. | `p_user_id uuid default null`, `user_id uuid default null` | `boolean` | verification/payout actions | reads `profiles`, `individual_verifications`, `business_verifications` |
| `calculate_hitpay_fee` | Calculates fee from `fee_config`. | `p_amount decimal` | `decimal` | available to SQL; app also calculates in TS | reads `fee_config` |
| `calculate_cancellation_refund` | Computes refund breakdown from booking/listing policy. | `p_booking_id uuid`, `p_cancelled_by text` | `jsonb` | payments refund action | reads `bookings`, `listings`, `fee_config` |
| `trigger_auto_payout` | Inserts payout record for completed booking and notifies lister. | `p_booking_id uuid` | `jsonb` | payments `autoTriggerPayout` RPC | inserts `payouts`, updates `bookings.payout_id`, inserts `booking_timeline`, inserts `notifications` |
| `mark_item_returned_by_renter` | Marks active booking as returned and writes timeline entry. | `p_booking_id`, `p_notes text default null`, `p_photo_urls text[] default []`, `p_user_id uuid default auth.uid()` | `void` | booking return flow RPC | updates `bookings`, inserts `booking_timeline` |
| `try_acquire_booking_webhook_lock` | Advisory lock wrapper for webhook dedupe. | `p_lock_key bigint` | `boolean` | HitPay webhook route | no row mutation; takes advisory xact lock |

### Triggers

| Trigger | Table | Event | Function |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | `AFTER INSERT` | `handle_new_user` |
| `listing_search_update` | `listings` | `BEFORE INSERT OR UPDATE` | `update_listing_search_vector` |
| `on_review_created` | `reviews` | `AFTER INSERT` | `update_user_reputation` |
| `on_favorite_changed` | `favorites` | `AFTER INSERT OR DELETE` | `update_favorites_count` |

### Referenced by app but **not present** in checked-in SQL

Mark these as **NOT IMPLEMENTED IN CHECKED-IN SQL**:

- `create_verification_record`
- `check_booking_conflict`
- `check_individual_submission_complete`
- `check_business_submission_complete`
- `start_rental_period`
- `calculate_rental_end`
- `auto_cancel_unconfirmed_bookings`
- `expire_unpaid_bookings`
- `add_booking_timeline`
- `upsert_bundled_notification`
- `create_individual_notification`
- `get_notification_bell_count`
- `mark_notification_read`
- `mark_all_notifications_read`
- `search_listings`
- `is_payout_setup_complete`

The app contains fallbacks for several missing RPCs:

- booking timeline falls back to direct insert into `booking_timeline`
- rental start/return fall back to direct `bookings` updates
- conflict checks fall back to “no conflict” + stock reservation as final guard
- auto payout falls back to app-side insert when RPC fails

## 7. URL Structure & Routing

### Public Routes

| URL | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Marketing/home page plus featured/browse listings. |
| `/listings` | `src/app/listings/page.tsx` | Search/browse listings with filters and pagination. |
| `/listings/[id]` | `src/app/listings/[id]/page.tsx` | Listing detail page with booking widget, owner info, reviews. |
| `/fees` | `src/app/fees/page.tsx` | Public fee explanation page using current fee config. |
| `/policies` | `src/app/policies/page.tsx` | Marketplace policy content. |
| `/maintenance` | `src/app/maintenance/page.tsx` | Maintenance page. |
| `/users/[id]` | `src/app/users/[id]/page.tsx` | Public user profile with listings and reviews. |
| `/payment/success` | `src/app/payment/success/page.tsx` | Post-HitPay success page and payment status polling. |
| `/payment/cancel` | `src/app/payment/cancel/page.tsx` | Payment cancellation page. |
| `/reset-password` | `src/app/reset-password/page.tsx` | Password reset form. |

### Auth Routes

| URL | File | Purpose |
|---|---|---|
| `/login` | `src/app/(auth)/login/page.tsx` | Email/Google login. Redirects to `/listings` if already logged in. |
| `/register` | `src/app/(auth)/register/page.tsx` | Individual/business registration UI. Redirects to `/listings` if already logged in. |
| `/callback` | `src/app/(auth)/callback/route.ts` | OAuth callback; exchanges code for session then redirects to `/listings`. |

### Lister Routes

Most are dedicated or re-export dashboard pages.

| URL | File | Purpose | Data fetched |
|---|---|---|---|
| `/lister/dashboard` | `src/app/lister/dashboard/page.tsx` | Lister overview dashboard. | Profile, bookings, listings, inventory overview, listing eligibility. |
| `/lister/listings` | `src/app/lister/listings/page.tsx` | Re-export of dashboard listings page. | Same as dashboard listings. |
| `/lister/listings/new` | `src/app/lister/listings/new/page.tsx` | Re-export of listing creation page. | Categories, listing eligibility. |
| `/lister/listings/[id]/edit` | `src/app/lister/listings/[id]/edit/page.tsx` | Edit listing. | Listing, categories. |
| `/lister/bookings` | `src/app/lister/bookings/page.tsx` | Re-export of incoming bookings page. | Lister bookings. |
| `/lister/bookings/[id]` | `src/app/lister/bookings/[id]/page.tsx` | Re-export of booking detail page. | Booking, timeline, fees, transactions, refund/payout/dispute. |
| `/lister/inventory` | `src/app/lister/inventory/page.tsx` | Re-export inventory page. | Inventory overview, low stock. |
| `/lister/earnings` | `src/app/lister/earnings/page.tsx` | Re-export earnings page. | Payouts, transactions, earnings summary, payout method. |
| `/lister/reviews` | `src/app/lister/reviews/page.tsx` | Review center for lister side. | Pending reviews, reviews received, written reviews. |
| `/lister/settings` | `src/app/lister/settings/page.tsx` | Lister settings links. | Static links. |
| `/lister/settings/payments` | `src/app/lister/settings/payments/page.tsx` | Payout setup/settings. | Profile, payout setup status. |

### Renter Routes

| URL | File | Purpose | Data fetched |
|---|---|---|---|
| `/renter/dashboard` | `src/app/renter/dashboard/page.tsx` | Renter overview dashboard. | Rentals, notifications, listing eligibility. |
| `/renter/rentals` | `src/app/renter/rentals/page.tsx` | Re-export of dashboard rentals page. | Renter bookings. |
| `/renter/rentals/[id]` | `src/app/renter/rentals/[id]/page.tsx` | Re-export of booking detail page. | Booking detail data. |
| `/renter/favorites` | `src/app/renter/favorites/page.tsx` | Re-export favorites page. | Favorited listings. |
| `/renter/reviews` | `src/app/renter/reviews/page.tsx` | Review center for renter side. | Pending reviews, reviews received, written reviews. |
| `/renter/settings` | `src/app/renter/settings/page.tsx` | Renter settings links. | Static links. |

### Account Routes

| URL | File | Purpose |
|---|---|---|
| `/account/profile` | `src/app/account/profile/page.tsx` | Profile settings form. |
| `/account/notifications` | `src/app/account/notifications/page.tsx` | Notifications center. |
| `/account/messages` | `src/app/account/messages/page.tsx` | Conversation list. |
| `/account/messages/[id]` | `src/app/account/messages/[id]/page.tsx` | Message thread view. |
| `/account/verify` | `src/app/account/verify/page.tsx` | Verification center. |

### Admin Routes

Admin access is enforced by `src/app/admin/layout.tsx` by loading `profiles.is_admin`.

| URL | File | Purpose |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` | Admin dashboard. |
| `/admin/analytics` | `src/app/admin/analytics/page.tsx` | Revenue/stats analytics. |
| `/admin/users` | `src/app/admin/users/page.tsx` | User management. |
| `/admin/users/[id]` | `src/app/admin/users/[id]/page.tsx` | User detail/moderation. |
| `/admin/listings` | `src/app/admin/listings/page.tsx` | Listing moderation list. |
| `/admin/listings/[id]` | `src/app/admin/listings/[id]/page.tsx` | Listing moderation detail. |
| `/admin/bookings` | `src/app/admin/bookings/page.tsx` | Booking operations/disputes. |
| `/admin/bookings/[id]` | `src/app/admin/bookings/[id]/page.tsx` | Booking detail for admin. |
| `/admin/reviews` | `src/app/admin/reviews/page.tsx` | Review moderation. |
| `/admin/reports` | `src/app/admin/reports/page.tsx` | Report triage list. |
| `/admin/reports/[id]` | `src/app/admin/reports/[id]/page.tsx` | Report detail. |
| `/admin/verifications` | `src/app/admin/verifications/page.tsx` | Verification queue. |
| `/admin/kyc-verification` | `src/app/admin/kyc-verification/page.tsx` | Bank KYC review queue. |
| `/admin/payouts` | `src/app/admin/payouts/page.tsx` | Payout operations. |
| `/admin/transactions` | `src/app/admin/transactions/page.tsx` | Transaction ledger view. |
| `/admin/categories` | `src/app/admin/categories/page.tsx` | Category management. |
| `/admin/inventory` | `src/app/admin/inventory/page.tsx` | Inventory oversight. |
| `/admin/audit-log` | `src/app/admin/audit-log/page.tsx` | Audit log viewer. |
| `/admin/settings` | `src/app/admin/settings/page.tsx` | Platform settings editor. |

### API Routes

| URL | Method | Purpose | Auth |
|---|---|---|---|
| `/api/webhooks/hitpay` | `GET`, `HEAD`, `POST` | HitPay payment and transfer webhooks. | Signature/HMAC verified |
| `/api/cron/check-deadlines` | `POST` | Cancels expired lister-confirmation bookings and sends 12h/2h reminders. | `x-cron-secret` header must equal `CRON_SECRET` |
| `/api/test-email` | `GET` | Development-only email template tester. | Blocked in production |
| `/auth/logout` | `GET`, `POST` | Signs out and redirects home. | Session-based |

## 8. Component Registry

This section compresses the component registry to the most useful facts per file: path, client/server, main props, key actions, and important child components. `src/components/ui/*` are shadcn/Radix wrappers and are listed separately.

### `components/layout/`

- `src/components/layout/dashboard-sidebar.tsx` `[CC]`
  Props: `currentUserId`, `hasListerActivity`, `isAdmin`, `payoutSetupCompleted`.
  Renders dashboard navigation; imports `getBookingDetails` for a detail-link helper.
- `src/components/layout/footer.tsx` `[SC]`
  Static site footer.
- `src/components/layout/footer-gate.tsx` `[SC]`
  Wraps `Footer`; used to conditionally gate footer visibility by route context.
- `src/components/layout/mobile-nav.tsx` `[CC]`
  Mobile bottom navigation for dashboard contexts.
- `src/components/layout/navbar.tsx` `[SC]`
  Top nav; fetches notification counts and renders `NotificationBell` plus `SearchBar`.
- `src/components/layout/notification-bell.tsx` `[CC]`
  Props include unread count/list; renders notification dropdown using `NotificationList` and `MarkAllReadButton`.
- `src/components/layout/role-shell.tsx` `[SC]`
  Shared renter/lister shell. Props: avatar/display/mode labels, nav items, children.

### `components/listings/`

- `listing-form.tsx` `[CC]`
  Props: existing listing optional, categories list.
  Calls: `createListing`, `updateListing`.
  Uses: `ImageUpload`.
- `booking-widget.tsx` `[CC]`
  Props: listing, current user context, eligibility/favorite data.
  Calls: `createAndPayBooking`.
  Renders booking CTA, duration/quantity form, payment redirect.
- `favorite-button.tsx` `[CC]`
  Props: `listingId`, `initialIsFavorited`, optional styling.
  Calls: `toggleFavorite`.
- `listing-card.tsx` `[SC/CC mix via nested buttons]`
  Renders summary card, favorite toggle, stock badge.
- `listing-grid.tsx` `[SC]`
  Props: listings, favorites set, empty-state copy.
  Uses `ListingCard`, `EmptyState`.
- `listing-filters.tsx` `[CC]`
  Props: categories and current filter values.
  Query-param based filter form.
- `listing-sort.tsx` `[CC]`
  Sort selector synced to query params.
- `listing-image.tsx` not present.
- `image-upload.tsx` `[CC]`
  Client-side upload picker/preview for listing images.
- `image-gallery.tsx` `[CC]`
  Listing image gallery/lightbox behavior.
- `availability-calendar.tsx` `[CC]`
  Calendar view of availability.
- `message-lister-button.tsx` `[CC]`
  Calls `getOrCreateConversation`.
- `my-listing-actions.tsx` `[CC]`
  Calls `deleteListing`, `setListingStatus`.

### `components/bookings/`

- `handover-dialog.tsx` `[CC]`
  Props: `booking`.
  Calls: `markReceivedByRenter`.
  Uses: `ProofPhotoUpload`.
- `return-dialog.tsx` `[CC]`
  Props: `booking`.
  Calls: `markReturnedToLister`.
  Uses: `ProofPhotoUpload`.
- `condition-check-form.tsx` `[CC]`
  Props: `booking`.
  Calls: `confirmReturnAndComplete`.
  Captures `return_condition` and optional notes.
- `lister-cancel-dialog.tsx` `[CC]`
  Props: `booking`.
  Calls: `listerCancelBooking`.
- `renter-cancel-dialog.tsx` `[CC]`
  Props: `booking`, `refundPreview`.
  Calls: `cancelBookingAsRenter`.
- `raise-dispute-dialog.tsx` `[CC]`
  Props: `bookingId`, presentation flags.
  Calls: `raiseDispute`.
- `payment-button.tsx` `[CC]`
  Props: `bookingId`, optional `paymentUrl`.
  Calls `createPaymentForBooking` when URL absent.
- `payment-countdown.tsx` `[CC]`
  Props: `expiresAt`.
- `rental-countdown.tsx` `[CC]`
  Props: `rentalEndsAt`, optional `rentalStartedAt`.
- `proof-photo-upload.tsx` `[CC]`
  Reusable proof file picker.
- `booking-status-badge.tsx` `[SC]`
  Props: `status`, optional `size`.
  Uses `BOOKING_STATUS_CONFIG`.
- `booking-summary-card.tsx` `[SC]`
  High-level booking summary card.
- `booking-timeline.tsx` `[SC]`
  Props: `timeline`, optional `currentUserId`.
- `pending-submit-button.tsx` `[CC]`
  Pending state submit helper.
- Compatibility wrappers:
  `return-form.tsx` just renders `ReturnDialog`.

### `components/inventory/`

- `stock-summary-card.tsx` `[SC]`
  Props: inventory summary numbers.
- `stock-overview-table.tsx` `[CC]`
  Props: listing rows.
  Uses `StockAdjustmentForm`, `StockLevelBadge`, `EmptyState`.
- `stock-adjustment-form.tsx` `[CC]`
  Calls `adjustStock`.
- `stock-movement-log.tsx` `[SC/CC hybrid presentation]`
  Props: movements and pagination.
- `stock-level-badge.tsx` `[SC]`
  Shows in-stock/low/out state.
- `low-stock-alert.tsx` `[SC]`
  Alert banner for low inventory.

### `components/verification/`

Status: no dedicated `src/components/verification/*` directory. Verification UI is mostly in route files plus admin verification components:

- `src/components/admin/verification-decision-dialog.tsx` `[CC]` calls `rejectVerification`.
- `src/components/admin/verification-field-action-button.tsx` `[CC]` calls `verifyIndividualDocument` / `verifyBusinessDocument`.

### `components/payments/`

- `payment-breakdown-card.tsx` `[SC/CC presentation]`
  Props: calculated breakdown, viewer, quantity, units, period.
- `payment-status-poller.tsx` `[CC]`
  Polls `/payment/success`-related state.
- `transaction-list.tsx` `[SC]`
  Props: transactions, flags.
- `refund-status-card.tsx` `[SC]`
  Props: `refund`.
- `payout-status-card.tsx` `[CC]`
  Props: `payout`.
  Calls: `retryFailedPayout`.
- `dispute-resolution-form.tsx` `[CC]`
  Props: `booking`.
  Calls: `resolveDisputePayment`.

### `components/messages/`

- `conversation-list.tsx` `[CC]`
  Props: conversations, current selection.
- `message-thread.tsx` `[CC]`
  Props: `conversationId`, initial messages, current user id.
  Calls: `getMessages`.
- `message-input.tsx` `[CC]`
  Props: conversation/listing/recipient identifiers.
  Calls: `sendMessage`.

### `components/profile/`

- `profile-settings-form.tsx` `[CC]`
  Props: `profile`.
  Calls: `updateProfile`.
- `profile-card.tsx` `[SC]`
  Props: `profile`, optional `compact`.
- `reputation-display.tsx` `[SC]`
  Props: ratings/review counts.
- `trust-badges.tsx` `[SC]`
  Props: `profile`.
- `message-profile-button.tsx` `[CC]`
  Calls: `getOrCreateDirectConversation`.
- `payout-settings-form.tsx` `[CC]`
  Legacy/simple payout form, calls `updatePayoutSettings`.

### `components/payout/`

- `payout-settings-client.tsx` `[CC]`
  Props: `profile`, `payoutStatus`.
  Calls: `setupPayoutMethod`.
  Uses `BankAccountForm`, `GCashForm`, `MayaForm`, `KYCUpload`, selector/badge components.
- `kyc-upload.tsx` `[CC]`
  Calls `uploadKYCDocument`.
- `bank-account-form.tsx` `[CC]`
  Props: default values, submit callback.
- `gcash-form.tsx` `[CC]`
  Props: default values, submit callback.
- `maya-form.tsx` `[CC]`
  Props: default values, submit callback.
- `payout-details-display.tsx` `[SC]`
  Read-only payout detail display with masking/copy.
- `payout-method-badge.tsx` `[SC]`
  Method badge.
- `payout-method-selector.tsx` `[CC]`
  Method picker.

### `components/reviews/`

- `dual-review-form.tsx` `[CC]`
  Props: `booking`, `currentUserId`, optional open/trigger.
  Calls: `submitReview`.
- `review-action-button.tsx` `[CC]`
  Wraps `DualReviewForm`.
- `review-list.tsx` `[CC]`
  Props: review list + summary/pagination/response/reporting flags.
  Calls: `respondToReview`.
  Uses `ReviewCard`, `StarRating`, `Pagination`.
- `review-card.tsx` `[SC]`
  Props: `review`, `canReport`.
  Uses `ReportDialog`, `StarRating`.
- `star-rating.tsx` `[CC]`
  Interactive/read-only star control.

### `components/admin/`

Key admin components and action hooks:

- `admin-user-table.tsx` `[CC]` calls `suspendUser`, `unsuspendUser`, `toggleAdminRole`.
- `admin-user-detail-actions.tsx` `[CC]` calls `suspendUser`, `unsuspendUser`, `toggleAdminRole`, `updateUserAdminNotes`.
- `admin-listing-table.tsx` `[CC]` calls `moderateListing`, `unflagListing`.
- `listing-moderate-dialog.tsx` `[CC]` calls `moderateListing`.
- `admin-booking-table.tsx` `[CC]` renders `DisputeResolveDialog`.
- `booking-admin-notes.tsx` `[CC]` calls `addBookingAdminNotes`.
- `dispute-resolve-dialog.tsx` `[CC]` calls legacy `resolveDispute` action.
- `admin-report-table.tsx` `[CC]` calls `resolveReport`, `updateReportStatus`.
- `report-detail-actions.tsx` `[CC]` same.
- `admin-review-table.tsx` `[CC]` calls `hideReview`, `unhideReview`, `flagReview`, `unflagReview`.
- `admin-category-form.tsx` `[CC]` calls `createCategory`, `updateCategory`.
- `admin-category-table.tsx` `[CC]` calls `toggleCategoryActive`, `updateCategory`.
- `platform-settings-form.tsx` `[CC]` calls `updatePlatformSetting`.
- `kyc-verification-list.tsx` `[CC]` calls `verifyKYC`.
- `payout-process-dialog.tsx` `[CC]` calls `processPayoutToLister`.
- `payout-fail-dialog.tsx` `[CC]` calls `markPayoutFailedByAdmin`.
- `expire-unpaid-bookings-button.tsx` `[CC]` calls `expireUnconfirmedBookings`.
- Read-only/support components: `admin-sidebar`, `admin-page-header`, `admin-chart`, `admin-stats-cards`, `admin-audit-table`, `document-viewer-modal`, `document-viewer-modal-route`.

### `components/notifications/`

- `notification-list.tsx` `[CC]`
  Props: notifications, paging flags.
  Calls: `markAsRead`.
- `mark-all-read-button.tsx` `[CC]`
  Calls `markAllAsRead`.

### `components/shared/`

- `search-bar.tsx` `[CC]`
  Query-driven site search/category picker.
- `report-dialog.tsx` `[CC]`
  Calls `submitReport`.
- `pagination.tsx` `[CC]`
  Query-param page navigation.
- `empty-state.tsx` `[SC]`
  Generic empty state.
- `confirm-dialog.tsx` `[CC]`
  Generic confirm dialog.
- `hydrated-relative-time.tsx` `[CC]`
  Hydration-safe relative time label.
- `loading-skeleton.tsx` `[SC]`
  Listing/table skeletons.

### `components/auth/`

- `login-form.tsx` `[CC]` calls `loginWithEmail`, `loginWithGoogle`, `sendPasswordResetEmail`.
- `register-form.tsx` `[CC]` calls deprecated compatibility `registerWithEmail`.
- `auth-submit-button.tsx` `[CC]` form submit button helper.

### `components/ui/`

All files under `src/components/ui/*` are shadcn/Radix-style primitives. Installed wrappers present in repo:

- `alert`, `alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip`.

## 9. Server Actions Registry

This is the concise action map. All actions live under `src/actions/*.ts`.

### `auth.ts`

- `registerIndividual(prevState, formData)`
  Validates individual registration, signs up user with metadata keys `account_type`, `first_name`, `last_name`, `full_name`, `display_name`, `terms_agreed`, `terms_version`, sends welcome email, redirects to `/listings` when session is immediate.
- `registerBusiness(prevState, formData)`
  Same pattern with metadata keys `account_type`, `first_name`, `last_name`, `representative_first_name`, `representative_last_name`, `full_name`, `display_name`, `business_name`, `business_registration`, `terms_agreed`, `terms_version`.
- `loginWithEmail(prevState, formData)`
  Signs in via Supabase password and redirects to `/listings`.
- `loginWithGoogle()`
  Starts OAuth with `redirectTo: ${NEXT_PUBLIC_APP_URL}/callback`.
- `sendPasswordResetEmail(prevState, formData)`
  Calls `supabase.auth.resetPasswordForEmail(..., { redirectTo: /reset-password })`.
- `logout()`
  Signs out then redirects `/`.

### `bookings.ts`

- `createAndPayBooking(...)`
  Validates booking form, checks self-booking, listing status, conflict RPC/fallback, computes subtotal/fees/deposit/payout, then delegates payment creation to `createCheckoutPayment`.
- `listerConfirmBooking(bookingId)`
  Requires lister, paid booking, `lister_confirmation` status; updates booking to `confirmed`, adds timeline, notifies renter.
- `listerCancelBooking(...)`
  Requires lister and `lister_confirmation|confirmed`; releases stock, marks booking cancelled, pauses listing, adds timeline, triggers refund, notifies renter.
- `confirmPayment(bookingId, paymentId)`
  Compatibility wrapper to `handlePaymentConfirmed`.
- `confirmPaymentFromWebhook(bookingId, paymentId)`
  Same compatibility path for webhook flow.
- `markReceivedByRenter(...)`
  Lister submits handover proof, calls `start_rental_period` RPC or direct fallback, notifies renter of rental start.
- `markReturnedToLister(...)`
  Renter submits return proof, calls `mark_item_returned_by_renter` RPC or fallback, notifies lister.
- `confirmReturnAndComplete(...)`
  Lister inspects return, restores stock, marks booking completed, triggers payout, creates extra notifications if damage/missing parts requires deposit review, notifies both parties.
- `cancelBookingAsRenter(...)`
  Allows renter cancellation only before active/returned; computes 0-12h / 12-24h / >24h refund overrides, releases stock, cancels booking, adds timeline, calls refund action, notifies lister.
- `raiseDispute(bookingId, reason)`
  Active/returned only; updates to `disputed`, adds timeline, notifies other party and admins, calls `holdPaymentForDispute`.
- `getIncomingBookings(userId, status?)`
  Lister-side bookings; filters out unpaid rows.
- `getMyRentals(userId, status?)`
  Renter-side bookings; filters out unpaid rows.
- `getBookingDetails(bookingId)`
  Loads booking + listing + renter + lister + timeline.
- `getBookingTimeline(bookingId)`
  Loads timeline with actor profile map.
- `expireUnconfirmedBookings()`
  Admin cron helper for expired `lister_confirmation` bookings; releases stock, cancels booking, pauses listing, adds timeline, refunds, notifies renter.
- Deprecated compatibility actions return user-facing errors:
  `markOutForDelivery`, `markItemHandedOver`, `initiateReturn`, `markItemReturned`, `completeBooking`.

### `payments.ts`

- `createCheckoutPayment(params)`
  Creates `payment_initiated` transaction, posts HitPay payment request, marks checkout transaction complete with payment request URL.
- `getCheckoutStatusForSuccessPage(checkoutId)`
  Reads checkout transaction status for success page polling.
- `handleCompletedCheckoutPayment(params)`
  Materializes booking from checkout transaction after webhook completion, creates `payment_completed` transaction, sends booking/payment notifications.
- `getFeeConfig()` / `getPlatformFees()`
  Reads and caches `fee_config`.
- `createTransactionRecord(params)`
  Inserts `transactions` row; central ledger helper.
- `syncHitPayTransferForPayout(transferId)`
  Syncs payout transfer state from HitPay.
- `applyHitPayTransferWebhookUpdate(params)`
  Applies transfer webhook state to payout.
- `createPaymentForBooking(bookingId)`
  Legacy/secondary payment-link generation for existing booking rows.
- `handlePaymentConfirmed(params)`
  Idempotently records paid booking state, transaction, timeline, and notifications.
- `processCancellationRefund(bookingId, options?)`
  Uses override amounts or RPC refund calculation, inserts refund/transaction rows, calls HitPay refund API, updates booking refund fields, adds timeline, notifies renter/admins on failure.
- `handleFailedPayout(payoutId, failureReason)`
  Marks payout failed and notifies lister/admins.
- `processPayoutToLister(payoutId, adminId?)`
  Creates `payout_initiated` transaction; bank payouts go through HitPay transfer, GCash/Maya/manual paths are marked completed internally.
- `autoTriggerPayout(bookingId)`
  Validates payout details, uses `trigger_auto_payout` RPC or app fallback, optionally processes immediately if `payout_delay_days = 0`.
- `reconcileMissingPayoutsForLister(userId)`
  Backfills missing payouts for completed bookings.
- `retryFailedPayout(payoutId)`
  Lets lister request retry if under max retry limit and payout details are valid.
- `holdPaymentForDispute(bookingId)`
  Moves pending payout to `processing`, logs `dispute_hold`, notifies admins and lister.
- `resolveDisputePayment(params)`
  Inserts `dispute_resolutions`, issues refund and/or payout according to resolution, updates booking to `completed`, adds timeline, notifies parties, logs admin action.
- Read-only helpers:
  `getTransactionsForBooking`, `getTransactionsForLister`, `getMyTransactions`, `getRefundDetails`, `getEarningsSummary`, `markPayoutFailedByAdmin`.

### `listings.ts`

- `createListing(formData)`
  Checks `canCreateListing` from payout action, uploads images, validates listing, inserts listing and initial inventory movement.
- `updateListing(listingId, formData)`
  Owner-only update; uploads new images; if quantity changes, calls `adjust_stock` RPC with `adjustment_set`.
- `deleteListing(listingId)`
  Soft archives listing.
- `setListingStatus(listingId, status)`
  Owner pause/activate.
- `getMyListings(userId)`
  Owner listings.
- `getListing(listingId)`
  Listing with owner relation.
- `getListingWithDetails(listingId)`
  Loads listing, owner, reviews, similar listings; calls `increment_views`.
- `getCategories()`
  Active categories.
- `searchListings(params)`
  Uses direct Supabase query and `textSearch(search_vector, ...)`, not a SQL `search_listings` RPC.

### `inventory.ts`

- `getInventoryOverview(userId)`
  Returns owned listings with computed stock status plus summary counters.
- `getListingStock(listingId, userId)`
  Loads listing and movement history for owner.
- `adjustStock(prevState, formData)`
  Validates and calls `adjust_stock` RPC.
- `getStockMovements(filters)`
  Paginated movement log.
- `getLowStockListings(userId)`
  Owner low-stock query.

### `messages.ts`

- `getConversations(userId)`
  Loads all conversation rows, dedupes by counterparty, hydrates profile/listing.
- `getMessages(conversationId, userId, page?)`
  Loads messages for all conversations between same two users, marks unread as read, zeros unread counters.
- `sendMessage(formData)`
  Validates content, resolves/creates conversation, inserts message, updates preview/unread counts, sends bundled message notification.
- `getOrCreateConversation(listingId, otherUserId, currentUserId)`
  Listing-scoped conversation.
- `getOrCreateDirectConversation(otherUserId, currentUserId)`
  Direct conversation without listing.

### `notifications.ts`

- `getNotifications(userId, page?, unreadOnly?)`
  Paginated notifications query.
- `getUnreadCount(userId)`
  Secure unread count.
- `markAsRead(notificationId)`
  Marks one notification read.
- `markAllAsRead(userId)`
  Marks all of current user's notifications read.
- `createNotification(params)`
  Admin-client direct insert helper; no bundling.

### `payout.ts`

- `getPayoutSetupStatus(userId)`
  Reads payout completeness and KYC status using `is_payout_setup_complete` RPC if present.
- `setupPayoutMethod(prevState, formData)`
  Validates bank/GCash/Maya details, blocks method changes when active bookings exist, logs `payout_method_history`, updates future payouts where safe, sets payout completion flags, creates notification.
- `uploadKYCDocument(prevState, formData)`
  Bank-only KYC upload to `kyc-documents`, resets completion flags, notifies admins/user.
- `verifyKYC(userId, approved, notes?)`
  Admin approval/rejection for bank KYC; updates profile payout flags, notifies user, logs admin audit.
- `canCreateListing(userId)`
  Secondary app-level listing eligibility helper based on payout setup / KYC state; note this is different from verification action `getListingEligibility`.

### `profile.ts`

- `getPublicProfile(userId)` loads profile + counts.
- `getUserListings(userId, page?)` paginated public listings by owner.
- `updateProfile(prevState, formData)` updates profile basics and email notification prefs.
- `updatePayoutSettings(prevState, formData)` legacy payout settings updater.
- `sendVerificationEmail(prevState, formData)` calls Supabase email verification flow.
- `getPayoutsForUser(userId)` loads payouts.
- `getDashboardStats(userId)` builds combined renter/lister dashboard stats.

### `reviews.ts`

- `submitReview(...)` validates booking eligibility, inserts review, marks booking reviewed flag, triggers review notification/email.
- `getReviewsForUser(userId, role?, page?)`
- `getReviewsForListing(listingId, page?)`
- `getMyWrittenReviews(userId)`
- `respondToReview(reviewId, response)`
- `getPendingReviews(userId)`

### `verification.ts`

- Individual flow: `getIndividualVerification`, `getIndividualVerificationSteps`, `submitGovernmentID`, `submitIndividualVerification`, `submitSelfie`, `checkAndUpdateOverallStatus`.
- Business flow: `getBusinessVerification`, `getBusinessVerificationSteps`, `submitBusinessDetails`, `submitBusinessDocument`, `submitRepresentativeID`, `submitRepresentativeSelfie`, `checkAndUpdateBusinessStatus`.
- Admin flow: `approveVerification`, `rejectVerification`, `verifyIndividualDocument`, `verifyBusinessDocument`, `getVerificationQueue`.
- Eligibility: `getListingEligibility(userId)` calls `can_user_create_listing` RPC and returns `{ allowed, reason?, message? }`.

### `favorites.ts`

- `toggleFavorite(listingId)`
- `getFavorites(userId, page?)`
- `checkFavorites(listingIds, userId?)`

### `admin.ts`

Contains all admin CRUD/analytics/moderation actions summarized in the AST table above: dashboard stats, user moderation, KYC queue, listing moderation, booking dispute helpers, payout operations, review/report/category/settings/audit-log management.

### `hitpay.ts`

- `createPaymentForBooking(bookingId)` compatibility wrapper around legacy payment flow.
- `checkPaymentStatus(bookingId)` fetches payment request status.

## 10. Lib Files

### `src/lib/supabase/client.ts`

- Exports: `createClient()`.
- Use in: browser/client components only.
- Behavior: creates browser Supabase client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### `src/lib/supabase/server.ts`

- Exports: `createClient()`.
- Use in: server components, server actions, route handlers needing session cookies.
- Cookies: uses `next/headers` `cookies()` store; `setAll` writes when possible, and silently ignores write failures in server components because middleware is expected to refresh sessions.

### `src/lib/supabase/admin.ts`

- Exports: `createAdminClient()`.
- Use only in: webhooks, admin operations, refund/payout processing, cross-user notifications, audit writes.
- Why it bypasses RLS: it authenticates with `SUPABASE_SERVICE_ROLE_KEY`, not the anon/session user.

### `src/lib/email.ts`

- `sendWelcomeEmail({ to, displayName, accountType })`
- `sendBookingConfirmationRequiredEmail({ to, listerName, renterName, listingTitle, rentalUnits, pricingPeriod, quantity, totalPrice, deadline, bookingId })`
- `sendBookingConfirmedEmail({ to, renterName, listerName, listingTitle, rentalUnits, pricingPeriod, quantity, totalPrice, bookingId })`
- `sendBookingCancelledEmail({ to, recipientName, cancelledByName, cancelledByRole, listingTitle, rentalUnits, pricingPeriod, totalPrice, refundAmount, refundPercent, reason?, bookingId, recipientRole })`
- `sendPaymentConfirmedEmail({ to, recipientName, role, listingTitle, rentalUnits, pricingPeriod, quantity, amountPaid?, payoutAmount?, paymentReference, bookingId })`
- `sendPayoutProcessedEmail({ to, listerName, amount, payoutMethod, reference?, listingTitle, bookingId })`
- `sendPayoutFailedEmail({ to, listerName, amount, reason })`
- `sendRefundInitiatedEmail({ to, renterName, refundAmount, originalAmount, reason, listingTitle, bookingId })`
- `sendRentalStartedEmail({ to, renterName, listerName, listingTitle, rentalUnits, pricingPeriod, rentalEndsAt, bookingId })`
- `sendItemReturnedEmail({ to, listerName, renterName, listingTitle, isLate, returnedAt, bookingId })`
- `sendRentalCompletedEmail({ to, recipientName, role, listingTitle, otherPartyName, bookingId })`
- `sendReviewReceivedEmail({ to, recipientName, reviewerName, rating, comment?, listingTitle })`
- `sendVerificationApprovedEmail({ to, displayName, accountType })`
- `sendVerificationRejectedEmail({ to, displayName, reason, rejectedItems })`
- `sendDisputeRaisedEmail({ to, recipientName, raisedByName, listingTitle, disputeReason, bookingId, recipientRole })`
- `sendDisputeResolvedEmail({ to, recipientName, role, listingTitle, outcome, amount, resolutionNotes, bookingId })`
- `sendConfirmationDeadlineWarningEmail({ to, listerName, listingTitle, renterName, hoursRemaining, deadline, bookingId })`

Behavior notes:

- Uses Resend only when `RESEND_API_KEY` exists.
- Uses `NEXT_PUBLIC_APP_URL` to build internal links.
- Falls back to `"RentHub <noreply@renthub.com>"` sender identity if env vars are missing.

### `src/lib/notifications.ts`

- Core:
  `sendNotification(params)` decides bundled vs individual path.
- Domain helpers:
  `notifyNewMessage`, `notifyNewReview`, `notifyNewBookingRequest`, `notifyBookingAccepted`, `notifyBookingDeclined`, `notifyBookingCancelled`, `notifyBookingCompleted`, `notifyPaymentConfirmed`, `notifyPayoutCompleted`, `notifyPayoutFailed`, `notifyRefundInitiated`, `notifyRentalStarted`, `notifyItemReturned`, `notifyDisputeRaised`, `notifyDisputeResolved`, `notifyListerConfirmationWarning`, `notifyLowStock`, `notifyOutOfStock`, `notifyKYCSubmitted`, `notifyKYCVerified`, `notifyKYCRejected`, `notifyBookingExpired`, `getAdminIds`.

Bundling behavior:

- Bundled path uses RPC `upsert_bundled_notification` when notification config says `shouldBundle`.
- Individual path uses RPC `create_individual_notification`.
- Many booking/review/payment helpers also trigger corresponding email functions when preferences permit.

### `src/lib/hitpay.ts`

- `createPaymentRequest(params)` posts to HitPay `/payment-requests`.
- `getPaymentStatus(paymentRequestId)` fetches payment request status.
- `verifyWebhookSignature(payload, signature)` verifies HMAC/signature variants.
- `calculatePricing({ listing, startDate, endDate, quantity, pricingPeriod })` computes subtotal/fees/deposit/payout.

### `src/lib/utils.ts`

- `cn(...inputs)` class merge.
- `formatCurrency(amount, currency = "USD")`
- `formatDate(date)`
- `formatRelativeTime(date)`
- `getInitials(name)`
- `slugify(text)`
- `getPayoutMethodLabel(method)`
- `getPayoutMethodIcon(method)`
- `formatPhoneNumber(phone)`
- `maskAccountNumber(accountNumber)`
- `formatTransactionType(eventType)`
- `formatTransactionStatus(status)`
- `calculatePaymentBreakdown({ subtotal, depositAmount, pricingPeriod, fees })`
- `formatListingLocation(city?, state?, fallback?)`

### `src/lib/validations.ts`

Main Zod schemas:

- auth: `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `individualRegisterSchema`, `businessRegisterSchema`
- listings/bookings: `listingSchema`, `bookingSchema`
- verification: `individualVerificationSchema`, `businessVerificationSchema`
- booking ops: `listerCancelSchema`, `handoverProofSchema`, `returnProofSchema`, `returnItemSchema` (deprecated), `confirmReturnSchema`, `markDeliveredSchema` (deprecated)
- reviews/messages/profile: `reviewSchema`, `messageSchema`, `profileUpdateSchema`
- inventory/payout/admin: `stockAdjustmentSchema`, `payoutMethodSchema`, `kycUploadSchema`, `disputeResolutionSchema`, `payoutRetrySchema`, `feeConfigUpdateSchema`

Key rules:

- individual password: min 8, max 72, uppercase, numeric, confirm match.
- business password: same.
- listing: at least one price field, at least one image, description min 20.
- booking: `listing_id` uuid, rental units >= 1, quantity >= 1.
- payout bank: validated bank name, 10-20 digit account number, required name.
- GCash/Maya: Philippine mobile regex.
- dispute split: refund percent + payout percent must total 100.

Inferred types exported for all schemas, e.g. `LoginInput`, `ListingInput`, `BookingInput`, `PayoutMethodInput`, `DisputeResolutionInput`, etc.

## 11. Types & Interfaces

`src/types/index.ts` defines:

- string unions for account, verification, listing, pricing, booking, review, report, moderation, stock, payout, payment-event, refund, dispute, notification-related types
- DB-mapped interfaces: `Profile`, `IndividualVerification`, `BusinessVerification`, `Category`, `Listing`, `Booking`, `InventoryMovement`, `Payout`, `Transaction`, `Refund`, `DisputeResolution`, `Review`, `Report`, `AdminAuditLog`, `Conversation`, `Message`, `Favorite`, `Notification`, `BookingTimeline`
- utility/computed types:
  `ListingWithOwner`, `BookingWithDetails`, `BookingTimelineWithActor`, `TransactionWithDetails`, `RefundWithDetails`, `PayoutWithDetails`, `DisputeResolutionWithAdmin`, `ConversationWithDetails`, `ReviewWithUsers`, `ReportWithDetails`, `PaginatedResponse<T>`, `PricingCalculation`, `ActionResponse`, `PayoutMethodDetails`, `PayoutSetupStatus`
- dashboard interfaces:
  `InventorySummary`, `ListerDashboardStats`, `RenterDashboardStats`, `DashboardStats`, `AdminDashboardStats`

### `NOTIFICATION_CONFIG`

Structure per key:

- `label`
- `icon`
- `color`
- `shouldBundle`
- optional `bundleKey`
- optional `bundleTitleTemplate`
- `defaultActionUrl`
- `priority`

### `BOOKING_STATUS_CONFIG`

Structure per status:

- `label`
- `color`
- `icon`
- `description`
- `next_statuses`

Important type mismatch:

- TypeScript status map includes newer statuses (`lister_confirmation`, `returned`) and legacy compatibility statuses (`pending`, `awaiting_payment`, `out_for_delivery`) that are not aligned with checked-in SQL enum definition.

## 12. Booking Flow

### State machine actually used by app

Primary modern flow:

`lister_confirmation -> confirmed -> active -> returned -> completed`

Cancellation and dispute exits:

- `lister_confirmation -> cancelled_by_renter`
- `lister_confirmation -> cancelled_by_lister`
- `confirmed -> cancelled_by_renter`
- `confirmed -> cancelled_by_lister`
- `confirmed -> active`
- `active -> returned`
- `active -> disputed`
- `returned -> completed`
- `returned -> disputed`
- `disputed -> completed` after admin resolution

### Status meanings

- `lister_confirmation`: payment is complete, stock is reserved, and the lister has 24 hours to confirm unless `instant_book` auto-confirms immediately.
- `confirmed`: paid and confirmed, waiting for physical handover.
- `active`: item handed over; rental clock is running.
- `returned`: renter marked item returned with proof; awaiting lister inspection.
- `completed`: lister accepted return and booking is finished; payout may be queued/processed.
- `cancelled_by_renter`: renter cancelled before active state.
- `cancelled_by_lister`: lister cancelled or system auto-cancelled after timeout; listing is paused in timeout cases.
- `disputed`: active or returned booking escalated for admin decision.

### Trigger ownership

| Transition | Triggered by | Action |
|---|---|---|
| create checkout | renter | `createAndPayBooking` |
| checkout webhook -> `lister_confirmation` or `confirmed` | system | `handleCompletedCheckoutPayment` / `handlePaymentConfirmed` |
| `lister_confirmation -> confirmed` | lister | `listerConfirmBooking` |
| `confirmed -> active` | lister | `markReceivedByRenter` |
| `active -> returned` | renter | `markReturnedToLister` |
| `returned -> completed` | lister | `confirmReturnAndComplete` |
| cancel before active | renter | `cancelBookingAsRenter` |
| cancel before active | lister | `listerCancelBooking` |
| timeout auto-cancel | system/cron | `expireUnconfirmedBookings` |
| `active|returned -> disputed` | renter or lister | `raiseDispute` |
| `disputed -> completed` | admin | `resolveDisputePayment` |

### Stock behavior

- Reserve: at successful payment/booking materialization, not at booking form submit.
- Held during: `lister_confirmation`, `confirmed`, `active`, `returned`.
- Released: renter/lister cancellation or auto-cancel.
- Returned/restored: on completion after lister inspection.

### Notifications / emails

- Payment complete:
  renter gets payment confirmed;
  lister gets payment received;
  if not instant book, lister also gets booking request/confirmation-required messaging.
- Lister confirmation warning:
  12h and 2h reminder from cron.
- Handover:
  renter gets rental started notification/email.
- Return:
  lister gets item returned notification/email.
- Completion:
  both sides get booking completed notification/email.
- Cancellation:
  counterparty gets booking cancelled notification/email.
- Dispute:
  other party and admins get dispute raised; both parties get dispute resolved.

### Cancellation refund rules implemented in app

The app-level renter cancellation logic in `cancelBookingAsRenter` is authoritative for current UX:

- `<= 12 hours since payment`: 100% refund of `total_price`.
- `> 12 and <= 24 hours since payment`: 50% of rental subtotal plus full deposit.
- `> 24 hours since payment`: deposit only.

Lister cancellation / auto-cancel:

- Full refund.
- Listing is paused when lister cancels or times out.

Important note:

- SQL function `calculate_cancellation_refund` uses listing cancellation policy and **hours since payment**, not actual hours before start date, so current repo has policy logic plus app overrides. The app applies explicit overrides for renter cancellations and uses RPC/default logic otherwise.

### Payment flow

1. Renter submits booking widget.
2. `createAndPayBooking` validates, computes totals, calls `createCheckoutPayment`.
3. `createCheckoutPayment` inserts a `payment_initiated` checkout transaction and creates a HitPay payment request.
4. Renter is redirected to HitPay hosted checkout.
5. HitPay webhook hits `/api/webhooks/hitpay`.
6. For checkout-style references, `handleCompletedCheckoutPayment` creates the booking row from checkout metadata, reserves stock, records `payment_completed`, writes timeline, sends notifications.
7. For existing booking references, `handlePaymentConfirmed` idempotently marks booking paid and sends notifications.
8. If `instant_book = true`, booking immediately becomes `confirmed`; otherwise it stays in `lister_confirmation` with a 24-hour deadline.
9. After completion, `autoTriggerPayout` creates payout record and optionally processes immediately if fee config delay is `0`.

### HitPay webhook idempotency

- Checkout confirmation uses `payment_confirmed_checkout_${checkoutId}` transaction idempotency.
- Existing booking confirmation uses `payment_confirmed_${bookingId}`.
- Webhook route also tries advisory lock via `try_acquire_booking_webhook_lock`.
- On partial persistence failure, admins are notified for manual review.

## 13. Verification Flows

### Individual verification

Required for listing creation in current verification flow:

- government ID front/back
- selfie
- admin approval

Collected but not required for listing eligibility in type comments:

- email verification
- phone verification

Steps:

1. `ensureIndividualVerificationRecord` creates row if missing.
2. User submits government ID via `submitGovernmentID` or combined `submitIndividualVerification`.
3. User submits selfie via `submitSelfie` or combined submission.
4. `checkAndUpdateOverallStatus` checks `hasIndividualSubmission(...)`.
5. Once all required artifacts exist and status is neither pending nor approved, `overall_status` becomes `pending`.
6. Admin reviews field-level items and then uses `approveVerification` or `rejectVerification`.

Rejection:

- `rejectVerification` sets `overall_status = rejected`, sets `overall_rejection_reason`, and applies field-specific rejection flags/reasons.
- User is notified with rejected field list and resubmit guidance.

### Business verification

Required for listing creation:

- business details (`business_address`, `tin`; business phone collected too)
- business document
- representative government ID front/back
- representative selfie
- admin approval

Steps:

1. `ensureBusinessVerificationRecord` creates row if missing.
2. `submitBusinessDetails`
3. `submitBusinessDocument`
4. `submitRepresentativeID`
5. `submitRepresentativeSelfie`
6. `checkAndUpdateBusinessStatus` flips `overall_status` to `pending` once all required items are submitted.
7. Admin approves or rejects.

### Listing eligibility

There are two related checks:

1. `src/actions/verification.ts:getListingEligibility`
   - Calls RPC `can_user_create_listing`.
   - Returns rich `{ allowed, reason, message }`.
2. `src/actions/payout.ts:canCreateListing`
   - App-level payout/KYC gating helper for listing creation UI.

Current blocking reasons surfaced by app:

- unauthorized access
- generic verification requirements incomplete
- bank KYC pending
- bank KYC rejected
- payout method not set up

## 14. Payment & Payout System

### HitPay integration

- Base sandbox URL default: `https://api.sandbox.hit-pay.com/v1`
- Header auth: `X-BUSINESS-API-KEY`
- Payment request endpoint: `POST /payment-requests`
- Payment request fields sent:
  `amount`, `currency`, `email`, `name`, `purpose`, `reference_number`, `redirect_url`, `webhook`, `allow_repeated_payments=false`

### Webhook verification

Form-encoded webhooks:

- Use `hmac` field in body.
- Verification message is sorted keys excluding `hmac`, concatenated as `key + value`.
- HMAC: `sha256` with `HITPAY_WEBHOOK_SALT`.

JSON webhooks:

- Use `Hitpay-Signature` header.
- Route supports hex and base64-ish signatures.
- Signature is HMAC-SHA256 over raw request body.
- If JSON signature fails for a completed payment, route can fall back to verifying the payment request against HitPay API before accepting.

Transfer webhooks:

- Identified by header `Hitpay-Event-Object: transfer`.
- Passed to `applyHitPayTransferWebhookUpdate`.

### Fee structure

`fee_config` keys:

- `hitpay_percentage_fee`: variable HitPay fee
- `hitpay_fixed_fee`: fixed HitPay fee
- `platform_service_fee_renter`: renter fee rate
- `platform_service_fee_lister`: lister fee rate
- `platform_absorbs_hitpay_fee`: boolean-ish number
- cancellation threshold keys
- `payout_delay_days`
- `max_payout_retry_count`

Renter total calculation:

- `subtotal = unit_price * rental_units * quantity`
- `service_fee_renter = subtotal * renter fee`
- `deposit_amount = listing.deposit_amount * quantity`
- `total_price = subtotal + service_fee_renter + deposit_amount`
- if platform does not absorb HitPay fee, renter is charged `total_price + hitpay_fee`

Lister payout calculation:

- `service_fee_lister = subtotal * lister fee`
- `lister_payout = subtotal - service_fee_lister`

Platform revenue:

- renter service fee
- lister service fee
- plus absorbed HitPay fee logic depending on `platform_absorbs_hitpay_fee`

### Payout methods

- `bank`
  required: `bank_name`, `bank_account_number`, `bank_account_name`, plus uploaded KYC document and admin KYC approval.
- `gcash`
  required: `gcash_phone_number`; no bank KYC required.
- `maya`
  required: `maya_phone_number`; no bank KYC required.

`payout_setup_completed` logic:

- bank: false until KYC document uploaded and approved
- gcash/maya: true immediately after method details are valid and saved

### Refund logic

Automatic refund triggers in current code:

- lister cancellation
- renter cancellation before active state
- system auto-cancel after lister timeout
- dispute resolutions can create refunds too

Implementation:

- `processCancellationRefund` inserts refund/transaction rows first.
- Calls HitPay refund API via existing payment request/payment ids.
- Tracks `pending` -> `completed` / `processing` / `failed`.
- On expired/unavailable HitPay refund scenarios, admins are notified for manual processing.

## 15. Notification System

### Notification type matrix

| type | bundled | bundle key | priority | default action | email? |
|---|---:|---|---|---|---:|
| `new_message` | yes | `messages_{userId}` | low | `/dashboard/messages` | no |
| `review_received` | yes | `reviews_{userId}` | low | `/dashboard/reviews` | yes |
| `low_stock` | yes | `low_stock_{userId}` | medium | `/dashboard/inventory` | no direct email in helper |
| `out_of_stock` | yes | `out_of_stock_{userId}` | medium | `/dashboard/inventory` | no direct email in helper |
| `booking_request` | yes | `booking_requests_{userId}` | medium | `/lister/bookings` | yes |
| `booking_confirmation_required` | no | — | medium | `/lister/bookings` | yes |
| `booking_accepted` | no | — | urgent | `/renter/rentals` | yes |
| `booking_declined` | no | — | high | `/dashboard/my-rentals` | no email helper |
| `booking_cancelled` | no | — | high | `/renter/rentals` | yes |
| `booking_completed` | no | — | medium | `/renter/rentals` | yes |
| `payment_confirmed` | no | — | urgent | `/renter/rentals` | yes |
| `payment_received` | no | — | urgent | `/dashboard/earnings` | yes |
| `payment_failed` | no | — | urgent | `/dashboard/my-rentals` | no dedicated email helper |
| `payout_initiated` | no | — | medium | `/dashboard/earnings` | no |
| `payout_completed` | no | — | high | `/dashboard/earnings` | yes |
| `payout_failed` | no | — | urgent | `/dashboard/settings/payments` | yes |
| `refund_initiated` | no | — | high | `/renter/rentals` | yes |
| `refund_completed` | no | — | high | `/renter/rentals` | no dedicated helper |
| `dispute_raised` | no | — | urgent | `/renter/rentals` | yes |
| `dispute_resolved` | no | — | high | `/renter/rentals` | yes |
| `rental_started` | no | — | high | `/renter/rentals` | yes |
| `item_returned` | no | — | high | `/lister/bookings` | yes |
| `booking_expired` | no | — | high | `/renter/rentals` | no email helper |
| `kyc_verified` | no | — | high | `/dashboard/settings/payments` | mixed |
| `kyc_rejected` | no | — | urgent | `/dashboard/settings/payments` | mixed |
| `payout_retry_requested` | no | — | high | `/admin/payouts` | no |
| `return_condition_issue` | no | — | urgent | `/dashboard/bookings` | no |
| `admin_alert` | no | — | urgent | `/admin` | no |
| `new_kyc_submission` | yes | `kyc_submissions_admin` | medium | `/admin/kyc-verification` | no |
| `system_error` | no | — | urgent | `/admin` | no |

### Bundled vs individual

Bundled types:

- `new_message`
- `review_received`
- `low_stock`
- `out_of_stock`
- `booking_request`
- `new_kyc_submission`

Individual types:

- everything else

Bundle mechanics:

- Implemented in app through RPC expectation `upsert_bundled_notification`.
- `bundle_count` increments as more events join the bundle.
- `bundle_preview` stores short recent preview items.
- bundle resets conceptually when item is read or a new bundle row is created after prior one is closed; exact SQL implementation is missing from checked-in repo.

## 16. Email System

### Templates

| File | Props | Subject line source | When sent |
|---|---|---|---|
| `src/emails/welcome.tsx` | `displayName`, `accountType`, `verifyUrl` | `Welcome to RentHub, {displayName}!` | registration |
| `booking-confirmation-required.tsx` | lister/renter/listing/price/deadline props | `New booking for "{listingTitle}"...` | paid non-instant booking awaiting lister |
| `booking-confirmed.tsx` | renter/lister/listing props | `Booking confirmed` | lister confirmed |
| `booking-cancelled.tsx` | cancellation + refund props | `Booking cancelled` | cancellation |
| `payment-confirmed.tsx` | role-based payment props | renter or lister payment subject | payment confirmed |
| `payout-processed.tsx` | payout props | `Payout of SGD $... sent!` | payout complete |
| `payout-failed.tsx` | payout failure props | `Action required... payout failed` | payout failure |
| `refund-initiated.tsx` | refund props | `Refund of SGD $... initiated` | refund started |
| `rental-started.tsx` | rental start props | `Rental started` | handover complete |
| `item-returned.tsx` | return props | normal or late return subject | renter marked return |
| `rental-completed.tsx` | completion props | `Rental completed — leave a review!` | booking completed |
| `review-received.tsx` | review props | `{reviewer} left you a {rating}-star review` | review submitted |
| `verification-approved.tsx` | verification props | `Verification approved` | admin approval |
| `verification-rejected.tsx` | rejection props | `Verification update — action required` | admin rejection |
| `dispute-raised.tsx` | dispute props | `Dispute raised` | dispute opened |
| `dispute-resolved.tsx` | dispute outcome props | `Dispute resolved` | dispute resolved |
| `confirmation-deadline-warning.tsx` | warning props | reminder/urgent subject | 12h/2h lister deadline warnings |
| `base-layout.tsx` | layout helpers | n/a | shared layout/helpers only |

### Env vars needed

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

## 17. Inventory Management

### Stock fields

- `quantity_total`: total units owned/listed.
- `quantity_available`: units currently free to book.
- `quantity_reserved`: units held by in-flight or active bookings.
- `low_stock_threshold`: threshold where low-stock notification may fire.
- `track_inventory = false`: listing behaves like effectively unlimited stock in `get_available_stock`; app still stores base fields but search and booking guards treat it as non-tracked.

### Lifecycle

- Reserved:
  on successful paid booking materialization / payment confirmation (`reserve_stock`).
- Deducted vs reserved:
  code mostly treats reservation as the operative deduction; naming uses both `stock_reserved` and legacy `stock_deducted`.
- Released:
  renter/lister cancellation and auto-cancel (`release_stock`).
- Returned:
  lister completes booking (`return_stock`).
- Manual adjustments:
  `adjustment_add`, `adjustment_remove`, `adjustment_set`, `damaged`, `lost`.

### `stock_movement_type` values

- `initial`: listing creation initial stock row.
- `adjustment_add`: owner adds stock.
- `adjustment_remove`: owner removes available stock.
- `adjustment_set`: owner sets total to absolute value.
- `booking_reserved`: booking payment reserved stock.
- `booking_released`: cancellation released stock.
- `booking_returned`: completion restored stock.
- `damaged`: stock permanently reduced due to damage.
- `lost`: stock permanently reduced due to loss.

## 18. Color Theme & Design System

### Brand colors

| Hex | Name | CSS/Tailwind usage |
|---|---|---|
| `#2e2e2f` | Dark Charcoal | `bg-brand-dark`; maps to dark neutral brand surface/text contrast contexts. |
| `#003e86` | Navy | `bg-brand-navy`, `text-brand-navy`; primary brand action color. |
| `#3768a2` | Steel Blue | `bg-brand-steel`, `text-brand-steel`; secondary brand accent. |
| `#38bdf2` | Sky Blue | `bg-brand-sky`, `text-brand-sky`; highlight/accent color. |
| `#f2f2f2` | Off-White | `bg-brand-light`; app shell background. |

### CSS custom properties in `globals.css`

- `--background: 0 0% 95%`
- `--foreground: 240 1% 18%`
- `--card`
- `--card-foreground`
- `--popover`
- `--popover-foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--border`
- `--input`
- `--ring`
- `--radius`
- `--chart-1..5`
- `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`
- dark-mode variants for all major semantic colors

### Tailwind custom classes

Defined in `src/tailwind.config.ts` and/or `globals.css`:

- theme extension namespace `brand.dark`, `brand.navy`, `brand.steel`, `brand.sky`, `brand.light`
- utility classes added in CSS:
  `text-brand-navy`, `text-brand-steel`, `text-brand-sky`, `bg-brand-navy`, `bg-brand-steel`, `bg-brand-sky`, `bg-brand-dark`, `bg-brand-light`

### Shadcn components installed

From `src/components/ui/*`:

- alert
- alert-dialog
- avatar
- badge
- button
- calendar
- card
- checkbox
- command
- dialog
- dropdown-menu
- form
- input
- label
- popover
- progress
- radio-group
- scroll-area
- select
- separator
- sheet
- skeleton
- sonner
- switch
- table
- tabs
- textarea
- tooltip

### Design patterns

- Primary button:
  usually navy background with white text, e.g. `bg-brand-navy text-white hover:bg-brand-steel`.
- Secondary button:
  often `variant="outline"` or white on navy header contexts.
- Card style:
  rounded (`rounded-2xl` frequently), bordered, `bg-background`, light shadow.
- Form field style:
  shadcn inputs/selects with muted label/help text.
- Status badges:
  `BOOKING_STATUS_CONFIG` colors:
  orange for waiting, blue for confirmed, green for active, indigo for returned, emerald for completed, red for cancelled/disputed.

## 19. Middleware & Auth

### Middleware rules

Actual middleware file is `src/middleware.ts` even though the prompt listed root `middleware.ts`.

Protected route patterns:

- `/lister`
- `/renter`
- `/account`

Auth route patterns:

- `/login`
- `/register`

Admin route check:

- **Not done in middleware**.
- Admin-only enforcement is in `src/app/admin/layout.tsx` by loading `profiles.is_admin` and redirecting non-admins to `/dashboard`.

Redirect logic:

- `/dashboard` -> `/listings`
- unauthenticated access to protected routes -> `/login?redirectedFrom=<pathname>`
- authenticated access to `/login` or `/register` -> `/listings`

### Auth flow

- Individual registration captures:
  `first_name`, `last_name`, `display_name`, `email`, `password`, `terms_agreed`
- Business registration captures:
  `representative_first_name`, `representative_last_name`, `display_name`, `business_name`, `business_registration`, `email`, `password`, `terms_agreed`
- Metadata sent to Supabase is described in Section 9 `auth.ts`.
- `handle_new_user` inserts initial `profiles` row from auth metadata.
- After email/password login: redirect `/listings`
- After register with immediate session: redirect `/listings`
- OAuth callback destination after `exchangeCodeForSession`: `/listings`

## 20. Known Issues & Decisions

- `createAndPayBooking` uses idempotent checkout transactions so a double-submit can be matched back to one payment-init flow.
- Stock is reserved at payment confirmation / booking materialization, not at raw form submit, to avoid dead inventory from abandoned carts while still preventing overbooking once money is captured.
- Urgent notifications are individual because bundling would hide immediately-actionable events like disputes, payout failures, and payment confirmations.
- `RESEND_API_KEY` missing does not crash flows; emails are skipped with warnings, which makes local development easier.
- Webhooks use `createAdminClient()` because webhook requests are not user-authenticated and must bypass RLS to mutate bookings, transactions, refunds, payouts, and notifications safely.
- The checked-in SQL is behind the app code:
  newer booking statuses/columns, payout fields, bundling fields, payout history, and some RPCs are referenced by TypeScript but missing from migrations in repo.
- Legacy route migration is in progress:
  many `/lister/*` and `/renter/*` routes re-export older `/dashboard/*` pages.
- Deprecated compatibility actions still exist for older UI names but intentionally return guidance errors.

## 21. File Tree

```text
src/
  actions/
    admin.ts [SA]
    auth.ts [SA]
    bookings.ts [SA]
    favorites.ts [SA]
    hitpay.ts [SA]
    inventory.ts [SA]
    listings.ts [SA]
    messages.ts [SA]
    notifications.ts [SA]
    payments.ts [SA]
    payout.ts [SA]
    profile.ts [SA]
    reports.ts [SA]
    reviews.ts [SA]
    verification.ts [SA]
  app/
    (auth)/
      callback/route.ts [API]
      layout.tsx [SC]
      login/page.tsx [SC]
      register/page.tsx [CC]
    account/
      messages/page.tsx [SC]
      messages/[id]/page.tsx [SC]
      notifications/page.tsx [SC]
      profile/page.tsx [SC]
      verify/page.tsx [SC]
    admin/
      analytics/page.tsx [SC]
      audit-log/page.tsx [SC]
      bookings/page.tsx [SC]
      bookings/[id]/page.tsx [SC]
      categories/page.tsx [SC]
      inventory/page.tsx [SC]
      kyc-verification/page.tsx [SC]
      layout.tsx [SC]
      listings/page.tsx [SC]
      listings/[id]/page.tsx [SC]
      page.tsx [SC]
      payouts/page.tsx [SC]
      reports/page.tsx [SC]
      reports/[id]/page.tsx [SC]
      reviews/page.tsx [SC]
      settings/page.tsx [SC]
      transactions/page.tsx [SC]
      users/page.tsx [SC]
      users/[id]/page.tsx [SC]
      verifications/page.tsx [SC]
    api/
      cron/check-deadlines/route.ts [API]
      test-email/route.ts [API]
      webhooks/hitpay/route.ts [API]
    auth/logout/route.ts [API]
    dashboard/
      bookings/[id]/page.tsx [SC]
      earnings/page.tsx [SC]
      favorites/page.tsx [SC]
      inventory/page.tsx [SC]
      inventory/[listingId]/page.tsx [SC]
      inventory/adjustments/page.tsx [SC]
      inventory/loading.tsx [SC]
      layout.tsx [SC]
      loading.tsx [SC]
      messages/page.tsx [SC]
      messages/[conversationId]/page.tsx [SC]
      messages/loading.tsx [SC]
      my-listings/page.tsx [SC]
      my-listings/[id]/edit/page.tsx [SC]
      my-listings/loading.tsx [SC]
      my-rentals/page.tsx [SC]
      notifications/page.tsx [SC]
      page.tsx [SC]
      requests/page.tsx [SC]
      requests/loading.tsx [SC]
      reviews/page.tsx [SC]
      reviews/loading.tsx [SC]
      settings/page.tsx [SC]
      settings/payments/page.tsx [SC]
      settings/verification/page.tsx [SC]
    fees/page.tsx [SC]
    globals.css [LIB]
    layout.tsx [SC]
    listings/
      loading.tsx [SC]
      new/page.tsx [SC]
      page.tsx [SC]
      [id]/loading.tsx [SC]
      [id]/not-found.tsx [SC]
      [id]/page.tsx [SC]
    lister/
      bookings/page.tsx [SC]
      bookings/[id]/page.tsx [SC]
      dashboard/page.tsx [SC]
      earnings/page.tsx [SC]
      inventory/page.tsx [SC]
      layout.tsx [SC]
      listings/page.tsx [SC]
      listings/new/page.tsx [SC]
      listings/[id]/edit/page.tsx [SC]
      reviews/page.tsx [SC]
      settings/page.tsx [SC]
      settings/payments/page.tsx [SC]
    maintenance/page.tsx [SC]
    not-found.tsx [SC]
    page.tsx [SC]
    payment/
      cancel/page.tsx [SC]
      success/page.tsx [SC]
    policies/page.tsx [SC]
    renter/
      dashboard/page.tsx [SC]
      favorites/page.tsx [SC]
      layout.tsx [SC]
      rentals/page.tsx [SC]
      rentals/[id]/page.tsx [SC]
      reviews/page.tsx [SC]
      settings/page.tsx [SC]
    reset-password/page.tsx [CC]
    users/[id]/page.tsx [SC]
    error.tsx [CC]
    favicon.ico
    maintenance/page.tsx [SC]
  components/
    admin/ ... [SC/CC]
    auth/ ... [CC]
    bookings/ ... [SC/CC]
    inventory/ ... [SC/CC]
    layout/ ... [SC/CC]
    listings/ ... [SC/CC]
    messages/ ... [CC]
    notifications/ ... [CC]
    payments/ ... [SC/CC]
    payout/ ... [SC/CC]
    profile/ ... [SC/CC]
    reviews/ ... [SC/CC]
    shared/ ... [SC/CC]
    ui/ ... [SC/CC]
  emails/
    base-layout.tsx [EMAIL]
    booking-cancelled.tsx [EMAIL]
    booking-confirmation-required.tsx [EMAIL]
    booking-confirmed.tsx [EMAIL]
    confirmation-deadline-warning.tsx [EMAIL]
    dispute-raised.tsx [EMAIL]
    dispute-resolved.tsx [EMAIL]
    item-returned.tsx [EMAIL]
    payment-confirmed.tsx [EMAIL]
    payout-failed.tsx [EMAIL]
    payout-processed.tsx [EMAIL]
    refund-initiated.tsx [EMAIL]
    rental-completed.tsx [EMAIL]
    rental-started.tsx [EMAIL]
    review-received.tsx [EMAIL]
    verification-approved.tsx [EMAIL]
    verification-rejected.tsx [EMAIL]
    welcome.tsx [EMAIL]
  hooks/
    use-realtime.ts [HOOK]
    use-user.ts [HOOK]
  lib/
    bookings.ts [LIB]
    email.ts [LIB]
    env.ts [LIB]
    hitpay.ts [LIB]
    notification-meta.ts [LIB]
    notifications.ts [LIB]
    supabase/
      admin.ts [LIB]
      client.ts [LIB]
      server.ts [LIB]
    utils.ts [LIB]
    validations.ts [LIB]
  middleware.ts [LIB]
  tailwind.config.ts [LIB]
  types/
    index.ts [TYPE]
```

## 22. Quick Reference Cheatsheet

### Supabase clients

- Use `createClient()` from `@/lib/supabase/server` for server components and server actions.
- Use `createClient()` from `@/lib/supabase/client` for client components.
- Use `createAdminClient()` from `@/lib/supabase/admin` for webhooks and admin-only operations.

### Common patterns

Get current user in a server action:

```ts
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) throw new Error("You must be signed in");
```

Get current user in a server component:

```ts
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) redirect("/login");
```

Protect a server action:

```ts
const auth = await requireAuthenticatedUser();
if (!auth) {
  return { error: "You must be signed in." };
}
```

Call Supabase RPC:

```ts
const { data, error } = await supabase.rpc("adjust_stock", {
  p_listing_id: listingId,
  p_user_id: userId,
  p_adjustment_type: "adjustment_set",
  p_quantity: qty,
  p_reason: "Updated listing quantity",
});
```

Send a notification:

```ts
import { sendNotification } from "@/lib/notifications";
await sendNotification({
  userId,
  type: "booking_cancelled",
  title: "Booking cancelled",
  bookingId,
});
```

Send an email:

```ts
import { sendBookingConfirmedEmail } from "@/lib/email";
await sendBookingConfirmedEmail({ ...params });
```

### Always do this

- Always use `createAdminClient()` for webhooks, refunds, payout processing, and cross-user notification writes.
- Always treat `payment_confirmed_*` idempotency keys as authoritative for webhook dedupe.
- Always reserve/release/return stock through RPC or their app fallbacks, not ad hoc math.
- Always add booking timeline entries for state transitions.
- Always check both auth and role ownership before mutating bookings/messages/reviews.

### Never do this

- Never assume checked-in SQL matches all app fields; check for schema drift first.
- Never use browser or session clients for webhook/admin mutations.
- Never bundle urgent action-required notifications.
- Never allow payout method changes while active bookings are present.
- Never cancel active or returned bookings through cancellation actions; dispute instead.

### Booking status flow

`lister_confirmation -> confirmed -> active -> returned -> completed`

### Stock operations

- Reserve: `reserve_stock(listingId, bookingId, qty, userId)`
- Release: `release_stock(listingId, bookingId, qty, userId)`
- Return: `return_stock(listingId, bookingId, qty, userId)`
- Adjust: `adjust_stock(listingId, userId, type, qty, reason)`
