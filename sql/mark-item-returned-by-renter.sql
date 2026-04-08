CREATE OR REPLACE FUNCTION public.mark_item_returned_by_renter(
  p_booking_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_returned_at TIMESTAMPTZ := NOW();
  v_is_late_return BOOLEAN := FALSE;
BEGIN
  SELECT *
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.renter_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Only the renter can mark item return.';
  END IF;

  IF v_booking.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only active rentals can be marked returned.';
  END IF;

  v_is_late_return := COALESCE(v_booking.rental_ends_at IS NOT NULL AND v_returned_at > v_booking.rental_ends_at, FALSE);

  UPDATE public.bookings
  SET
    status = 'returned',
    returned_at = v_returned_at,
    return_notes = NULLIF(BTRIM(p_notes), ''),
    return_proof_urls = COALESCE(p_photo_urls, ARRAY[]::TEXT[]),
    updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_timeline
    (booking_id, status, previous_status, actor_id, actor_role, title, description, metadata)
  VALUES
    (
      p_booking_id,
      'returned',
      'active',
      p_user_id,
      'renter',
      'Item returned',
      CASE
        WHEN v_is_late_return THEN 'Renter confirmed the item was returned after the rental deadline.'
        ELSE 'Renter confirmed the item was returned to the lister.'
      END,
      jsonb_build_object(
        'return_notes', NULLIF(BTRIM(p_notes), ''),
        'proof_photos', COALESCE(p_photo_urls, ARRAY[]::TEXT[]),
        'returned_at', v_returned_at,
        'rental_ends_at', v_booking.rental_ends_at,
        'is_late_return', v_is_late_return
      )
    );
END;
$$;
