-- Add bedrooms and bathrooms to reviews for unit mix info
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS bedrooms text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS bathrooms text;
