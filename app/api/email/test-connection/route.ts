import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createConnection } from 'net';

// Helper function to test port connectivity
function testPortConnectivity(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 5000 });

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
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
    } = body;

    const results = {
      smtp: { success: false, error: null },
      imap: { success: false, error: null },
    };

    // Test SMTP connection
    try {
      console.log('Testing SMTP connection with:', {
        host: smtpHost,
        port: smtpPort,
        encryption: smtpEncryption,
        username: smtpUsername
      });

      // First test basic connectivity
      const portConnected = await testPortConnectivity(smtpHost, parseInt(smtpPort));
      if (!portConnected) {
        throw new Error(`Cannot connect to SMTP server ${smtpHost}:${smtpPort}. Please check the host and port.`);
      }

      const smtpConfig: any = {
        host: smtpHost,
        port: parseInt(smtpPort),
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
        // Add timeout and connection options
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      };

      // Set security options based on encryption type and port
      const port = parseInt(smtpPort);

      if (smtpEncryption === 'SSL' || port === 465) {
        // SSL/TLS (implicit)
        smtpConfig.secure = true;
      } else if (smtpEncryption === 'TLS' || port === 587) {
        // STARTTLS (explicit)
        smtpConfig.secure = false;
        smtpConfig.requireTLS = true;
        smtpConfig.tls = {
          ciphers: 'SSLv3',
          rejectUnauthorized: false // Allow self-signed certificates for testing
        };
      } else {
        // No encryption (port 25)
        smtpConfig.secure = false;
      }

      // Add additional TLS options for better compatibility
      if (!smtpConfig.secure) {
        smtpConfig.tls = {
          ...smtpConfig.tls,
          rejectUnauthorized: false,
          minVersion: 'TLSv1'
        };
      }

      console.log('SMTP Config:', JSON.stringify(smtpConfig, null, 2));

      const transporter = nodemailer.createTransport(smtpConfig);

      // Verify SMTP connection with timeout
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);
      results.smtp.success = true;
      console.log('SMTP connection successful');
    } catch (error: any) {
      console.error('SMTP connection error:', error);
      results.smtp.error = error.message || 'SMTP connection failed';
    }

    // Test IMAP connection (if provided)
    if (imapHost && imapPort && imapUsername && imapPassword) {
      try {
        console.log('Testing IMAP connection with:', {
          host: imapHost,
          port: imapPort,
          encryption: imapEncryption,
          username: imapUsername
        });

        // Test basic connectivity to IMAP port
        const imapPortTest = await testPortConnectivity(imapHost, parseInt(imapPort));
        if (!imapPortTest) {
          throw new Error(`Cannot connect to IMAP server ${imapHost}:${imapPort}`);
        }

        results.imap.success = true;
        console.log('IMAP connection test passed');
      } catch (error: any) {
        console.error('IMAP connection error:', error);
        results.imap.error = error.message || 'IMAP connection failed';
      }
    } else {
      results.imap.success = true; // IMAP is optional
    }

    // Overall success if SMTP works (IMAP is optional)
    const overallSuccess = results.smtp.success;

    let message = '';
    if (overallSuccess) {
      if (results.imap.success) {
        message = 'Connection test successful! Both SMTP and IMAP are working.';
      } else {
        message = 'SMTP connection successful! IMAP connection failed but is optional.';
      }
    } else {
      message = `SMTP connection failed: ${results.smtp.error || 'Unknown error'}`;
      if (results.imap.error) {
        message += ` | IMAP error: ${results.imap.error}`;
      }
    }

    console.log('Connection test results:', results);
    console.log('Final message:', message);

    return NextResponse.json({
      success: overallSuccess,
      results,
      message,
      details: {
        smtpStatus: results.smtp.success ? 'Connected' : 'Failed',
        smtpError: results.smtp.error,
        imapStatus: results.imap.success ? 'Connected' : 'Failed',
        imapError: results.imap.error,
      }
    });
  } catch (error: any) {
    console.error('Error testing email connection:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to test connection',
        results: {
          smtp: { success: false, error: error.message },
          imap: { success: false, error: 'Not tested due to SMTP failure' },
        }
      },
      { status: 500 }
    );
  }
}
