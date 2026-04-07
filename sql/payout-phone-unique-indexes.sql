CREATE UNIQUE INDEX IF NOT EXISTS idx_gcash_phone_unique
ON profiles(gcash_phone_number)
WHERE gcash_phone_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maya_phone_unique
ON profiles(maya_phone_number)
WHERE maya_phone_number IS NOT NULL;
