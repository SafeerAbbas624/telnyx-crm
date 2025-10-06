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

// GET - Get decrypted credentials for testing connection
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
        smtpHost: true,
        smtpPort: true,
        smtpEncryption: true,
        smtpUsername: true,
        smtpPassword: true,
        imapHost: true,
        imapPort: true,
        imapEncryption: true,
        imapUsername: true,
        imapPassword: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      );
    }

    // Decrypt passwords for testing
    const credentials = {
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpEncryption: account.smtpEncryption,
      smtpUsername: account.smtpUsername,
      smtpPassword: account.smtpPassword ? decrypt(account.smtpPassword) : '',
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      imapEncryption: account.imapEncryption,
      imapUsername: account.imapUsername,
      imapPassword: account.imapPassword ? decrypt(account.imapPassword) : '',
    };

    return NextResponse.json({
      success: true,
      credentials,
    });
  } catch (error) {
    console.error('Error fetching email credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email credentials' },
      { status: 500 }
    );
  }
}

