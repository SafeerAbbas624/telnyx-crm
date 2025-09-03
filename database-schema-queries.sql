-- Get complete database schema information

-- 1. Get all tables in the database
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Get complete contacts table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Get all constraints for contacts table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'contacts'
AND tc.table_schema = 'public';

-- 4. Get sample data from contacts table to see actual data structure
SELECT * FROM contacts LIMIT 5;

-- 5. Get count of contacts
SELECT COUNT(*) as total_contacts FROM contacts;

-- 6. Get all column names with their data types
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'contacts'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Get tags table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tags' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Get contact_tags relationship table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'contact_tags' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Get a complete contact record with all fields
SELECT 
    id,
    first_name,
    last_name,
    llc_name,
    phone1,
    phone2,
    phone3,
    email1,
    email2,
    email3,
    property_address,
    city,
    state,
    property_county,
    property_type,
    bedrooms,
    total_bathrooms,
    building_sqft,
    effective_year_built,
    est_value,
    est_equity,
    dnc,
    dnc_reason,
    deal_status,
    notes,
    avatar_url,
    created_at,
    updated_at
FROM contacts 
WHERE id IS NOT NULL 
LIMIT 3;

-- 10. Get contacts with their tags
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.phone1,
    c.email1,
    c.property_address,
    c.est_value,
    c.est_equity,
    STRING_AGG(t.name, ', ') as tags
FROM contacts c
LEFT JOIN contact_tags ct ON c.id = ct.contact_id
LEFT JOIN tags t ON ct.tag_id = t.id
GROUP BY c.id, c.first_name, c.last_name, c.phone1, c.email1, c.property_address, c.est_value, c.est_equity
LIMIT 10;
