ALTER TABLE profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{
    "email_bookings": true,
    "email_messages": false,
    "email_reviews": true,
    "email_low_stock": false
  }'::jsonb;
