-- CORRECTED DATABASE SCHEMA QUERIES
-- Run these queries one by one to explore your database structure

-- 1. Get all tables in the database
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Get complete contacts table schema with detailed information
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    ordinal_position
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

-- 4. Get sample data from contacts table (first 3 records)
SELECT * FROM contacts LIMIT 3;

-- 5. Get count of contacts
SELECT COUNT(*) as total_contacts FROM contacts;

-- 6. Get contacts with non-null values for key fields
SELECT 
    id,
    first_name,
    last_name,
    llc_name,
    phone1,
    email1,
    property_address,
    city,
    state,
    est_value,
    est_equity,
    deal_status
FROM contacts 
WHERE first_name IS NOT NULL 
AND last_name IS NOT NULL
LIMIT 5;

-- 7. Get tags table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'tags' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Get contact_tags relationship table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'contact_tags' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Get a complete contact record with all fields (showing actual column names)
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

-- 10. Get contacts with their tags (if any)
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.phone1,
    c.email1,
    c.property_address,
    c.est_value,
    c.est_equity,
    c.deal_status,
    STRING_AGG(t.name, ', ') as tags
FROM contacts c
LEFT JOIN contact_tags ct ON c.id = ct.contact_id
LEFT JOIN tags t ON ct.tag_id = t.id
GROUP BY c.id, c.first_name, c.last_name, c.phone1, c.email1, c.property_address, c.est_value, c.est_equity, c.deal_status
LIMIT 10;

-- 11. Check for any contacts with missing critical data
SELECT 
    COUNT(*) as total_contacts,
    COUNT(first_name) as has_first_name,
    COUNT(last_name) as has_last_name,
    COUNT(phone1) as has_phone,
    COUNT(email1) as has_email,
    COUNT(property_address) as has_address,
    COUNT(est_value) as has_value,
    COUNT(est_equity) as has_equity
FROM contacts;

-- 12. Get data type information for numeric fields
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND table_schema = 'public'
AND data_type IN ('numeric', 'decimal', 'integer', 'bigint')
ORDER BY ordinal_position;

-- 13. Sample of contacts with financial data
SELECT 
    id,
    first_name,
    last_name,
    est_value,
    est_equity,
    (est_value - est_equity) as calculated_debt,
    deal_status
FROM contacts 
WHERE est_value IS NOT NULL 
AND est_equity IS NOT NULL
LIMIT 10;

-- 14. Check enum values for deal_status
SELECT DISTINCT deal_status, COUNT(*) as count
FROM contacts 
WHERE deal_status IS NOT NULL
GROUP BY deal_status
ORDER BY count DESC;

-- 15. Get all available tags
SELECT id, name, color, description, is_system, created_at
FROM tags
ORDER BY name;
