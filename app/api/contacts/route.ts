import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  llcName: string | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  email1: string | null;
  email2: string | null;
  email3: string | null;
  propertyAddress: string | null;
  contactAddress: string | null;
  city: string | null;
  state: string | null;

  propertyCounty: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  totalBathrooms: any; // Decimal type from Prisma
  buildingSqft: number | null;
  effectiveYearBuilt: number | null;
  estValue: any; // Decimal type from Prisma
  estEquity: any; // Decimal type from Prisma
  dnc: boolean | null;
  dncReason: string | null;
  dealStatus: string | null;
  notes: string | null;
  avatarUrl: string | null;
  contact_tags: { tag: { id: string; name: string; color: string } }[];
  createdAt: Date;
  updatedAt: Date | null;
}

interface FormattedContact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  propertyAddress: string;
  propertyType: string;
  propertyValue: number | null;
  debtOwed: number | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}



export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        contact_tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data to match the expected frontend format
    const formattedContacts = contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      llcName: contact.llcName || '',
      phone1: contact.phone1 || '',
      phone2: contact.phone2 || '',
      phone3: contact.phone3 || '',
      email1: contact.email1 || '',
      email2: contact.email2 || '',
      email3: contact.email3 || '',
      propertyAddress: contact.propertyAddress || '',
      contactAddress: contact.contactAddress || '',
      city: contact.city || '',
      state: contact.state || '',

      propertyCounty: contact.propertyCounty || '',
      propertyType: contact.propertyType || '',
      bedrooms: contact.bedrooms,
      totalBathrooms: contact.totalBathrooms ? Number(contact.totalBathrooms) : null,
      buildingSqft: contact.buildingSqft,
      effectiveYearBuilt: contact.effectiveYearBuilt,
      estValue: contact.estValue ? Number(contact.estValue) : null,
      estEquity: contact.estEquity ? Number(contact.estEquity) : null,
      dnc: contact.dnc,
      dncReason: contact.dncReason || '',
      dealStatus: contact.dealStatus,
      notes: contact.notes || '',
      avatarUrl: contact.avatarUrl || '',
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt?.toISOString() || contact.createdAt.toISOString(),
      // Legacy/compatibility fields
      phone: contact.phone1 || '',
      email: contact.email1 || '',
      propertyValue: contact.estValue ? Number(contact.estValue) : null,
      debtOwed: contact.estValue && contact.estEquity ?
        Number(contact.estValue) - Number(contact.estEquity) : null,
      tags: contact.contact_tags.map((ct: { tag: { name: string; id: string; color: string } }) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || '#3B82F6'
      })),
    }));

    return NextResponse.json(formattedContacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST - Create new contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const contactData = {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      llcName: body.llcName || null,
      phone1: body.phone1 || null,
      phone2: body.phone2 || null,
      phone3: body.phone3 || null,
      email1: body.email1 || null,
      email2: body.email2 || null,
      email3: body.email3 || null,
      propertyAddress: body.propertyAddress || null,
      city: body.city || null,
      state: body.state || null,
      propertyCounty: body.propertyCounty || null,
      propertyType: body.propertyType || null,
      bedrooms: body.bedrooms || null,
      totalBathrooms: body.totalBathrooms || null,
      buildingSqft: body.buildingSqft || null,
      effectiveYearBuilt: body.effectiveYearBuilt || null,
      estValue: body.estValue || null,
      estEquity: body.estEquity || null,
      dnc: body.dnc || false,
      dncReason: body.dncReason || null,
      dealStatus: body.dealStatus || 'lead',
      notes: body.notes || null,
      avatarUrl: body.avatarUrl || null,
    };

    const newContact = await prisma.contact.create({
      data: contactData,
      include: {
        contact_tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Transform the data to match the expected frontend format
    const formattedContact = {
      id: newContact.id,
      firstName: newContact.firstName || '',
      lastName: newContact.lastName || '',
      llcName: newContact.llcName || '',
      phone1: newContact.phone1 || '',
      phone2: newContact.phone2 || '',
      phone3: newContact.phone3 || '',
      email1: newContact.email1 || '',
      email2: newContact.email2 || '',
      email3: newContact.email3 || '',
      propertyAddress: newContact.propertyAddress || '',
      contactAddress: newContact.contactAddress || '',
      city: newContact.city || '',
      state: newContact.state || '',
      propertyCounty: newContact.propertyCounty || '',
      propertyType: newContact.propertyType || '',
      bedrooms: newContact.bedrooms,
      totalBathrooms: newContact.totalBathrooms ? Number(newContact.totalBathrooms) : null,
      buildingSqft: newContact.buildingSqft,
      effectiveYearBuilt: newContact.effectiveYearBuilt,
      estValue: newContact.estValue ? Number(newContact.estValue) : null,
      estEquity: newContact.estEquity ? Number(newContact.estEquity) : null,
      dnc: newContact.dnc,
      dncReason: newContact.dncReason || '',
      dealStatus: newContact.dealStatus,
      notes: newContact.notes || '',
      avatarUrl: newContact.avatarUrl || '',
      createdAt: newContact.createdAt.toISOString(),
      updatedAt: newContact.updatedAt?.toISOString() || newContact.createdAt.toISOString(),
      // Legacy/compatibility fields
      phone: newContact.phone1 || '',
      email: newContact.email1 || '',
      propertyValue: newContact.estValue ? Number(newContact.estValue) : null,
      debtOwed: newContact.estValue && newContact.estEquity ?
        Number(newContact.estValue) - Number(newContact.estEquity) : null,
      tags: newContact.contact_tags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || '#3B82F6'
      })),
    };

    return NextResponse.json(formattedContact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
