ALTER TABLE "business_cards" ADD COLUMN IF NOT EXISTS "layout_overrides" text DEFAULT '{}' NOT NULL;
