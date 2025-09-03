import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Simple encryption for passwords (in production, use proper encryption)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'your-32-char-secret-key-here-123456';
const ALGORITHM = 'aes-256-cbc';

// Ensure the key is exactly 32 bytes for AES-256
function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
  return Buffer.from(key, 'utf8');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16); // Generate random IV
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Prepend IV to encrypted text
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  try {
    // Try new format first (with IV)
    const parts = encryptedText.split(':');
    if (parts.length === 2) {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  } catch (error) {
    console.warn('Failed to decrypt with new method, trying legacy method:', error);
  }

  // Fallback to legacy method for backward compatibility
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt with both methods:', error);
    throw new Error('Unable to decrypt password');
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if EmailAccount model exists
    if (!prisma.emailAccount) {
      console.warn('EmailAccount model not available in Prisma client. Returning empty data.');
      return NextResponse.json({
        accounts: [],
      });
    }

    const accounts = await prisma.emailAccount.findMany({
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        isDefault: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // Don't return passwords
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    return NextResponse.json({
      accounts,
    });
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if EmailAccount model exists
    if (!prisma.emailAccount) {
      return NextResponse.json(
        { error: 'Email accounts not supported yet' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const {
      emailAddress,
      displayName,
      smtpHost,
      smtpPort,
      smtpEncryption,
      smtpUsername,
      smtpPassword,
      imapHost,
      imapPort,
      imapEncryption,
      imapUsername,
      imapPassword,
      signature,
      isDefault,
    } = body;

    // Validate required fields
    if (!emailAddress || !displayName || !smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingAccount = await prisma.emailAccount.findUnique({
      where: { emailAddress },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Email account already exists' },
        { status: 409 }
      );
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.emailAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create the account
    const account = await prisma.emailAccount.create({
      data: {
        emailAddress,
        displayName,
        smtpHost,
        smtpPort: parseInt(smtpPort),
        smtpEncryption,
        smtpUsername,
        smtpPassword: encrypt(smtpPassword),
        imapHost: imapHost || null,
        imapPort: imapPort ? parseInt(imapPort) : null,
        imapEncryption: imapEncryption || null,
        imapUsername: imapUsername || null,
        imapPassword: imapPassword ? encrypt(imapPassword) : null,
        signature: signature || null,
        isDefault: isDefault || false,
        status: 'active',
      },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        isDefault: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      account,
    });
  } catch (error) {
    console.error('Error creating email account:', error);
    return NextResponse.json(
      { error: 'Failed to create email account' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!prisma.emailAccount) {
      return NextResponse.json(
        { error: 'Email accounts not supported yet' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Encrypt passwords if provided
    if (updateData.smtpPassword) {
      updateData.smtpPassword = encrypt(updateData.smtpPassword);
    }
    if (updateData.imapPassword) {
      updateData.imapPassword = encrypt(updateData.imapPassword);
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { 
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false },
      });
    }

    const account = await prisma.emailAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        isDefault: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      account,
    });
  } catch (error) {
    console.error('Error updating email account:', error);
    return NextResponse.json(
      { error: 'Failed to update email account' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!prisma.emailAccount) {
      return NextResponse.json(
        { error: 'Email accounts not supported yet' },
        { status: 501 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    await prisma.emailAccount.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Email account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting email account:', error);
    return NextResponse.json(
      { error: 'Failed to delete email account' },
      { status: 500 }
    );
  }
}
