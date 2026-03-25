# Testing Checklist

## Auth

□ Register individual account -> profile created in DB
□ Register business account -> business_name saved
□ Login with email/password -> redirect to dashboard
□ Google OAuth login -> profile auto-created
□ Logout -> redirect to home
□ Visit /dashboard without auth -> redirect to /login
□ Visit /login while authed -> redirect to /dashboard

## Listings

□ Create listing with images, inventory tracking ON, qty=5
□ Check DB: listing + inventory_movements `initial` record
□ Edit listing -> changes saved
□ Pause listing -> status changes
□ Delete listing -> soft delete (archived)
□ Browse page: search works, filters work, pagination works
□ In-stock-only filter excludes out-of-stock
□ Listing detail: all sections render

## Inventory

□ Inventory overview shows all listings with stock badges
□ Adjust stock (add 3) -> movement logged, badge updates
□ Adjust stock (remove 2) -> movement logged
□ Set stock to 0 -> "Out of Stock" badge, notification created
□ Adjustment history shows all movements
□ Low stock alert appears on dashboard

## Bookings

□ Request booking (qty=2) -> stock checked -> booking created
□ Request denied if out of stock
□ Accept booking -> stock reserved (available decreases)
□ Cancel booking -> stock released (available increases)
□ Complete booking -> stock returned + payout created

## Payments

□ Accept booking -> HitPay payment URL generated
□ Open payment URL -> HitPay sandbox page loads
□ Complete test payment -> webhook fires -> booking status=`active`
□ Payment success page shows confirmation

## Reviews

□ After completion: both parties can review
□ Submit review -> ratings recalculated on profile
□ Reviews appear on listing detail page
□ Reviews dashboard: 3 tabs work

## Messages

□ Message lister from listing page -> conversation created
□ Real-time message delivery (2 browser tabs)
□ Unread count updates

## Notifications

□ Bell shows unread count
□ Booking request -> lister notified
□ Payment received -> both notified
□ Low stock -> lister notified
□ Mark as read works

## Mobile

□ All pages usable on 375px width
□ Navigation works on mobile
□ Forms are usable on mobile
