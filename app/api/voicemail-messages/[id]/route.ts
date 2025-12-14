import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'

// GET - Get a single voicemail message
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const voicemail = await prisma.voicemailMessage.findUnique({
      where: { id },
    })

    if (!voicemail) {
      return NextResponse.json({ error: 'Voicemail not found' }, { status: 404 })
    }

    return NextResponse.json({ voicemail })
  } catch (error) {
    console.error('[VoicemailMessages] Error fetching:', error)
    return NextResponse.json({ error: 'Failed to fetch voicemail' }, { status: 500 })
  }
}

// PATCH - Update a voicemail message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can update voicemail messages' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  try {
    const existing = await prisma.voicemailMessage.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Voicemail not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (body.isDefault === true) {
      await prisma.voicemailMessage.updateMany({
        where: { userId: session.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const voicemail = await prisma.voicemailMessage.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive,
        isDefault: body.isDefault,
      },
    })

    return NextResponse.json({ voicemail })
  } catch (error) {
    console.error('[VoicemailMessages] Error updating:', error)
    return NextResponse.json({ error: 'Failed to update voicemail' }, { status: 500 })
  }
}

// DELETE - Delete a voicemail message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can delete voicemail messages' }, { status: 403 })
  }

  const { id } = await params

  try {
    const voicemail = await prisma.voicemailMessage.findUnique({
      where: { id },
    })

    if (!voicemail) {
      return NextResponse.json({ error: 'Voicemail not found' }, { status: 404 })
    }

    // Delete the audio file from disk
    if (existsSync(voicemail.filePath)) {
      await unlink(voicemail.filePath)
    }

    // Delete from database
    await prisma.voicemailMessage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[VoicemailMessages] Error deleting:', error)
    return NextResponse.json({ error: 'Failed to delete voicemail' }, { status: 500 })
  }
}

