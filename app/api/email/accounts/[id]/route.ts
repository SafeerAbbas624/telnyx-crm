import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// Encryption configuration
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'your-32-char-secret-key-here-123456';
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
  return Buffer.from(key, 'utf8');
}

function decrypt(encryptedText: string): string {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedData = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
}

function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

// GET - Get specific email account details for editing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!prisma.emailAccount) {
      return NextResponse.json(
        { error: 'Email accounts not supported yet' },
        { status: 501 }
      );
    }

    const { id } = params;

    const account = await prisma.emailAccount.findUnique({
      where: { id },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpEncryption: true,
        smtpUsername: true,
        smtpPassword: true, // We'll decrypt this
        imapHost: true,
        imapPort: true,
        imapEncryption: true,
        imapUsername: true,
        imapPassword: true, // We'll decrypt this
        signature: true,
        isDefault: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      );
    }

    // Decrypt passwords for editing (but don't send the actual passwords for security)
    const accountData = {
      ...account,
      smtpPassword: account.smtpPassword ? '••••••••' : '', // Masked password
      imapPassword: account.imapPassword ? '••••••••' : '', // Masked password
      hasSmtpPassword: !!account.smtpPassword,
      hasImapPassword: !!account.imapPassword,
    };

    return NextResponse.json({
      success: true,
      account: accountData,
    });
  } catch (error) {
    console.error('Error fetching email account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email account' },
      { status: 500 }
    );
  }
}

// PUT - Update email account
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!prisma.emailAccount) {
      return NextResponse.json(
        { error: 'Email accounts not supported yet' },
        { status: 501 }
      );
    }

    const { id } = params;
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
      status,
    } = body;

    // Check if account exists
    const existingAccount = await prisma.emailAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      );
    }

    // Check if email address is being changed and if it conflicts
    if (emailAddress && emailAddress !== existingAccount.emailAddress) {
      const conflictingAccount = await prisma.emailAccount.findUnique({
        where: { emailAddress },
      });

      if (conflictingAccount) {
        return NextResponse.json(
          { error: 'Email address already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (emailAddress !== undefined) updateData.emailAddress = emailAddress;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
    if (smtpPort !== undefined) updateData.smtpPort = parseInt(smtpPort);
    if (smtpEncryption !== undefined) updateData.smtpEncryption = smtpEncryption;
    if (smtpUsername !== undefined) updateData.smtpUsername = smtpUsername;
    if (imapHost !== undefined) updateData.imapHost = imapHost || null;
    if (imapPort !== undefined) updateData.imapPort = imapPort ? parseInt(imapPort) : null;
    if (imapEncryption !== undefined) updateData.imapEncryption = imapEncryption || null;
    if (imapUsername !== undefined) updateData.imapUsername = imapUsername || null;
    if (signature !== undefined) updateData.signature = signature || null;
    if (status !== undefined) updateData.status = status;

    // Handle passwords (only update if provided and not masked)
    if (smtpPassword && smtpPassword !== '••••••••') {
      updateData.smtpPassword = encrypt(smtpPassword);
    }
    if (imapPassword && imapPassword !== '••••••••') {
      updateData.imapPassword = encrypt(imapPassword);
    }

    // Handle default setting
    if (isDefault !== undefined) {
      updateData.isDefault = isDefault;
      
      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.emailAccount.updateMany({
          where: { 
            isDefault: true,
            id: { not: id }
          },
          data: { isDefault: false },
        });
      }
    }

    // Update the account
    const updatedAccount = await prisma.emailAccount.update({
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
      account: updatedAccount,
      message: 'Email account updated successfully',
    });
  } catch (error) {
    console.error('Error updating email account:', error);
    return NextResponse.json(
      { error: 'Failed to update email account' },
      { status: 500 }
    );
  }
}

// DELETE - Delete email account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!prisma.emailAccount) {
      return NextResponse.json(
        { error: 'Email accounts not supported yet' },
        { status: 501 }
      );
    }

    const { id } = params;

    // Check if account exists
    const existingAccount = await prisma.emailAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      );
    }

    // Delete the account
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
