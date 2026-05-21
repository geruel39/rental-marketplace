-- Allow renters and listers to keep seeing listing details for their bookings
-- even when the listing itself is paused or otherwise not publicly active.
DROP POLICY IF EXISTS "listings_select" ON listings;

CREATE POLICY "listings_select" ON listings
  FOR SELECT USING (
    status = 'active'
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM bookings
      WHERE bookings.listing_id = listings.id
        AND auth.uid() IN (bookings.renter_id, bookings.lister_id)
    )
  );
