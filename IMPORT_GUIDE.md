# Contact Import Guide

This guide explains how to use the contact import feature to import contacts from a CSV file into the SMS Messaging Interface.

## Prerequisites

1. Node.js and npm installed
2. PostgreSQL installed and running
3. Database connection configured in `.env`

## Setting Up the Database

1. Make sure PostgreSQL is running
2. Create a database named `sms_messaging` (or update the `.env` file with your preferred database name)
3. Run the database migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

## Importing Contacts

1. **Prepare your CSV file**:
   - Ensure your CSV file has headers in the first row
   - The system will map these headers to database fields

2. **Access the Import Page**:
   - Navigate to `/import` in your browser

3. **Upload your CSV file**:
   - Click "Drag and drop a CSV file here, or click to select"
   - Select your CSV file

4. **Map CSV columns to database fields**:
   - For each column in your CSV, select the corresponding database field
   - Required fields: At minimum, map the required contact fields
   - The preview shows sample data to help with mapping

5. **Start the import**:
   - Click "Import Data" to begin the import process
   - A progress indicator will show the import status
   - You'll see a success message when complete

## Supported Fields

You can map CSV columns to these database fields:

### Property Information
- `propertyStreet` - Street address of the property
- `propertyCity` - City of the property
- `propertyState` - State of the property
- `propertyCounty` - County of the property
- `propertyType` - Type of property (e.g., Single Family, Condo)
- `bedrooms` - Number of bedrooms (numeric)
- `bathrooms` - Number of bathrooms (numeric)
- `buildingSqft` - Building square footage (numeric)
- `yearBuilt` - Year the property was built (numeric)
- `estimatedValue` - Estimated property value (numeric, will strip $ and ,)
- `estimatedEquity` - Estimated equity in the property (numeric, will strip $ and ,)
- `llcName` - Name of the LLC (if applicable)

### Contact Information
- `fullName` - Full name of the contact
- `contactAddress` - Mailing address for the contact
- `phone1`, `phone2`, `phone3` - Phone numbers
- `email1`, `email2`, `email3` - Email addresses
- `notes` - Any notes about the contact
- `tags` - Comma-separated list of tags (e.g., "investor,preferred")

## Troubleshooting

### Common Issues

1. **CSV Format Issues**:
   - Ensure your CSV uses commas as delimiters
   - Text fields with commas should be enclosed in quotes
   - Make sure there are no empty lines in the file

2. **Database Connection Issues**:
   - Verify PostgreSQL is running
   - Check your `.env` file for correct database credentials
   - Ensure the database exists and is accessible

3. **Import Errors**:
   - Check the browser console for detailed error messages
   - Verify all required fields are mapped
   - Ensure numeric fields contain valid numbers

### Viewing Imported Data

You can view and manage imported contacts:
1. Use the Prisma Studio:
   ```bash
   npx prisma studio
   ```
2. Or use any PostgreSQL client to query the database directly

## Development

### Resetting the Database

To start fresh:
1. Delete the database
2. Recreate it
3. Run migrations:
   ```bash
   npx prisma migrate reset --force
   ```

### Adding New Fields

1. Update the Prisma schema in `prisma/schema.prisma`
2. Create and run a new migration:
   ```bash
   npx prisma migrate dev --name add_new_field
   ```
3. Update the import page to handle the new field

## Support

For additional help, please contact the development team or refer to the project documentation.
