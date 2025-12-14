import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

// GET - Stream the audio file for a voicemail message
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

    // Check if file exists
    if (!existsSync(voicemail.filePath)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }

    // Read the file
    const audioBuffer = await readFile(voicemail.filePath)

    // Return the audio file with appropriate headers
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': voicemail.mimeType,
        'Content-Length': voicemail.fileSize.toString(),
        'Content-Disposition': `inline; filename="${voicemail.fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[VoicemailMessages] Error streaming audio:', error)
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 })
  }
}

