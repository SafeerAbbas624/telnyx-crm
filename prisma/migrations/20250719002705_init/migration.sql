-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "propertyStreet" TEXT NOT NULL,
    "propertyCity" TEXT NOT NULL,
    "propertyState" TEXT NOT NULL,
    "propertyCounty" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "buildingSqft" INTEGER,
    "yearBuilt" INTEGER,
    "estimatedValue" DOUBLE PRECISION,
    "estimatedEquity" DOUBLE PRECISION,
    "llcName" TEXT,
    "fullName" TEXT,
    "contactAddress" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "phone3" TEXT,
    "email1" TEXT,
    "email2" TEXT,
    "email3" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email1_key" ON "Contact"("email1");

-- CreateIndex
CREATE INDEX "Contact_email1_idx" ON "Contact"("email1");

-- CreateIndex
CREATE INDEX "Contact_phone1_idx" ON "Contact"("phone1");
