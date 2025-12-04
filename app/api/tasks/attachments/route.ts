import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: { activityId: taskId },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error('Error fetching attachments:', error)
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const taskId = formData.get('taskId') as string
    const file = formData.get('file') as File

    if (!taskId || !file) {
      return NextResponse.json({ error: 'Task ID and file required' }, { status: 400 })
    }

    // Verify task exists and user has access
    const task = await prisma.activity.findUnique({
      where: { id: taskId },
      select: { id: true, contact_id: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // In a real implementation, you would upload to S3 or similar
    // For now, we'll store the file metadata
    const fileName = file.name
    const fileSize = file.size
    const fileType = file.type

    const attachment = await prisma.taskAttachment.create({
      data: {
        activityId: taskId,
        fileName,
        fileSize,
        fileType,
        fileUrl: `/uploads/tasks/${taskId}/${fileName}`,
        uploadedById: session.user.id,
      },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json(attachment)
  } catch (error) {
    console.error('Error uploading attachment:', error)
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attachmentId } = await request.json()

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    // Verify attachment exists and user is the uploader
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: { uploadedById: true },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}

