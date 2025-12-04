import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can delete calls' },
        { status: 403 }
      )
    }

    const { callIds } = await req.json()

    if (!callIds || !Array.isArray(callIds) || callIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid callIds array' },
        { status: 400 }
      )
    }

    // Delete from TelnyxCalls
    const telnyxResult = await prisma.telnyxCall.deleteMany({
      where: { id: { in: callIds } },
    })

    // Delete from VapiCalls
    const vapiResult = await prisma.vapiCall.deleteMany({
      where: { id: { in: callIds } },
    })

    // Delete from PowerDialerCalls
    const powerDialerResult = await prisma.powerDialerCall.deleteMany({
      where: { id: { in: callIds } },
    })

    const totalDeleted =
      (telnyxResult.count || 0) +
      (vapiResult.count || 0) +
      (powerDialerResult.count || 0)

    return NextResponse.json({
      success: true,
      deleted: totalDeleted,
      message: `Deleted ${totalDeleted} calls`,
    })
  } catch (error) {
    console.error('Error in bulk delete:', error)
    return NextResponse.json(
      { error: 'Failed to delete calls' },
      { status: 500 }
    )
  }
}

