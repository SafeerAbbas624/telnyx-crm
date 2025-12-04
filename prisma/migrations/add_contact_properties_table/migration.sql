-- Create contact_properties table
CREATE TABLE IF NOT EXISTS "contact_properties" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "contact_id" uuid NOT NULL,
  "address" varchar(255),
  "city" varchar(255),
  "state" varchar(255),
  "county" varchar(255),
  "property_type" varchar(255),
  "bedrooms" integer,
  "total_bathrooms" integer,
  "building_sqft" integer,
  "effective_year_built" integer,
  "est_value" integer,
  "est_equity" integer,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_properties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contact_properties_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE
);

-- Create index on contact_id for faster queries
CREATE INDEX IF NOT EXISTS "idx_contact_properties_contact_id" ON "contact_properties"("contact_id");

