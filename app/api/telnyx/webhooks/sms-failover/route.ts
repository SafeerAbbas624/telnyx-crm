import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, event_type, occurred_at, id: webhookId } = body;

    console.log('Telnyx SMS failover webhook received:', { 
      event_type, 
      webhookId, 
      occurred_at,
      messageId: data?.payload?.id || data?.id
    });

    // Log the failover event for monitoring
    console.warn('Primary SMS webhook failed, using failover:', {
      event_type,
      messageId: data?.payload?.id || data?.id,
      timestamp: occurred_at
    });

    // For now, just acknowledge receipt
    // In production, you might want to:
    // 1. Store in a separate failover table
    // 2. Send alerts to monitoring systems
    // 3. Retry processing the original webhook logic

    return NextResponse.json({ 
      success: true, 
      message: 'Failover webhook received' 
    });
  } catch (error) {
    console.error('Error processing Telnyx SMS failover webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process failover webhook' },
      { status: 500 }
    );
  }
}
