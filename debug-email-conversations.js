const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== EMAIL ACCOUNTS ===');
  const accounts = await prisma.emailAccount.findMany({
    select: {
      id: true,
      emailAddress: true,
      displayName: true,
      status: true
    }
  });
  console.log('Total accounts:', accounts.length);
  accounts.forEach(acc => {
    console.log(`- ${acc.emailAddress} (${acc.displayName}) - ${acc.status}`);
  });

  console.log('\n=== EMAIL CONVERSATIONS ===');
  const conversations = await prisma.emailConversation.findMany({
    take: 20,
    orderBy: { lastMessageAt: 'desc' },
    include: {
      contact: {
        select: {
          firstName: true,
          lastName: true,
          email1: true
        }
      }
    }
  });
  console.log('Total conversations:', conversations.length);
  conversations.forEach(conv => {
    console.log(`\nConversation ID: ${conv.id}`);
    console.log(`  Email Address: ${conv.emailAddress}`);
    console.log(`  Contact: ${conv.contact?.firstName} ${conv.contact?.lastName} (${conv.contact?.email1})`);
    console.log(`  Messages: ${conv.messageCount}, Unread: ${conv.unreadCount}`);
    console.log(`  Last Message: ${conv.lastMessageAt}`);
  });

  console.log('\n=== EMAIL MESSAGES ===');
  const messages = await prisma.emailMessage.findMany({
    take: 10,
    orderBy: { deliveredAt: 'desc' },
    select: {
      id: true,
      subject: true,
      fromEmail: true,
      toEmails: true,
      direction: true,
      deliveredAt: true,
      emailAccountId: true,
      emailAccount: {
        select: {
          emailAddress: true
        }
      }
    }
  });
  console.log('Total recent messages:', messages.length);
  messages.forEach(msg => {
    console.log(`\nMessage: ${msg.subject}`);
    console.log(`  From: ${msg.fromEmail}`);
    console.log(`  To: ${msg.toEmails.join(', ')}`);
    console.log(`  Direction: ${msg.direction}`);
    console.log(`  Account: ${msg.emailAccount?.emailAddress}`);
    console.log(`  Delivered: ${msg.deliveredAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

