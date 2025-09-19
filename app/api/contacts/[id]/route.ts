import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { formatPhoneNumberForTelnyx } from '@/lib/phone-utils';

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
        properties: true,
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
      properties: (contact as any).properties?.map((p: any) => ({
        id: p.id,
        address: p.address || '',
        city: p.city || '',
        state: p.state || '',
        county: p.county || '',
        propertyType: p.propertyType || '',
        bedrooms: p.bedrooms ?? null,
        totalBathrooms: p.totalBathrooms ?? null,
        buildingSqft: p.buildingSqft ?? null,
        effectiveYearBuilt: p.effectiveYearBuilt ?? null,
        estValue: p.estValue ?? null,
        estEquity: p.estEquity ?? null,
        createdAt: p.createdAt?.toISOString?.() || undefined,
        updatedAt: p.updatedAt?.toISOString?.() || undefined,
      })) || [],
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
    if (body.phone1 !== undefined) updateData.phone1 = formatPhoneNumberForTelnyx(body.phone1 || '') || null;
    if (body.phone2 !== undefined) updateData.phone2 = formatPhoneNumberForTelnyx(body.phone2 || '') || null;
    if (body.phone3 !== undefined) updateData.phone3 = formatPhoneNumberForTelnyx(body.phone3 || '') || null;
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

    // Update core contact fields first
    await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    // If tags provided, upsert new tags by name and sync associations
    if (Array.isArray(body.tags)) {
      // Normalize incoming tags into { id?: string, name?: string, color?: string }
      const incoming: Array<{ id?: string; name?: string; color?: string } | string> = body.tags;
      const desiredTagIds = new Set<string>();
      const candidatesToCreate = new Map<string, string | undefined>(); // name -> color

      for (const item of incoming) {
        if (typeof item === 'string') {
          const name = item.trim();
          if (name) candidatesToCreate.set(name, undefined);
          continue;
        }
        if (item && item.id) {
          desiredTagIds.add(item.id);
        } else if (item && item.name) {
          const name = item.name.trim();
          if (name) candidatesToCreate.set(name, item.color);
        }
      }

      // Create or fetch tags for names
      for (const [name, color] of candidatesToCreate.entries()) {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: color ? { color } : {},
          create: { name, ...(color ? { color } : {}) },
        });
        desiredTagIds.add(tag.id);
      }

      // Fetch current associations
      const existing = await prisma.contactTag.findMany({
        where: { contact_id: id },
        select: { tag_id: true },
      });
      const existingIds = new Set(existing.map((e) => e.tag_id));

      const toAdd = [...desiredTagIds].filter((tid) => !existingIds.has(tid));
      const toRemove = [...existingIds].filter((tid) => !desiredTagIds.has(tid));

      if (toAdd.length > 0) {
        await prisma.contactTag.createMany({
          data: toAdd.map((tid) => ({ contact_id: id, tag_id: tid })),
          skipDuplicates: true,
        });
      }
      if (toRemove.length > 0) {
        await prisma.contactTag.deleteMany({
          where: { contact_id: id, tag_id: { in: toRemove } },
        });
      }
    }

    // Re-fetch full contact with tags to return fresh data
    const updated = await prisma.contact.findUnique({
      where: { id },
      include: {
        contact_tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    if (!updated) {
      return NextResponse.json({ error: 'Contact not found after update' }, { status: 404 });
    }

    // Transform the data to match the expected frontend format
    const formattedContact = {
      id: updated.id,
      firstName: updated.firstName || '',
      lastName: updated.lastName || '',
      llcName: updated.llcName || '',
      phone1: updated.phone1 || '',
      phone2: updated.phone2 || '',
      phone3: updated.phone3 || '',
      email1: updated.email1 || '',
      email2: updated.email2 || '',
      email3: updated.email3 || '',
      propertyAddress: updated.propertyAddress || '',
      contactAddress: updated.contactAddress || '',
      city: updated.city || '',
      state: updated.state || '',
      propertyCounty: updated.propertyCounty || '',
      propertyType: updated.propertyType || '',
      bedrooms: updated.bedrooms,
      totalBathrooms: updated.totalBathrooms ? Number(updated.totalBathrooms) : null,
      buildingSqft: updated.buildingSqft,
      effectiveYearBuilt: updated.effectiveYearBuilt,
      estValue: updated.estValue ? Number(updated.estValue) : null,
      estEquity: updated.estEquity ? Number(updated.estEquity) : null,
      dnc: updated.dnc,
      dncReason: updated.dncReason || '',
      dealStatus: updated.dealStatus,
      notes: updated.notes || '',
      avatarUrl: updated.avatarUrl || '',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt?.toISOString() || updated.createdAt.toISOString(),
      // Legacy/compatibility fields
      phone: updated.phone1 || '',
      email: updated.email1 || '',
      propertyValue: updated.estValue ? Number(updated.estValue) : null,
      debtOwed: updated.estValue && updated.estEquity ? Number(updated.estValue) - Number(updated.estEquity) : null,
      tags: updated.contact_tags.map((ct) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color || '#3B82F6' })),
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
