/**
 * Test script to send an email with attachment from one account to another
 * This will test:
 * 1. Email sending with attachments
 * 2. CC/BCC functionality
 * 3. Email validation
 * 4. Auto-sync receiving the email
 */

const fs = require('fs');
const path = require('path');

async function testEmailSend() {
  try {
    console.log('🧪 Starting email send test...\n');

    // Create a test attachment
    const testAttachmentPath = path.join(__dirname, 'test-attachment.txt');
    fs.writeFileSync(testAttachmentPath, 'This is a test attachment file created at ' + new Date().toISOString());
    console.log('✅ Created test attachment:', testAttachmentPath);

    // Prepare form data
    const FormData = require('form-data');
    const form = new FormData();

    // Email details
    const fromAccountId = 'a0673f3b-863d-4165-a290-9e51270b9096'; // dan@adlercapital.info
    const toEmail = 'joe@adlercapital.us'; // Send to Joe's account
    const ccEmail = 'ed@adlercapital.us'; // CC to Ed
    const subject = 'Test Email with Attachment - ' + new Date().toISOString();
    const content = '<h1>Test Email</h1><p>This is a test email sent from <strong>dan@adlercapital.info</strong> to <strong>joe@adlercapital.us</strong></p><p>CC: ed@adlercapital.us</p><p>This email includes:</p><ul><li>HTML content</li><li>File attachment</li><li>CC recipient</li></ul><p>Sent at: ' + new Date().toISOString() + '</p>';
    const textContent = 'Test Email\n\nThis is a test email sent from dan@adlercapital.info to joe@adlercapital.us\nCC: ed@adlercapital.us\n\nThis email includes:\n- HTML content\n- File attachment\n- CC recipient\n\nSent at: ' + new Date().toISOString();

    // Add form fields
    form.append('emailAccountId', fromAccountId);
    form.append('toEmails', JSON.stringify([toEmail]));
    form.append('ccEmails', JSON.stringify([ccEmail]));
    form.append('subject', subject);
    form.append('content', content);
    form.append('textContent', textContent);

    // Add attachment
    form.append('attachments', fs.createReadStream(testAttachmentPath));

    console.log('\n📧 Sending email...');
    console.log('From: dan@adlercapital.info');
    console.log('To:', toEmail);
    console.log('CC:', ccEmail);
    console.log('Subject:', subject);
    console.log('Attachment: test-attachment.txt');

    // Send the email
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3000/api/email/send', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Status:', result.status);
      console.log('\n📬 Waiting 35 seconds for auto-sync to receive the email...');
      
      // Wait for auto-sync (runs every 30 seconds)
      await new Promise(resolve => setTimeout(resolve, 35000));
      
      console.log('\n🔍 Checking if email was received...');
      
      // Check Joe's account for the email
      const conversationsResponse = await fetch('http://localhost:3000/api/email/conversations?accountId=d3822dff-a50f-46b6-8695-9d0d95f645c0');
      const conversationsData = await conversationsResponse.json();
      
      console.log('\n📊 Joe\'s email conversations:', conversationsData.total || 0);
      
      if (conversationsData.conversations && conversationsData.conversations.length > 0) {
        console.log('\n✅ Found conversations in Joe\'s account:');
        conversationsData.conversations.slice(0, 3).forEach((conv, idx) => {
          console.log(`\n${idx + 1}. ${conv.contact?.firstName || 'Unknown'} ${conv.contact?.lastName || ''}`);
          console.log(`   Email: ${conv.emailAddress}`);
          console.log(`   Messages: ${conv.messageCount}`);
          console.log(`   Unread: ${conv.unreadCount}`);
          if (conv.lastMessage) {
            console.log(`   Last: ${conv.lastMessage.subject}`);
          }
        });
      }
      
      // Check Ed's account for CC
      const edConversationsResponse = await fetch('http://localhost:3000/api/email/conversations?accountId=0762ada3-bf21-45c4-967f-ebe96ef3083c');
      const edConversationsData = await edConversationsResponse.json();
      
      console.log('\n📊 Ed\'s email conversations (CC):', edConversationsData.total || 0);
      
      if (edConversationsData.conversations && edConversationsData.conversations.length > 0) {
        console.log('\n✅ Found conversations in Ed\'s account:');
        edConversationsData.conversations.slice(0, 3).forEach((conv, idx) => {
          console.log(`\n${idx + 1}. ${conv.contact?.firstName || 'Unknown'} ${conv.contact?.lastName || ''}`);
          console.log(`   Email: ${conv.emailAddress}`);
          console.log(`   Messages: ${conv.messageCount}`);
          console.log(`   Unread: ${conv.unreadCount}`);
          if (conv.lastMessage) {
            console.log(`   Last: ${conv.lastMessage.subject}`);
          }
        });
      }
      
    } else {
      console.error('\n❌ Failed to send email');
      console.error('Status:', response.status);
      console.error('Error:', result.error || result);
    }

    // Cleanup
    fs.unlinkSync(testAttachmentPath);
    console.log('\n🧹 Cleaned up test attachment');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testEmailSend();

