"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createListing, updateListing } from "@/actions/listings";
import { ImageUpload } from "@/components/listings/image-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Category, Listing } from "@/types";

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const listingFormSchema = z
  .object({
    title: z.string().min(3).max(100),
    description: z.string().min(20).max(5000),
    category_id: z.preprocess(optionalString, z.string().uuid().optional()),
    price_per_hour: z.preprocess(optionalString, z.coerce.number().positive().optional()),
    price_per_day: z.preprocess(optionalString, z.coerce.number().positive().optional()),
    price_per_week: z.preprocess(optionalString, z.coerce.number().positive().optional()),
    price_per_month: z.preprocess(optionalString, z.coerce.number().positive().optional()),
    primary_pricing_period: z.enum(["hour", "day", "week", "month"]).default("day"),
    deposit_amount: z.preprocess(optionalString, z.coerce.number().min(0).default(0)),
    minimum_rental_period: z.preprocess(
      optionalString,
      z.coerce.number().int().min(1).default(1),
    ),
    location: z.string().min(2),
    city: z.preprocess(optionalString, z.string().optional()),
    state: z.preprocess(optionalString, z.string().optional()),
    delivery_available: z.boolean().default(false),
    delivery_fee: z.preprocess(optionalString, z.coerce.number().min(0).default(0)),
    delivery_radius_km: z.preprocess(
      optionalString,
      z.coerce.number().int().optional(),
    ),
    images: z.array(z.string()).min(1, "At least one image required"),
    brand: z.preprocess(optionalString, z.string().optional()),
    model: z.preprocess(optionalString, z.string().optional()),
    condition: z.preprocess(optionalString, z.string().optional()),
    quantity_total: z.preprocess(
      optionalString,
      z.coerce.number().int().min(1).default(1),
    ),
    track_inventory: z.boolean().default(true),
    low_stock_threshold: z.preprocess(
      optionalString,
      z.coerce.number().int().min(0).default(1),
    ),
    sku: z.preprocess(optionalString, z.string().max(50).optional()),
    rules: z.preprocess(optionalString, z.string().max(2000).optional()),
    cancellation_policy: z.enum(["flexible", "moderate", "strict"]).default("flexible"),
    instant_book: z.boolean().default(false),
    min_renter_rating: z.preprocess(
      optionalString,
      z.coerce.number().min(0).max(5).optional(),
    ),
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

type ListingFormValues = z.input<typeof listingFormSchema>;
type ListingFormOutput = z.output<typeof listingFormSchema>;

interface ListingFormProps {
  listing?: Listing;
  categories: Category[];
}

const pricingPeriods = [
  { value: "hour", label: "Per Hour" },
  { value: "day", label: "Per Day" },
  { value: "week", label: "Per Week" },
  { value: "month", label: "Per Month" },
] as const;

function getPriceFieldName(period: "hour" | "day" | "week" | "month") {
  switch (period) {
    case "hour":
      return "price_per_hour";
    case "week":
      return "price_per_week";
    case "month":
      return "price_per_month";
    case "day":
    default:
      return "price_per_day";
  }
}

export function ListingForm({ listing, categories }: ListingFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(listing?.images ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isPending, startSubmitTransition] = useTransition();
  const form = useForm<ListingFormValues, undefined, ListingFormOutput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      title: listing?.title ?? "",
      description: listing?.description ?? "",
      category_id: listing?.category_id ?? undefined,
      price_per_hour: listing?.price_per_hour ?? undefined,
      price_per_day: listing?.price_per_day ?? undefined,
      price_per_week: listing?.price_per_week ?? undefined,
      price_per_month: listing?.price_per_month ?? undefined,
      primary_pricing_period: listing?.primary_pricing_period ?? "day",
      deposit_amount: listing?.deposit_amount ?? 0,
      minimum_rental_period: listing?.minimum_rental_period ?? 1,
      location: listing?.location ?? "",
      city: listing?.city ?? "",
      state: listing?.state ?? "",
      delivery_available: listing?.delivery_available ?? false,
      delivery_fee: listing?.delivery_fee ?? 0,
      delivery_radius_km: listing?.delivery_radius_km ?? undefined,
      images: listing?.images ?? [],
      brand: listing?.brand ?? "",
      model: listing?.model ?? "",
      condition: listing?.condition ?? "",
      quantity_total: listing?.quantity_total ?? 1,
      track_inventory: listing?.track_inventory ?? true,
      low_stock_threshold: listing?.low_stock_threshold ?? 1,
      sku: listing?.sku ?? "",
      rules: listing?.rules ?? "",
      cancellation_policy:
        (listing?.cancellation_policy as "flexible" | "moderate" | "strict") ??
        "flexible",
      instant_book: listing?.instant_book ?? false,
      min_renter_rating: listing?.min_renter_rating ?? undefined,
    },
  });

  const errors = form.formState.errors;
  const trackInventory =
    useWatch({ control: form.control, name: "track_inventory" }) ?? true;
  const deliveryAvailable =
    useWatch({ control: form.control, name: "delivery_available" }) ?? false;
  const instantBook =
    useWatch({ control: form.control, name: "instant_book" }) ?? false;
  const primaryPricingPeriod =
    useWatch({ control: form.control, name: "primary_pricing_period" }) ?? "day";
  const categoryValue = useWatch({
    control: form.control,
    name: "category_id",
  }) as string | undefined;
  const conditionValue = useWatch({
    control: form.control,
    name: "condition",
  }) as string | undefined;
  const cancellationPolicy =
    (useWatch({
      control: form.control,
      name: "cancellation_policy",
    }) as "flexible" | "moderate" | "strict" | undefined) ?? "flexible";

  const orderedPeriods = useMemo(() => {
    const primary = pricingPeriods.find(
      (period) => period.value === primaryPricingPeriod,
    );
    const rest = pricingPeriods.filter(
      (period) => period.value !== primaryPricingPeriod,
    );
    return primary ? [primary, ...rest] : pricingPeriods;
  }, [primaryPricingPeriod]);

  function syncFormImages(nextImages: string[], nextFiles: File[]) {
    form.setValue(
      "images",
      [...nextImages, ...nextFiles.map((file) => file.name)],
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  function renderSectionHeading(title: string, description?: string) {
    return (
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    );
  }

  const onSubmit = form.handleSubmit((values, event) => {
    const nativeEvent = event?.nativeEvent as SubmitEvent | undefined;
    const submitter = nativeEvent?.submitter as HTMLButtonElement | undefined;
    const status = submitter?.value === "draft" ? "draft" : "active";

    const formData = new FormData();
    setError(null);

    formData.set("status", status);
    formData.set("title", values.title);
    formData.set("description", values.description);
    formData.set("primary_pricing_period", values.primary_pricing_period ?? "day");
    formData.set("deposit_amount", String(values.deposit_amount ?? 0));
    formData.set(
      "minimum_rental_period",
      String(values.minimum_rental_period ?? 1),
    );
    formData.set("location", values.location);
    formData.set("delivery_available", String(values.delivery_available));
    formData.set("delivery_fee", String(values.delivery_fee ?? 0));
    formData.set("track_inventory", String(values.track_inventory));
    formData.set("quantity_total", String(values.quantity_total ?? 1));
    formData.set(
      "low_stock_threshold",
      String(values.low_stock_threshold ?? 1),
    );
    formData.set(
      "cancellation_policy",
      values.cancellation_policy ?? "flexible",
    );
    formData.set("instant_book", String(values.instant_book));

    if (values.category_id) formData.set("category_id", values.category_id);
    if (values.price_per_hour !== undefined) {
      formData.set("price_per_hour", String(values.price_per_hour));
    }
    if (values.price_per_day !== undefined) {
      formData.set("price_per_day", String(values.price_per_day));
    }
    if (values.price_per_week !== undefined) {
      formData.set("price_per_week", String(values.price_per_week));
    }
    if (values.price_per_month !== undefined) {
      formData.set("price_per_month", String(values.price_per_month));
    }
    if (values.brand) formData.set("brand", values.brand);
    if (values.model) formData.set("model", values.model);
    if (values.condition) formData.set("condition", values.condition);
    if (values.city) formData.set("city", values.city);
    if (values.state) formData.set("state", values.state);
    if (values.delivery_radius_km !== undefined) {
      formData.set("delivery_radius_km", String(values.delivery_radius_km));
    }
    if (listing?.pickup_instructions) {
      formData.set("pickup_instructions", listing.pickup_instructions);
    }
    const pickupInstructions = (
      document.getElementById("pickup_instructions") as HTMLTextAreaElement | null
    )?.value;
    if (pickupInstructions?.trim()) {
      formData.set("pickup_instructions", pickupInstructions);
    }
    if (values.sku) formData.set("sku", values.sku);
    if (values.rules) formData.set("rules", values.rules);
    if (values.min_renter_rating !== undefined) {
      formData.set("min_renter_rating", String(values.min_renter_rating));
    }
    images.forEach((url) => {
      formData.append("existing_images", url);
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[name="images"]');
    const files = Array.from(fileInput?.files ?? []);
    files.forEach((file) => formData.append("images", file));

    startSubmitTransition(async () => {
      const result = listing
        ? await updateListing(listing.id, formData)
        : await createListing(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(listing ? "Listing updated!" : "Listing created!");
    });
  });

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <CardTitle>{listing ? "Edit Listing" : "Create Listing"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add photos, pricing, stock, and rental rules before publishing.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-10" onSubmit={onSubmit}>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-4">
            {renderSectionHeading("Basic Info")}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Cordless drill set" {...form.register("title")} />
                {errors.title ? (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={6}
                  placeholder="Describe the item, what is included, and ideal use cases."
                  {...form.register("description")}
                />
                {errors.description ? (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue("category_id", value, { shouldValidate: true })
                  }
                  value={categoryValue}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...form.register("category_id")} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Photos")}
            <ImageUpload
              onChange={(nextImages) => {
                setImages(nextImages);
                syncFormImages(nextImages, newFiles);
              }}
              onFilesChange={(files) => {
                setNewFiles(files);
                syncFormImages(images, files);
              }}
              value={images}
            />
            {errors.images ? (
              <p className="text-sm text-destructive">{errors.images.message}</p>
            ) : null}
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Pricing")}
            <div className="grid gap-3">
              <Label>Primary pricing period</Label>
              <RadioGroup
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                onValueChange={(value) =>
                  form.setValue(
                    "primary_pricing_period",
                    value as ListingFormValues["primary_pricing_period"],
                    { shouldValidate: true },
                  )
                }
                value={primaryPricingPeriod}
              >
                {pricingPeriods.map((period) => (
                  <label
                    key={period.value}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-4 text-sm",
                      primaryPricingPeriod === period.value
                        ? "border-primary bg-primary/5"
                        : "border-border",
                    )}
                  >
                    <RadioGroupItem value={period.value} />
                    <span>{period.label}</span>
                  </label>
                ))}
              </RadioGroup>
              <input type="hidden" {...form.register("primary_pricing_period")} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {orderedPeriods.map((period) => {
                const fieldName = getPriceFieldName(period.value);

                return (
                  <div key={period.value} className="grid gap-2">
                    <Label htmlFor={fieldName}>
                      {period.label}
                      {primaryPricingPeriod === period.value ? " (Primary)" : ""}
                    </Label>
                    <Input
                      id={fieldName}
                      step="0.01"
                      type="number"
                      {...form.register(fieldName)}
                    />
                  </div>
                );
              })}

              <div className="grid gap-2">
                <Label htmlFor="deposit_amount">Deposit amount</Label>
                <Input
                  id="deposit_amount"
                  step="0.01"
                  type="number"
                  {...form.register("deposit_amount")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="minimum_rental_period">Minimum rental period</Label>
                <Input
                  id="minimum_rental_period"
                  min={1}
                  type="number"
                  {...form.register("minimum_rental_period")}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Item Details")}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" {...form.register("brand")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" {...form.register("model")} />
              </div>
              <div className="grid gap-2">
                <Label>Condition</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue("condition", value, { shouldValidate: true })
                  }
                  value={conditionValue}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Like New">Like New</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" {...form.register("condition")} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Inventory")}
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium">Track inventory</p>
                <p className="text-sm text-muted-foreground">
                  Prevent overbooking by keeping stock in sync.
                </p>
              </div>
              <Switch
                checked={trackInventory}
                onCheckedChange={(checked) =>
                  form.setValue("track_inventory", checked, {
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <input
              type="hidden"
              value={String(trackInventory)}
              {...form.register("track_inventory")}
            />

            {trackInventory ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="quantity_total">Quantity</Label>
                  <Input
                    id="quantity_total"
                    min={1}
                    type="number"
                    {...form.register("quantity_total")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="low_stock_threshold">Low stock threshold</Label>
                  <Input
                    id="low_stock_threshold"
                    min={0}
                    type="number"
                    {...form.register("low_stock_threshold")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" {...form.register("sku")} />
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Inventory will not be tracked. Unlimited bookings allowed.
              </p>
            )}
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Location")}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2 md:col-span-3">
                <Label htmlFor="location">Location</Label>
                <Input id="location" {...form.register("location")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...form.register("city")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...form.register("state")} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Delivery")}
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium">Delivery available</p>
                <p className="text-sm text-muted-foreground">
                  Offer local drop-off or meetup delivery.
                </p>
              </div>
              <Switch
                checked={deliveryAvailable}
                onCheckedChange={(checked) =>
                  form.setValue("delivery_available", checked, {
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <input
              type="hidden"
              value={String(deliveryAvailable)}
              {...form.register("delivery_available")}
            />

            {deliveryAvailable ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="delivery_fee">Delivery fee</Label>
                  <Input
                    id="delivery_fee"
                    step="0.01"
                    type="number"
                    {...form.register("delivery_fee")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="delivery_radius_km">Delivery radius</Label>
                  <Input
                    id="delivery_radius_km"
                    min={0}
                    type="number"
                    {...form.register("delivery_radius_km")}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="pickup_instructions">Pickup instructions</Label>
              <Textarea
                defaultValue={listing?.pickup_instructions ?? ""}
                id="pickup_instructions"
                name="pickup_instructions"
                rows={4}
              />
            </div>
          </section>

          <section className="space-y-4">
            {renderSectionHeading("Rules & Policies")}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rules">Rules</Label>
                <Textarea id="rules" rows={5} {...form.register("rules")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Cancellation policy</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue(
                        "cancellation_policy",
                        value as ListingFormValues["cancellation_policy"],
                        { shouldValidate: true },
                      )
                    }
                    value={cancellationPolicy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select policy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flexible">Flexible</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="strict">Strict</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    {...form.register("cancellation_policy")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="min_renter_rating">Minimum renter rating</Label>
                  <Input
                    id="min_renter_rating"
                    max={5}
                    min={0}
                    step="0.1"
                    type="number"
                    {...form.register("min_renter_rating")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium">Instant book</p>
                  <p className="text-sm text-muted-foreground">
                    Let renters book instantly when requirements are met.
                  </p>
                </div>
                <Switch
                  checked={instantBook}
                  onCheckedChange={(checked) =>
                    form.setValue("instant_book", checked, {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
              <input
                type="hidden"
                value={String(instantBook)}
                {...form.register("instant_book")}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
            <Button disabled={isPending} type="submit" value="active">
              {isPending
                ? listing
                  ? "Saving..."
                  : "Publishing..."
                : listing
                  ? "Save Changes"
                  : "Publish Listing"}
            </Button>
            <Button disabled={isPending} type="submit" value="draft" variant="outline">
              {isPending ? "Saving..." : "Save as Draft"}
            </Button>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}
