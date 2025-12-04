import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get or create a default user
    let user = await prisma.user.findFirst({
      select: { id: true, adminId: true },
    });

    // If no users exist, return empty array (will be created on first POST)
    if (!user) {
      return NextResponse.json({ taskTypes: [] });
    }

    // Get admin user (or self if admin)
    const adminId = user.adminId || user.id;

    // Get task types from user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId: adminId },
    });

    const taskTypes = settings?.taskTypes || [];

    return NextResponse.json({ taskTypes });
  } catch (error) {
    console.error('Error fetching task types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task types' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[TASK TYPES POST] Starting...');

    const { taskTypes } = await request.json();
    console.log('[TASK TYPES POST] Task types to save:', taskTypes);

    if (!Array.isArray(taskTypes)) {
      return NextResponse.json(
        { error: 'Invalid task types format' },
        { status: 400 }
      );
    }

    // Get or create a default user for task types
    // Since this CRM doesn't enforce authentication on most routes, we'll use a system user
    let user = await prisma.user.findFirst({
      select: { id: true, adminId: true },
    });

    // If no users exist, create a default system user
    if (!user) {
      console.log('[TASK TYPES POST] No users found, creating default user...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);

      user = await prisma.user.create({
        data: {
          email: 'admin@adlercapital.com',
          firstName: 'System',
          lastName: 'Admin',
          password: hashedPassword,
          role: 'ADMIN',
          status: 'active',
        },
        select: { id: true, adminId: true },
      });
      console.log('[TASK TYPES POST] Created default user:', user.id);
    }

    console.log('[TASK TYPES POST] Using user:', user.id);

    // Get admin user (or self if admin)
    const adminId = user.adminId || user.id;
    console.log('[TASK TYPES POST] Admin ID:', adminId);

    // Update or create user settings
    const settings = await prisma.userSettings.upsert({
      where: { userId: adminId },
      update: { taskTypes },
      create: {
        userId: adminId,
        taskTypes,
      },
    });

    console.log('[TASK TYPES POST] Settings saved:', settings.id);

    return NextResponse.json({ success: true, taskTypes: settings.taskTypes });
  } catch (error) {
    console.error('[TASK TYPES POST] Error updating task types:', error);
    return NextResponse.json(
      { error: 'Failed to update task types', details: (error as Error).message },
      { status: 500 }
    );
  }
}

