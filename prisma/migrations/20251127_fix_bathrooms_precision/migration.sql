-- Fix totalBathrooms precision to support larger values (up to 9999.99)
-- Change from DECIMAL(4,2) to DECIMAL(6,2)

ALTER TABLE "contacts" 
ALTER COLUMN "total_bathrooms" TYPE DECIMAL(6,2);

