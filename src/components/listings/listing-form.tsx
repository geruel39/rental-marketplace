"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Info } from "lucide-react";
import dynamic from "next/dynamic";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// FIX: MapPinPicker uses Leaflet which accesses `window` at import time.
// It MUST be loaded with ssr:false or the server build crashes.
const MapPinPicker = dynamic(
  () =>
    import("@/components/listings/map-pin-picker").then(
      (mod) => mod.MapPinPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-2xl border border-border bg-muted/30"
        style={{ height: 360 }}
      >
        <span className="text-sm text-muted-foreground">Loading map…</span>
      </div>
    ),
  },
);

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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Category, Listing, PricingPeriod } from "@/types";

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const deliveryMethodsSchema = z.enum(["pickup", "delivery"]);

const listingFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  category_id: z.preprocess(optionalString, z.string().uuid().optional()),
  primary_pricing_period: z.enum(["hour", "day", "week", "month"]).default("day"),
  selected_price: z.preprocess(
    optionalString,
    z.coerce.number().positive("Enter a price greater than 0"),
  ),
  minimum_rental_period: z.preprocess(
    optionalString,
    z.coerce.number().int().min(1, "Minimum rental period must be at least 1").default(1),
  ),
  images: z.array(z.string()).min(1, "At least one image required"),
  condition: z.preprocess(optionalString, z.string().optional()),
  quantity_total: z.preprocess(
    optionalString,
    z.coerce.number().int().min(1, "Quantity must be at least 1").default(1),
  ),
  low_stock_threshold: z.preprocess(
    optionalString,
    z.coerce.number().int().min(0, "Low stock threshold cannot be negative").default(1),
  ),
  location_description: z.preprocess(optionalString, z.string().max(200).optional()),
  latitude: z.coerce
    .number({ error: "Choose the item location on the map" })
    .min(-90)
    .max(90),
  longitude: z.coerce
    .number({ error: "Choose the item location on the map" })
    .min(-180)
    .max(180),
  delivery_methods: z
    .array(deliveryMethodsSchema)
    .min(1, "Choose at least one fulfillment method"),
  cancellation_policy: z.enum(["flexible", "moderate", "strict"]).default("flexible"),
});

type ListingFormValues = z.input<typeof listingFormSchema>;
type ListingFormOutput = z.output<typeof listingFormSchema>;
type DeliveryMethod = z.infer<typeof deliveryMethodsSchema>;

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

const DELIVERY_METHODS_PREFIX = "__delivery_methods__:";

const fieldHelpText = {
  title: "Use a short, searchable title renters will quickly recognize.",
  description: "Explain what is included, ideal use cases, and any important limitations.",
  category: "Choose the category that best matches this item so renters can find it faster.",
  photos: "Upload clear photos that show the item from different angles.",
  pricingPeriod: "Pick the main billing unit renters will see first.",
  price: "Set the rental rate for the selected pricing period.",
  minimumRentalPeriod: "The shortest rental duration allowed for the selected pricing unit.",
  condition: "Help renters understand the current state of the item.",
  quantity: "Total number of identical units available to rent.",
  lowStockThreshold: "You will get alerted when available stock falls to this number or lower.",
  map: "Tap the map to drop a pin for the primary pickup or meetup location.",
  locationDescription: "Optional extra context such as building, landmark, or neighborhood.",
  deliveryMethods: "Choose whether renters can pick up the item, request delivery, or both.",
  cancellationPolicy: "Sets how flexible cancellations are for renters before the booking starts.",
} as const;

function getPriceFieldName(period: PricingPeriod) {
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

function getPrimaryPrice(listing?: Listing) {
  if (!listing) {
    return undefined;
  }

  switch (listing.primary_pricing_period) {
    case "hour":
      return listing.price_per_hour ?? undefined;
    case "week":
      return listing.price_per_week ?? undefined;
    case "month":
      return listing.price_per_month ?? undefined;
    case "day":
    default:
      return listing.price_per_day ?? undefined;
  }
}

function getMinimumRentalUnit(period: PricingPeriod) {
  return `Minimum rental period /${period}`;
}

function encodeDeliveryMethods(methods: DeliveryMethod[]) {
  return `${DELIVERY_METHODS_PREFIX}${methods.join(",")}`;
}

function decodeDeliveryMethods(listing?: Listing): DeliveryMethod[] {
  if (!listing) {
    return ["pickup"];
  }

  if (listing.pickup_instructions?.startsWith(DELIVERY_METHODS_PREFIX)) {
    const parsed = listing.pickup_instructions
      .slice(DELIVERY_METHODS_PREFIX.length)
      .split(",")
      .filter(
        (value): value is DeliveryMethod =>
          value === "pickup" || value === "delivery",
      );

    if (parsed.length > 0) {
      return parsed;
    }
  }

  return listing.delivery_available ? ["pickup", "delivery"] : ["pickup"];
}

function getLocationFallback(latitude: number, longitude: number) {
  return `Pinned location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
}

// The fake MapPinPicker that was here has been removed.
// The real one is dynamically imported above (Leaflet requires ssr:false).

function FieldLabel({
  htmlFor,
  label,
  hint,
  required = false,
}: {
  htmlFor?: string;
  label: string;
  hint: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="flex items-center gap-1.5" htmlFor={htmlFor}>
        <span>{label}</span>
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={`More information about ${label}`}
            className="text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            type="button"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function DeliveryMethodButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:border-primary/50",
      )}
      onClick={onClick}
      type="button"
    >
      <Check className={cn("size-4", active ? "opacity-100" : "opacity-30")} />
      {label}
    </button>
  );
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
      primary_pricing_period: listing?.primary_pricing_period ?? "day",
      selected_price: getPrimaryPrice(listing),
      minimum_rental_period: listing?.minimum_rental_period ?? 1,
      images: listing?.images ?? [],
      condition: listing?.condition ?? "",
      quantity_total: listing?.quantity_total ?? 1,
      low_stock_threshold: listing?.low_stock_threshold ?? 1,
      location_description:
        listing?.location?.startsWith("Pinned location (") ? "" : listing?.location ?? "",
      latitude: listing?.latitude ?? undefined,
      longitude: listing?.longitude ?? undefined,
      delivery_methods: decodeDeliveryMethods(listing),
      cancellation_policy:
        (listing?.cancellation_policy as "flexible" | "moderate" | "strict") ??
        "flexible",
    },
  });
  form.register("delivery_methods");

  const errors = form.formState.errors;
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
  const latitude = useWatch({ control: form.control, name: "latitude" });
  const longitude = useWatch({ control: form.control, name: "longitude" });
  const deliveryMethods =
    useWatch({ control: form.control, name: "delivery_methods" }) ?? [];

  const selectedPricingLabel = useMemo(
    () =>
      pricingPeriods.find((period) => period.value === primaryPricingPeriod)?.label ??
      "Per Day",
    [primaryPricingPeriod],
  );

  function syncFormImages(nextImages: string[], nextFiles: File[]) {
    form.setValue("images", [...nextImages, ...nextFiles.map((file) => file.name)], {
      shouldDirty: true,
      shouldValidate: true,
    });
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

  function toggleDeliveryMethod(method: DeliveryMethod) {
    const nextMethods = deliveryMethods.includes(method)
      ? deliveryMethods.filter((value) => value !== method)
      : [...deliveryMethods, method];

    form.setValue("delivery_methods", nextMethods, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const onSubmit = form.handleSubmit((values, event) => {
    const nativeEvent = event?.nativeEvent as SubmitEvent | undefined;
    const submitter = nativeEvent?.submitter as HTMLButtonElement | undefined;
    const status = submitter?.value === "draft" ? "draft" : "active";
    const formData = new FormData();
    const locationLabel =
      values.location_description?.trim() ||
      getLocationFallback(values.latitude, values.longitude);

    setError(null);
    formData.set("status", status);
    formData.set("title", values.title);
    formData.set("description", values.description);
    formData.set("primary_pricing_period", values.primary_pricing_period ?? "day");
    formData.set(
      getPriceFieldName(values.primary_pricing_period ?? "day"),
      String(values.selected_price),
    );
    formData.set("minimum_rental_period", String(values.minimum_rental_period ?? 1));
    formData.set("location", locationLabel);
    formData.set("latitude", String(values.latitude));
    formData.set("longitude", String(values.longitude));
    formData.set(
      "delivery_available",
      String(values.delivery_methods.includes("delivery")),
    );
    formData.set("pickup_instructions", encodeDeliveryMethods(values.delivery_methods));
    formData.set("deposit_amount", "0");
    formData.set("delivery_fee", "0");
    formData.set("track_inventory", "true");
    formData.set("quantity_total", String(values.quantity_total ?? 1));
    formData.set("low_stock_threshold", String(values.low_stock_threshold ?? 1));
    formData.set("cancellation_policy", values.cancellation_policy ?? "flexible");

    if (values.category_id) {
      formData.set("category_id", values.category_id);
    }

    if (values.condition) {
      formData.set("condition", values.condition);
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
    <TooltipProvider>
      <Card className="border-border/70">
        <CardHeader className="space-y-2">
          <CardTitle>{listing ? "Edit Listing" : "Create Listing"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add photos, pricing, stock, and a clear pickup pin before publishing.
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
                  <FieldLabel
                    hint={fieldHelpText.title}
                    htmlFor="title"
                    label="Title"
                    required
                  />
                  <Input id="title" placeholder="Cordless drill set" {...form.register("title")} />
                  {errors.title ? (
                    <p className="text-sm text-destructive">{errors.title.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <FieldLabel
                    hint={fieldHelpText.description}
                    htmlFor="description"
                    label="Description"
                    required
                  />
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
                  <FieldLabel hint={fieldHelpText.category} label="Category" />
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
              <div className="space-y-2">
                <FieldLabel hint={fieldHelpText.photos} label="Listing photos" required />
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
              </div>
            </section>

            <section className="space-y-4">
              {renderSectionHeading("Pricing")}
              <div className="grid gap-3">
                <FieldLabel
                  hint={fieldHelpText.pricingPeriod}
                  label="Primary pricing period"
                  required
                />
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
                <div className="grid gap-2">
                  <FieldLabel
                    hint={fieldHelpText.price}
                    htmlFor="selected_price"
                    label={`${selectedPricingLabel} price`}
                    required
                  />
                  <Input
                    id="selected_price"
                    step="0.01"
                    type="number"
                    {...form.register("selected_price")}
                  />
                  {errors.selected_price ? (
                    <p className="text-sm text-destructive">
                      {errors.selected_price.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <FieldLabel
                    hint={fieldHelpText.minimumRentalPeriod}
                    htmlFor="minimum_rental_period"
                    label={getMinimumRentalUnit(primaryPricingPeriod)}
                    required
                  />
                  <Input
                    id="minimum_rental_period"
                    min={1}
                    type="number"
                    {...form.register("minimum_rental_period")}
                  />
                  {errors.minimum_rental_period ? (
                    <p className="text-sm text-destructive">
                      {errors.minimum_rental_period.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {renderSectionHeading("Item Details")}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <FieldLabel hint={fieldHelpText.condition} label="Condition" />
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
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Inventory tracking is always enabled to prevent overbooking.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <FieldLabel
                    hint={fieldHelpText.quantity}
                    htmlFor="quantity_total"
                    label="Quantity"
                    required
                  />
                  <Input
                    id="quantity_total"
                    min={1}
                    type="number"
                    {...form.register("quantity_total")}
                  />
                  {errors.quantity_total ? (
                    <p className="text-sm text-destructive">
                      {errors.quantity_total.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <FieldLabel
                    hint={fieldHelpText.lowStockThreshold}
                    htmlFor="low_stock_threshold"
                    label="Low stock threshold"
                    required
                  />
                  <Input
                    id="low_stock_threshold"
                    min={0}
                    type="number"
                    {...form.register("low_stock_threshold")}
                  />
                  {errors.low_stock_threshold ? (
                    <p className="text-sm text-destructive">
                      {errors.low_stock_threshold.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {renderSectionHeading("Location")}
              <div className="space-y-2">
                <FieldLabel hint={fieldHelpText.map} label="Map pin" required />
                <MapPinPicker
                  latitude={typeof latitude === "number" ? latitude : undefined}
                  longitude={typeof longitude === "number" ? longitude : undefined}
                  onChange={({ latitude: nextLatitude, longitude: nextLongitude, address }) => {
                    form.setValue("latitude", nextLatitude, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    form.setValue("longitude", nextLongitude, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    // Auto-fill location description from geocoded address
                    // only when the field is still empty so we don't clobber
                    // something the user typed manually.
                    if (address && !form.getValues("location_description")) {
                      form.setValue("location_description", address, {
                        shouldDirty: true,
                      });
                    }
                  }}
                />
                {errors.latitude ? (
                  <p className="text-sm text-destructive">{errors.latitude.message}</p>
                ) : null}
                {errors.longitude ? (
                  <p className="text-sm text-destructive">{errors.longitude.message}</p>
                ) : null}
                <input
                  type="hidden"
                  {...form.register("latitude", { valueAsNumber: true })}
                />
                <input
                  type="hidden"
                  {...form.register("longitude", { valueAsNumber: true })}
                />
              </div>

              <div className="grid gap-2">
                <FieldLabel
                  hint={fieldHelpText.locationDescription}
                  htmlFor="location_description"
                  label="Location description"
                />
                <Input
                  id="location_description"
                  placeholder="Optional landmark, building, or neighborhood"
                  {...form.register("location_description")}
                />
                {errors.location_description ? (
                  <p className="text-sm text-destructive">
                    {errors.location_description.message}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              {renderSectionHeading("Delivery")}
              <div className="space-y-2">
                <FieldLabel
                  hint={fieldHelpText.deliveryMethods}
                  label="Fulfillment options"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DeliveryMethodButton
                    active={deliveryMethods.includes("pickup")}
                    label="Pickup"
                    onClick={() => toggleDeliveryMethod("pickup")}
                  />
                  <DeliveryMethodButton
                    active={deliveryMethods.includes("delivery")}
                    label="Delivery"
                    onClick={() => toggleDeliveryMethod("delivery")}
                  />
                </div>
                {errors.delivery_methods ? (
                  <p className="text-sm text-destructive">
                    {errors.delivery_methods.message}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              {renderSectionHeading("Rules & Policies")}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <FieldLabel
                    hint={fieldHelpText.cancellationPolicy}
                    label="Cancellation policy"
                    required
                  />
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
                  {errors.cancellation_policy ? (
                    <p className="text-sm text-destructive">
                      {errors.cancellation_policy.message}
                    </p>
                  ) : null}
                </div>
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
    </TooltipProvider>
  );
}
