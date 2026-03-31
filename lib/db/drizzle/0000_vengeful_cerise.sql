CREATE TABLE "plan_credit_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"pack_type" text NOT NULL,
	"products_included" integer NOT NULL,
	"images_included" integer NOT NULL,
	"shopify_product_id" text,
	"shopify_order_id" text,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform_type" text DEFAULT 'shopify' NOT NULL,
	"shop_domain" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"access_token" text,
	"token_expires_at" timestamp with time zone,
	"store_niche" text,
	"brand_tone" text,
	"target_audience" text,
	"store_markets" text,
	"replicate_api_token" text,
	"anthropic_api_key" text,
	"auto_pilot_enabled" boolean DEFAULT false NOT NULL,
	"product_count" integer,
	"avg_audit_score" real,
	"webhook_id" text,
	"ai_report_json" text,
	"ai_report_generated_at" timestamp with time zone,
	"plan" text DEFAULT 'starter' NOT NULL,
	"products_used_this_month" integer DEFAULT 0 NOT NULL,
	"images_used_this_month" integer DEFAULT 0 NOT NULL,
	"credits_products" integer DEFAULT 0 NOT NULL,
	"credits_images" integer DEFAULT 0 NOT NULL,
	"plan_renews_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"body_html" text,
	"vendor" text,
	"product_type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"published_at" text,
	"tags" text,
	"price" text,
	"compare_at_price" text,
	"image_count" integer DEFAULT 0 NOT NULL,
	"variant_count" integer DEFAULT 1 NOT NULL,
	"images_json" jsonb,
	"audit_score" real,
	"audit_grade" text,
	"title_score" real,
	"description_score" real,
	"price_score" real,
	"image_score" real,
	"seo_score" real,
	"audit_problems" text[],
	"last_audited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redesigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"original_title" text NOT NULL,
	"original_price" text,
	"new_title" text NOT NULL,
	"new_body_html" text NOT NULL,
	"new_short_description" text NOT NULL,
	"new_price" text NOT NULL,
	"new_compare_at_price" text NOT NULL,
	"new_tags" text NOT NULL,
	"meta_title" text NOT NULL,
	"meta_description" text NOT NULL,
	"photo_brief" text[],
	"price_reasoning" text,
	"applied_at" timestamp with time zone,
	"applied_fields" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"image_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"prompt" text,
	"negative_prompt" text,
	"model" text,
	"replicate_prediction_id" text,
	"image_url" text,
	"shopify_image_id" bigint,
	"alt_text" text,
	"estimated_cost" real,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"product_title" text NOT NULL,
	"test_type" text DEFAULT 'image' NOT NULL,
	"image_type" text NOT NULL,
	"hypothesis" text NOT NULL,
	"variant_a_price" text,
	"variant_b_price" text,
	"ai_prediction" jsonb,
	"variant_a_url" text,
	"variant_a_shopify_image_id" text,
	"variant_b_url" text,
	"variant_b_shopify_image_id" text,
	"variant_a_visitors" integer DEFAULT 0 NOT NULL,
	"variant_b_visitors" integer DEFAULT 0 NOT NULL,
	"variant_a_conversions" integer DEFAULT 0 NOT NULL,
	"variant_b_conversions" integer DEFAULT 0 NOT NULL,
	"variant_a_revenue" real DEFAULT 0 NOT NULL,
	"variant_b_revenue" real DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"winner" text,
	"status" text DEFAULT 'running' NOT NULL,
	"target_metric" text DEFAULT 'conversion' NOT NULL,
	"minimum_sample_size" integer DEFAULT 100 NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"variant" text NOT NULL,
	"event_type" text NOT NULL,
	"shopify_product_id" text NOT NULL,
	"session_id" text NOT NULL,
	"revenue" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"unit_cost" real DEFAULT 0 NOT NULL,
	"packaging_cost" real DEFAULT 0 NOT NULL,
	"label_cost" real DEFAULT 0 NOT NULL,
	"shipping_cost_domestic" real DEFAULT 0 NOT NULL,
	"shipping_cost_international" real DEFAULT 0 NOT NULL,
	"fulfillment_fee" real DEFAULT 0 NOT NULL,
	"return_rate" real DEFAULT 0.08 NOT NULL,
	"return_processing_cost" real DEFAULT 0 NOT NULL,
	"shopify_payment_fee" real DEFAULT 0.015 NOT NULL,
	"shopify_plan_cost_per_order" real DEFAULT 0 NOT NULL,
	"cac" real DEFAULT 0 NOT NULL,
	"affiliate_fee" real DEFAULT 0 NOT NULL,
	"overhead_per_unit" real DEFAULT 0 NOT NULL,
	"material_cost" real DEFAULT 0 NOT NULL,
	"fabric_cost" real DEFAULT 0 NOT NULL,
	"printing_cost" real DEFAULT 0 NOT NULL,
	"screen_printing_cost" real DEFAULT 0 NOT NULL,
	"mold_amortization" real DEFAULT 0 NOT NULL,
	"assembly_cost" real DEFAULT 0 NOT NULL,
	"labor_cost_per_unit" real DEFAULT 0 NOT NULL,
	"quality_control_cost" real DEFAULT 0 NOT NULL,
	"warehouse_cost_per_unit" real DEFAULT 0 NOT NULL,
	"customs_duty" real DEFAULT 0 NOT NULL,
	"insurance_cost" real DEFAULT 0 NOT NULL,
	"payment_processing_fee" real DEFAULT 0 NOT NULL,
	"platform_commission" real DEFAULT 0 NOT NULL,
	"digital_marketing_cost" real DEFAULT 0 NOT NULL,
	"influencer_cost_per_unit" real DEFAULT 0 NOT NULL,
	"seo_cost_per_unit" real DEFAULT 0 NOT NULL,
	"vat_rate" real DEFAULT 0.21 NOT NULL,
	"corporate_tax_rate" real DEFAULT 0 NOT NULL,
	"consulting_fee" real DEFAULT 0 NOT NULL,
	"legal_cost_per_unit" real DEFAULT 0 NOT NULL,
	"ai_api_cost_per_unit" real DEFAULT 0 NOT NULL,
	"design_cost_per_unit" real DEFAULT 0 NOT NULL,
	"custom_costs" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"total_cogs" real DEFAULT 0 NOT NULL,
	"total_cogs_with_vat" real DEFAULT 0 NOT NULL,
	"break_even_price" real DEFAULT 0 NOT NULL,
	"break_even_price_with_vat" real DEFAULT 0 NOT NULL,
	"minimum_viable_price" real DEFAULT 0 NOT NULL,
	"last_competitor_analysis" jsonb,
	"last_pricing_recommendation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visual_dna" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"background_style" text,
	"lighting_style" text,
	"color_temp" text,
	"composition" text,
	"mood" text,
	"props" text[],
	"human_presence" text,
	"consistency_score" real,
	"brand_colors" text[],
	"extracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"has_schema" boolean DEFAULT false NOT NULL,
	"schema_json" text,
	"has_alt_texts" boolean DEFAULT false NOT NULL,
	"clean_handle" boolean DEFAULT false NOT NULL,
	"seo_score" real,
	"seo_grade" text,
	"description_length" integer DEFAULT 0,
	"keyword_strategy" jsonb,
	"page_speed_score" real,
	"lcp" real,
	"cls" real,
	"inp" real,
	"last_audited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"log" text[],
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bulk_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"reasoning" text,
	"estimated_impact" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"client_comment" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"action" text NOT NULL,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"from_role" text NOT NULL,
	"from_name" text NOT NULL,
	"content" text NOT NULL,
	"is_read" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"client_id" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"avatar_color" text DEFAULT '#5b4eff',
	"invite_token" text,
	"invite_expires" timestamp,
	"reset_token" text,
	"reset_expires" timestamp,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cms_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	"saved_by" text,
	"version" integer NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"event_type" text NOT NULL,
	"product_id" text,
	"payload" text,
	"revenue_before" real,
	"revenue_after" real,
	"revenue_delta" real,
	"attributed_revenue" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"forecast_date" text,
	"forecast_type" text,
	"product_id" text,
	"predicted_value" real,
	"confidence_low" real,
	"confidence_high" real,
	"confidence_pct" integer,
	"reasoning" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"revenue" real,
	"orders" integer,
	"conversion_rate" real,
	"aov" real,
	"gross_margin" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"product_title" text,
	"variant_title" text,
	"sku" text,
	"barcode" text,
	"option1_name" text,
	"option1_value" text,
	"option2_name" text,
	"option2_value" text,
	"option3_name" text,
	"option3_value" text,
	"product_type" text,
	"vendor" text,
	"cost_per_item" real,
	"price" real,
	"compare_at_price" real,
	"weight" real,
	"weight_unit" text,
	"current_stock" integer,
	"avg_daily_sales" real,
	"total_units_sold" integer DEFAULT 0,
	"days_remaining" integer,
	"restock_threshold" integer DEFAULT 15,
	"supplier_email" text,
	"supplier_lead_days" integer DEFAULT 14,
	"last_restock_date" text,
	"inventory_policy" text,
	"requires_shipping" integer DEFAULT 1,
	"status" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restock_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"product_id" text,
	"product_title" text,
	"quantity_suggested" integer,
	"urgency" text,
	"email_draft" text,
	"sent_at" timestamp,
	"admin_approved" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"order_id" text NOT NULL,
	"order_number" text,
	"order_date" timestamp,
	"customer_id" text,
	"customer_email" text,
	"customer_name" text,
	"product_id" text,
	"variant_id" text,
	"product_title" text,
	"variant_title" text,
	"sku" text,
	"option1_name" text,
	"option1_value" text,
	"option2_name" text,
	"option2_value" text,
	"option3_name" text,
	"option3_value" text,
	"quantity" integer DEFAULT 1,
	"unit_price" real,
	"total_price" real,
	"discount" real DEFAULT 0,
	"currency" text DEFAULT 'EUR',
	"fulfillment_status" text,
	"financial_status" text,
	"country" text,
	"city" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"achievement_key" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"step_store_connected" integer DEFAULT 0,
	"step_audit_run" integer DEFAULT 0,
	"step_image_generated" integer DEFAULT 0,
	"step_price_optimized" integer DEFAULT 0,
	"step_ab_test_active" integer DEFAULT 0,
	"step_seo_applied" integer DEFAULT 0,
	"step_client_invited" integer DEFAULT 0,
	"completion_pct" integer DEFAULT 0,
	"onboarding_completed" integer DEFAULT 0,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"competitor_id" text NOT NULL,
	"alert_type" text,
	"severity" text,
	"title" text,
	"description" text,
	"action_suggestion" text,
	"dismissed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competitor_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"competitor_id" text NOT NULL,
	"scanned_at" timestamp DEFAULT now(),
	"products_found" integer,
	"price_min" real,
	"price_max" real,
	"price_median" real,
	"new_products" text,
	"out_of_stock" text,
	"promotions_detected" text,
	"meta_title" text,
	"meta_description" text,
	"raw_data" text
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"type" text DEFAULT 'direct',
	"last_scanned" timestamp,
	"active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"referral_code" text NOT NULL,
	"clicks" integer DEFAULT 0,
	"signups" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"pending_payout" real DEFAULT 0,
	"total_earned" real DEFAULT 0,
	"stripe_connect_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "affiliates_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "referral_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"referred_user_id" text,
	"signup_date" timestamp,
	"converted_date" timestamp,
	"commission_rate" real DEFAULT 0.2,
	"commission_earned" real DEFAULT 0,
	"status" text DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'trial',
	"status" text DEFAULT 'active',
	"trial_ends_at" timestamp,
	"current_period_end" timestamp,
	"stores_limit" integer DEFAULT 1,
	"images_included" integer DEFAULT 100,
	"images_used" integer DEFAULT 0,
	"cancel_at_period_end" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "agency_cost_structure" (
	"id" text PRIMARY KEY NOT NULL,
	"cost_claude_api" real DEFAULT 0,
	"cost_replicate" real DEFAULT 0,
	"cost_hosting" real DEFAULT 0,
	"cost_stripe_fees_fixed" real DEFAULT 0,
	"cost_domain_tools" real DEFAULT 0,
	"cost_your_time_hourly" real DEFAULT 80,
	"avg_hours_per_client" real DEFAULT 4,
	"cost_per_image_generated" real DEFAULT 0.25,
	"cost_per_audit_run" real DEFAULT 0.08,
	"cost_per_boost_masivo" real DEFAULT 2.5,
	"cost_per_seo_update" real DEFAULT 0.15,
	"cost_per_ab_test_setup" real DEFAULT 0.05,
	"cost_per_report_pdf" real DEFAULT 0.2,
	"target_margin_setup" real DEFAULT 0.7,
	"target_margin_retainer" real DEFAULT 0.65,
	"target_margin_extras" real DEFAULT 0.75,
	"minimum_hourly_rate" real DEFAULT 80,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "omnicore_absorbed_content" (
	"id" text PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"source_label" text,
	"raw_content" text,
	"visual_composition" text,
	"color_palette" text,
	"texture_analysis" text,
	"topology_structure" text,
	"rendering_technique" text,
	"technical_specs" text,
	"chemical_composition" text,
	"brand_elements" text,
	"main_themes" text,
	"ecommerce_insights" text,
	"marketing_angles" text,
	"competitive_data" text,
	"audience_signals" text,
	"full_analysis" jsonb,
	"extracted_entities" jsonb,
	"niche" text,
	"confidence" real DEFAULT 0.7,
	"absorbed_to_memory" integer DEFAULT 0,
	"memory_ids" text,
	"processing_model" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "omnicore_cross_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"insight_a" text NOT NULL,
	"insight_b" text NOT NULL,
	"connection_type" text,
	"connection_strength" real DEFAULT 0.5,
	"discovered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "omnicore_insights" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"sub_domain" text,
	"insight_type" text NOT NULL,
	"title" text NOT NULL,
	"insight" text NOT NULL,
	"evidence" text,
	"confidence" real DEFAULT 0.5,
	"impact_score" real DEFAULT 0.5,
	"related_domains" text,
	"related_insights" text,
	"times_applied" integer DEFAULT 0,
	"times_successful" integer DEFAULT 0,
	"times_failed" integer DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"source" text DEFAULT 'manual',
	"retroactive_version" integer DEFAULT 0,
	"last_retroactive_update" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "omnicore_knowledge_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"knowledge_depth" integer DEFAULT 0,
	"verified_insights" integer DEFAULT 0,
	"total_insights" integer DEFAULT 0,
	"last_study_session" timestamp,
	"specialty_prompt" text,
	"core_principles" text,
	"common_mistakes" text,
	"best_practices" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "omnicore_knowledge_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "omnicore_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"memory_type" text NOT NULL,
	"niche" text,
	"sub_niche" text,
	"product_type" text,
	"market" text DEFAULT 'es',
	"title" text NOT NULL,
	"content" text NOT NULL,
	"confidence" real DEFAULT 0.5,
	"use_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"source_type" text DEFAULT 'manual',
	"tags" text,
	"is_verified" integer DEFAULT 0,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "omnicore_niche_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"niche" text NOT NULL,
	"sub_niches" text,
	"avg_price_min" real,
	"avg_price_max" real,
	"avg_price_sweet_spot" real,
	"typical_margin_pct" real,
	"seasonal_peaks" text,
	"top_keywords" text,
	"top_image_types" text,
	"best_cta_words" text,
	"tone_description" text,
	"known_competitors" text,
	"avg_competitor_count" integer,
	"market_saturation" text DEFAULT 'medium',
	"best_prompt_style" text,
	"product_description_template" text,
	"pricing_psychology" text,
	"stores_analyzed" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "omnicore_niche_profiles_niche_unique" UNIQUE("niche")
);
--> statement-breakpoint
CREATE TABLE "omnicore_prompt_library" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"niche" text,
	"use_case" text,
	"prompt_template" text NOT NULL,
	"variables" text,
	"avg_quality_score" real DEFAULT 0,
	"use_count" integer DEFAULT 0,
	"created_by" text DEFAULT 'system',
	"is_public" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "omnicore_study_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_type" text NOT NULL,
	"domains_studied" text,
	"trigger" text,
	"duration_seconds" integer,
	"insights_created" integer DEFAULT 0,
	"insights_updated" integer DEFAULT 0,
	"insights_invalidated" integer DEFAULT 0,
	"retroactive_updates" integer DEFAULT 0,
	"summary" text,
	"key_discoveries" text,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_type" text,
	"entity_id" text,
	"entity_name" text,
	"old_price" real,
	"new_price" real,
	"price_delta" real,
	"price_delta_pct" real,
	"reasoning" text,
	"data_used" text,
	"confidence" real,
	"risk_level" text DEFAULT 'medium',
	"expected_impact" text,
	"decision_made_at" timestamp,
	"decision_by" text DEFAULT 'omnicore_auto',
	"outcome_measured_at" timestamp,
	"actual_revenue_change" real,
	"actual_conversion_change" real,
	"prediction_accuracy" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"rule_name" text,
	"rule_type" text,
	"condition_json" text,
	"action_json" text,
	"limits_json" text,
	"is_active" integer DEFAULT 1,
	"auto_apply" integer DEFAULT 0,
	"requires_approval" integer DEFAULT 1,
	"times_triggered" integer DEFAULT 0,
	"last_triggered" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"service_name" text NOT NULL,
	"service_type" text,
	"cost_time_hours" real DEFAULT 0,
	"cost_platform" real DEFAULT 0,
	"cost_tools" real DEFAULT 0,
	"total_cost" real DEFAULT 0,
	"price_current" real,
	"price_suggested" real,
	"price_min" real,
	"price_max" real,
	"market_avg_price" real,
	"market_price_low" real,
	"market_price_high" real,
	"our_positioning" text DEFAULT 'premium',
	"times_sold" integer DEFAULT 0,
	"times_rejected" integer DEFAULT 0,
	"avg_client_satisfaction" real,
	"last_price_review" timestamp,
	"omnicore_recommendation" text,
	"omnicore_confidence" real,
	"price_change_suggested" real,
	"is_active" integer DEFAULT 1,
	"shopify_variant_id" text,
	"shopify_product_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"file_type" text NOT NULL,
	"category" text,
	"title" text NOT NULL,
	"description" text,
	"object_path" text,
	"original_url" text,
	"mime_type" text,
	"file_size_bytes" integer,
	"product_id" text,
	"product_title" text,
	"generated_by" text,
	"metadata" text,
	"content" text,
	"is_public" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gemini_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gemini_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_dna" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"primary_colors" text[],
	"typography_style" text,
	"layout_pattern" text,
	"visual_density" text,
	"tone_of_voice" text,
	"value_propositions" text[],
	"urgency_tactics" text[],
	"target_audience" text,
	"photography_style" text,
	"brand_personality" text,
	"competitive_position" text,
	"extracted_from_url" text,
	"extracted_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"old_price" real,
	"new_price" real NOT NULL,
	"change_source" text DEFAULT 'sync',
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"name" varchar(255) NOT NULL,
	"template_type" varchar(100) NOT NULL,
	"category" varchar(50) DEFAULT 'agency' NOT NULL,
	"subject_a" text,
	"subject_b" text,
	"preview_text" text,
	"html_content" text,
	"text_content" text,
	"tone" varchar(50) DEFAULT 'profesional',
	"language" varchar(10) DEFAULT 'es',
	"brand_name" varchar(255),
	"brand_logo_url" text,
	"brand_colors" jsonb DEFAULT '{}'::jsonb,
	"brand_tagline" text,
	"variables_used" text,
	"from_email" varchar(255),
	"from_name" varchar(255),
	"reply_email" varchar(255),
	"klaviyo_template_id" varchar(100),
	"klaviyo_status" varchar(20) DEFAULT 'draft',
	"klaviyo_error" text,
	"pushed_at" timestamp with time zone,
	"is_favorite" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"name" varchar(255) NOT NULL,
	"flow_type" varchar(100),
	"trigger_type" varchar(100),
	"send_delay" varchar(20) DEFAULT '1h',
	"subject_a" text,
	"subject_b" text,
	"preview_text" text,
	"tone" varchar(50) DEFAULT 'urgente',
	"language" varchar(10) DEFAULT 'es',
	"html_content" text,
	"text_content" text,
	"variables_used" text,
	"from_email" varchar(255),
	"from_name" varchar(255),
	"reply_email" varchar(255),
	"klaviyo_template_id" varchar(100),
	"klaviyo_flow_id" varchar(100),
	"klaviyo_status" varchar(20) DEFAULT 'draft',
	"klaviyo_error" text,
	"open_rate" real,
	"click_rate" real,
	"pushed_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"url" text NOT NULL,
	"overall_score" real,
	"performance_score" real,
	"seo_score" real,
	"accessibility_score" real,
	"best_practices_score" real,
	"content_quality_score" real,
	"mobile_friendliness_score" real,
	"technical_seo_score" real,
	"pagespeed_mobile" jsonb,
	"pagespeed_desktop" jsonb,
	"scraping_result" jsonb,
	"ai_analysis" jsonb,
	"issues" jsonb,
	"recommendations" jsonb,
	"audited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_credit_packs" ADD CONSTRAINT "plan_credit_packs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redesigns" ADD CONSTRAINT "redesigns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cogs" ADD CONSTRAINT "cogs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_dna" ADD CONSTRAINT "visual_dna_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_data" ADD CONSTRAINT "seo_data_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gemini_messages" ADD CONSTRAINT "gemini_messages_conversation_id_gemini_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."gemini_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_dna" ADD CONSTRAINT "brand_dna_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_flows" ADD CONSTRAINT "email_flows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "user_sessions" USING btree ("expire");