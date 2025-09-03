import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface ContactUpdateData {
  firstName?: string;
  lastName?: string;
  llcName?: string;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  email1?: string;
  email2?: string;
  email3?: string;
  propertyAddress?: string;
  contactAddress?: string;
  city?: string;
  state?: string;
  propertyCounty?: string;
  propertyType?: string;
  bedrooms?: number;
  totalBathrooms?: number;
  buildingSqft?: number;
  effectiveYearBuilt?: number;
  estValue?: number;
  estEquity?: number;
  dnc?: boolean;
  dncReason?: string;
  dealStatus?: string;
  notes?: string;
  avatarUrl?: string;
}

// GET single contact by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Build the query based on user role
    let whereClause: any = { id };

    // If user is a team member, only allow access to assigned contacts
    if (session.user.role === 'TEAM_MEMBER') {
      whereClause = {
        id,
        assignedUsers: {
          some: {
            userId: session.user.id
          }
        }
      };
    }

    const contact = await prisma.contact.findUnique({
      where: whereClause,
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

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the expected frontend format
    const formattedContact = {
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
      tags: contact.contact_tags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || '#3B82F6'
      })),
    };

    return NextResponse.json(formattedContact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

// PATCH - Update contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Team members cannot update contacts
    if (session.user.role === 'TEAM_MEMBER') {
      return NextResponse.json(
        { error: 'Forbidden - Team members cannot update contacts' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const updateData: ContactUpdateData = {};

    // Map frontend field names to database field names
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.llcName !== undefined) updateData.llcName = body.llcName;
    if (body.phone1 !== undefined) updateData.phone1 = body.phone1;
    if (body.phone2 !== undefined) updateData.phone2 = body.phone2;
    if (body.phone3 !== undefined) updateData.phone3 = body.phone3;
    if (body.email1 !== undefined) updateData.email1 = body.email1;
    if (body.email2 !== undefined) updateData.email2 = body.email2;
    if (body.email3 !== undefined) updateData.email3 = body.email3;
    if (body.propertyAddress !== undefined) updateData.propertyAddress = body.propertyAddress;
    if (body.contactAddress !== undefined) updateData.contactAddress = body.contactAddress;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.propertyCounty !== undefined) updateData.propertyCounty = body.propertyCounty;
    if (body.propertyType !== undefined) updateData.propertyType = body.propertyType;
    if (body.bedrooms !== undefined) updateData.bedrooms = body.bedrooms;
    if (body.totalBathrooms !== undefined) updateData.totalBathrooms = body.totalBathrooms;
    if (body.buildingSqft !== undefined) updateData.buildingSqft = body.buildingSqft;
    if (body.effectiveYearBuilt !== undefined) updateData.effectiveYearBuilt = body.effectiveYearBuilt;
    if (body.estValue !== undefined) updateData.estValue = body.estValue;
    if (body.estEquity !== undefined) updateData.estEquity = body.estEquity;
    if (body.dnc !== undefined) updateData.dnc = body.dnc;
    if (body.dncReason !== undefined) updateData.dncReason = body.dncReason;
    if (body.dealStatus !== undefined) updateData.dealStatus = body.dealStatus;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: updateData,
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
      id: updatedContact.id,
      firstName: updatedContact.firstName || '',
      lastName: updatedContact.lastName || '',
      llcName: updatedContact.llcName || '',
      phone1: updatedContact.phone1 || '',
      phone2: updatedContact.phone2 || '',
      phone3: updatedContact.phone3 || '',
      email1: updatedContact.email1 || '',
      email2: updatedContact.email2 || '',
      email3: updatedContact.email3 || '',
      propertyAddress: updatedContact.propertyAddress || '',
      contactAddress: updatedContact.contactAddress || '',
      city: updatedContact.city || '',
      state: updatedContact.state || '',
      propertyCounty: updatedContact.propertyCounty || '',
      propertyType: updatedContact.propertyType || '',
      bedrooms: updatedContact.bedrooms,
      totalBathrooms: updatedContact.totalBathrooms ? Number(updatedContact.totalBathrooms) : null,
      buildingSqft: updatedContact.buildingSqft,
      effectiveYearBuilt: updatedContact.effectiveYearBuilt,
      estValue: updatedContact.estValue ? Number(updatedContact.estValue) : null,
      estEquity: updatedContact.estEquity ? Number(updatedContact.estEquity) : null,
      dnc: updatedContact.dnc,
      dncReason: updatedContact.dncReason || '',
      dealStatus: updatedContact.dealStatus,
      notes: updatedContact.notes || '',
      avatarUrl: updatedContact.avatarUrl || '',
      createdAt: updatedContact.createdAt.toISOString(),
      updatedAt: updatedContact.updatedAt?.toISOString() || updatedContact.createdAt.toISOString(),
      // Legacy/compatibility fields
      phone: updatedContact.phone1 || '',
      email: updatedContact.email1 || '',
      propertyValue: updatedContact.estValue ? Number(updatedContact.estValue) : null,
      debtOwed: updatedContact.estValue && updatedContact.estEquity ? 
        Number(updatedContact.estValue) - Number(updatedContact.estEquity) : null,
      tags: updatedContact.contact_tags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || '#3B82F6'
      })),
    };

    return NextResponse.json(formattedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

// DELETE contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.contact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}
