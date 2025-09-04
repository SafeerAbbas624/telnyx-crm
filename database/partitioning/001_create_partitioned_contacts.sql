-- Advanced Database Partitioning for 500K+ Contacts
-- This creates partitioned tables for massive performance improvements

-- 1. Create partitioned contacts table by creation date
CREATE TABLE contacts_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    first_name TEXT,
    last_name TEXT,
    llc_name TEXT,
    phone1 TEXT,
    phone2 TEXT,
    phone3 TEXT,
    email1 TEXT,
    email2 TEXT,
    email3 TEXT,
    property_address TEXT,
    contact_address TEXT,
    city TEXT,
    state TEXT,
    property_county TEXT,
    property_type TEXT,
    bedrooms INTEGER,
    total_bathrooms DECIMAL(4,2),
    building_sqft INTEGER,
    effective_year_built INTEGER,
    est_value DECIMAL(15,2),
    est_equity DECIMAL(15,2),
    dnc BOOLEAN DEFAULT false,
    dnc_reason TEXT,
    deal_status TEXT DEFAULT 'lead',
    notes TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the last 2 years and future
CREATE TABLE contacts_2023_01 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');

CREATE TABLE contacts_2023_02 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');

CREATE TABLE contacts_2023_03 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-03-01') TO ('2023-04-01');

CREATE TABLE contacts_2023_04 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-04-01') TO ('2023-05-01');

CREATE TABLE contacts_2023_05 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-05-01') TO ('2023-06-01');

CREATE TABLE contacts_2023_06 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-06-01') TO ('2023-07-01');

CREATE TABLE contacts_2023_07 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-07-01') TO ('2023-08-01');

CREATE TABLE contacts_2023_08 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-08-01') TO ('2023-09-01');

CREATE TABLE contacts_2023_09 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-09-01') TO ('2023-10-01');

CREATE TABLE contacts_2023_10 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');

CREATE TABLE contacts_2023_11 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');

CREATE TABLE contacts_2023_12 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');

CREATE TABLE contacts_2024_01 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE contacts_2024_02 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE contacts_2024_03 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE contacts_2024_04 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE contacts_2024_05 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE contacts_2024_06 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE contacts_2024_07 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE contacts_2024_08 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE contacts_2024_09 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE contacts_2024_10 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE contacts_2024_11 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE contacts_2024_12 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE contacts_2025_01 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE contacts_2025_02 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE contacts_2025_03 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE contacts_2025_04 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE contacts_2025_05 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE contacts_2025_06 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE contacts_2025_07 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE contacts_2025_08 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE contacts_2025_09 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE contacts_2025_10 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE contacts_2025_11 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE contacts_2025_12 PARTITION OF contacts_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Create default partition for future dates
CREATE TABLE contacts_default PARTITION OF contacts_partitioned DEFAULT;

-- Create indexes on each partition for optimal performance
CREATE INDEX CONCURRENTLY idx_contacts_2024_name ON contacts_2024_01 (first_name, last_name);
CREATE INDEX CONCURRENTLY idx_contacts_2024_phone ON contacts_2024_01 (phone1);
CREATE INDEX CONCURRENTLY idx_contacts_2024_email ON contacts_2024_01 (email1);
CREATE INDEX CONCURRENTLY idx_contacts_2024_status ON contacts_2024_01 (deal_status);
CREATE INDEX CONCURRENTLY idx_contacts_2024_location ON contacts_2024_01 (city, state);

-- Repeat for other active partitions (2024-2025)
-- This would be automated in production

-- Create materialized view for fast aggregations
CREATE MATERIALIZED VIEW contacts_summary AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    deal_status,
    state,
    property_type,
    COUNT(*) as contact_count,
    AVG(est_value) as avg_property_value,
    SUM(CASE WHEN dnc = false THEN 1 ELSE 0 END) as contactable_count
FROM contacts_partitioned
GROUP BY DATE_TRUNC('month', created_at), deal_status, state, property_type;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_contacts_summary_unique 
ON contacts_summary (month, deal_status, state, property_type);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_contacts_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY contacts_summary;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically create new partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
                   
    -- Create indexes on new partition
    EXECUTE format('CREATE INDEX CONCURRENTLY idx_%s_name ON %I (first_name, last_name)', 
                   partition_name, partition_name);
    EXECUTE format('CREATE INDEX CONCURRENTLY idx_%s_phone ON %I (phone1)', 
                   partition_name, partition_name);
    EXECUTE format('CREATE INDEX CONCURRENTLY idx_%s_email ON %I (email1)', 
                   partition_name, partition_name);
    EXECUTE format('CREATE INDEX CONCURRENTLY idx_%s_status ON %I (deal_status)', 
                   partition_name, partition_name);
    EXECUTE format('CREATE INDEX CONCURRENTLY idx_%s_location ON %I (city, state)', 
                   partition_name, partition_name);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create partitions
CREATE OR REPLACE FUNCTION create_partition_if_not_exists()
RETURNS trigger AS $$
DECLARE
    partition_date date;
BEGIN
    partition_date := date_trunc('month', NEW.created_at);
    
    -- Try to create partition if it doesn't exist
    BEGIN
        PERFORM create_monthly_partition('contacts_partitioned', partition_date);
    EXCEPTION WHEN duplicate_table THEN
        -- Partition already exists, continue
        NULL;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_partition
    BEFORE INSERT ON contacts_partitioned
    FOR EACH ROW EXECUTE FUNCTION create_partition_if_not_exists();
