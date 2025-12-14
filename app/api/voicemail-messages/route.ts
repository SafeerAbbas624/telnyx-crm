import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

// Directory for storing voicemail audio files
const VOICEMAIL_DIR = path.join(process.cwd(), 'uploads', 'voicemails')

// GET - List all voicemail messages for the user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.role === 'TEAM_USER' && session.user.adminId
    ? session.user.adminId
    : session.user.id

  try {
    const voicemails = await prisma.voicemailMessage.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ voicemails })
  } catch (error) {
    console.error('[VoicemailMessages] Error fetching:', error)
    return NextResponse.json({ error: 'Failed to fetch voicemail messages' }, { status: 500 })
  }
}

// POST - Upload a new voicemail message
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can create voicemail messages
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can create voicemail messages' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const audioFile = formData.get('audio') as File | null
    const isDefault = formData.get('isDefault') === 'true'

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm']
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json({ error: 'Invalid audio file type. Allowed: WAV, MP3, OGG, WebM' }, { status: 400 })
    }

    // Ensure upload directory exists
    if (!existsSync(VOICEMAIL_DIR)) {
      await mkdir(VOICEMAIL_DIR, { recursive: true })
    }

    // Generate unique filename
    const ext = audioFile.name.split('.').pop() || 'wav'
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const fileName = `voicemail-${uniqueId}.${ext}`
    const filePath = path.join(VOICEMAIL_DIR, fileName)

    // Write file to disk
    const bytes = await audioFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.voicemailMessage.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    // Create database record
    const voicemail = await prisma.voicemailMessage.create({
      data: {
        name,
        description,
        filePath,
        fileName: audioFile.name,
        fileSize: buffer.length,
        mimeType: audioFile.type,
        isDefault,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ voicemail })
  } catch (error) {
    console.error('[VoicemailMessages] Error creating:', error)
    return NextResponse.json({ error: 'Failed to create voicemail message' }, { status: 500 })
  }
}

