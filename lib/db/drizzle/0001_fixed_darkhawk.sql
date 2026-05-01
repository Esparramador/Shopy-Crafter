CREATE TABLE "cms_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_image" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_header" boolean DEFAULT true NOT NULL,
	"show_footer" boolean DEFAULT true NOT NULL,
	"theme_overrides" jsonb,
	"nav_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"order_id" text NOT NULL,
	"refund_id" text NOT NULL,
	"line_item_id" text,
	"product_id" text,
	"variant_id" text,
	"product_title" text,
	"quantity" integer DEFAULT 0,
	"amount" real DEFAULT 0,
	"reason" text,
	"note" text,
	"currency" text DEFAULT 'EUR',
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"research_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"country" text,
	"region" text,
	"website" text,
	"contact_email" text,
	"contact_phone" text,
	"products_offered" text,
	"price_range_min" real,
	"price_range_max" real,
	"currency" text DEFAULT 'EUR',
	"moq" text,
	"lead_days" text,
	"payment_terms" text,
	"ships_internationally" integer DEFAULT 0,
	"certifications" text,
	"score" integer,
	"source" text,
	"source_url" text,
	"notes" text,
	"starred" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers_research" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"niche" text,
	"query" text,
	"status" text DEFAULT 'completed',
	"total_found" integer DEFAULT 0,
	"sources" text,
	"raw_response" text,
	"cost_eur" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_base64" text,
	"company_name" varchar(200),
	"tagline" varchar(300),
	"primary_color" varchar(9) DEFAULT '#c8a84b',
	"secondary_color" varchar(9) DEFAULT '#08080e',
	"accent_color" varchar(9) DEFAULT '#44cc88',
	"text_color" varchar(9) DEFAULT '#f0f0f5',
	"bg_color" varchar(9) DEFAULT '#08080e',
	"card_bg" varchar(9) DEFAULT '#12121a',
	"border_color" varchar(9) DEFAULT '#1a1a22',
	"heading_font" varchar(100) DEFAULT 'Helvetica Neue',
	"body_font" varchar(100) DEFAULT 'Helvetica Neue',
	"heading_weight" varchar(10) DEFAULT '700',
	"cover_style" varchar(20) DEFAULT 'centered',
	"section_style" varchar(20) DEFAULT 'card',
	"footer_text" varchar(300),
	"show_page_numbers" boolean DEFAULT true,
	"is_public" boolean DEFAULT false,
	"share_token" varchar(64),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "express_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"total_hits" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_log" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"model" text,
	"project_id" integer,
	"input_units" real DEFAULT 0,
	"output_units" real DEFAULT 0,
	"units_label" text,
	"cost_usd" real DEFAULT 0,
	"cost_eur" real DEFAULT 0,
	"success" integer DEFAULT 1,
	"error_message" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"age_range" text,
	"identity_description" text NOT NULL,
	"voice_id" text,
	"voice_gender" text,
	"voice_language" text,
	"ref_vault_file_id" integer,
	"ref_mime_type" text,
	"style_notes" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_files" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "service_level" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "service_monthly_value" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "service_notes" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_contact_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_contact_email" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_contact_phone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "redesigns" ADD COLUMN "new_category" text;--> statement-breakpoint
ALTER TABLE "redesigns" ADD COLUMN "new_metafields" jsonb;--> statement-breakpoint
ALTER TABLE "sales_analytics" ADD COLUMN "refunded_quantity" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sales_analytics" ADD COLUMN "refunded_amount" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sales_analytics" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "sales_analytics" ADD COLUMN "refunded_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_files" ADD COLUMN "entity_name" text;--> statement-breakpoint
ALTER TABLE "project_files" ADD COLUMN "entity_url" text;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_ref_vault_file_id_project_files_id_fk" FOREIGN KEY ("ref_vault_file_id") REFERENCES "public"."project_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_slug_idx" ON "cms_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_express_rate_limits_reset_at" ON "express_rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "api_usage_provider_idx" ON "api_usage_log" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "api_usage_project_idx" ON "api_usage_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "api_usage_created_idx" ON "api_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "characters_project_idx" ON "characters" USING btree ("project_id");