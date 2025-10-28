import { NextRequest, NextResponse } from 'next/server';

// In-memory store for email tracking (in production, use a database)
const emailTrackingStore: Map<string, {
  messageId: string;
  to: string;
  subject: string;
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
  status: 'sent' | 'opened' | 'clicked' | 'bounced';
  loanId: string;
}> = new Map();

export async function POST(request: NextRequest) {
  try {
    const { action, messageId, loanId, to, subject } = await request.json();

    if (action === 'track_send') {
      // Track email send
      const trackingId = `${messageId}-${Date.now()}`;
      emailTrackingStore.set(trackingId, {
        messageId,
        to,
        subject,
        sentAt: new Date().toISOString(),
        status: 'sent',
        loanId,
      });

      return NextResponse.json({
        success: true,
        trackingId,
        message: 'Email send tracked',
      });
    }

    if (action === 'track_open') {
      // Track email open
      const tracking = emailTrackingStore.get(messageId);
      if (tracking) {
        tracking.openedAt = new Date().toISOString();
        tracking.status = 'opened';
        emailTrackingStore.set(messageId, tracking);
      }

      return NextResponse.json({
        success: true,
        message: 'Email open tracked',
      });
    }

    if (action === 'track_click') {
      // Track email click
      const tracking = emailTrackingStore.get(messageId);
      if (tracking) {
        tracking.clickedAt = new Date().toISOString();
        tracking.status = 'clicked';
        emailTrackingStore.set(messageId, tracking);
      }

      return NextResponse.json({
        success: true,
        message: 'Email click tracked',
      });
    }

    if (action === 'get_tracking') {
      // Get tracking data for a loan
      const trackingData = Array.from(emailTrackingStore.values()).filter(
        t => t.loanId === loanId
      );

      return NextResponse.json({
        success: true,
        tracking: trackingData,
      });
    }

    if (action === 'get_stats') {
      // Get email statistics for a loan
      const trackingData = Array.from(emailTrackingStore.values()).filter(
        t => t.loanId === loanId
      );

      const stats = {
        total: trackingData.length,
        sent: trackingData.filter(t => t.status === 'sent').length,
        opened: trackingData.filter(t => t.status === 'opened').length,
        clicked: trackingData.filter(t => t.status === 'clicked').length,
        bounced: trackingData.filter(t => t.status === 'bounced').length,
        openRate: trackingData.length > 0 
          ? ((trackingData.filter(t => t.status === 'opened').length / trackingData.length) * 100).toFixed(2)
          : '0',
        clickRate: trackingData.length > 0
          ? ((trackingData.filter(t => t.status === 'clicked').length / trackingData.length) * 100).toFixed(2)
          : '0',
      };

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Error tracking email:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to track email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

