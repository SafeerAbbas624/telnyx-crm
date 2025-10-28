import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Create a transporter using Gmail SMTP
// In production, use environment variables for credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'your-email@gmail.com',
    pass: process.env.GMAIL_PASSWORD || 'your-app-password',
  },
});

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, loanId, cc, bcc } = await request.json();

    // Validate required fields
    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate CC and BCC if provided
    if (cc) {
      const ccEmails = cc.split(',').map((e: string) => e.trim());
      for (const email of ccEmails) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { error: `Invalid CC email: ${email}` },
            { status: 400 }
          );
        }
      }
    }

    if (bcc) {
      const bccEmails = bcc.split(',').map((e: string) => e.trim());
      for (const email of bccEmails) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { error: `Invalid BCC email: ${email}` },
            { status: 400 }
          );
        }
      }
    }

    // Send email
    const mailOptions = {
      from: process.env.GMAIL_USER || 'your-email@gmail.com',
      to,
      cc: cc ? cc.split(',').map((e: string) => e.trim()).join(',') : undefined,
      bcc: bcc ? bcc.split(',').map((e: string) => e.trim()).join(',') : undefined,
      subject,
      html: body.replace(/\n/g, '<br>'), // Convert newlines to HTML breaks
    };

    // Remove undefined fields
    Object.keys(mailOptions).forEach(key => 
      mailOptions[key as keyof typeof mailOptions] === undefined && 
      delete mailOptions[key as keyof typeof mailOptions]
    );

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', {
      messageId: info.messageId,
      to,
      subject,
      loanId,
    });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

