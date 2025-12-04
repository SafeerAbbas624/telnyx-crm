const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestTasks() {
  try {
    // Get first contact
    const contact = await prisma.contact.findFirst();
    if (!contact) {
      console.log('No contacts found. Please create a contact first.');
      process.exit(1);
    }

    console.log(`Creating test tasks for contact: ${contact.firstName} ${contact.lastName}`);

    // Create 5 test tasks
    const tasks = [
      {
        contact_id: contact.id,
        type: 'task',
        title: 'Follow up on property inquiry',
        description: 'Contact client about the property they inquired about',
        status: 'planned',
        priority: 'high',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      },
      {
        contact_id: contact.id,
        type: 'task',
        title: 'Send contract documents',
        description: 'Prepare and send contract documents to client',
        status: 'planned',
        priority: 'urgent',
        due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      },
      {
        contact_id: contact.id,
        type: 'task',
        title: 'Schedule property viewing',
        description: 'Coordinate with client to schedule property viewing',
        status: 'in_progress',
        priority: 'medium',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      },
      {
        contact_id: contact.id,
        type: 'task',
        title: 'Review financial documents',
        description: 'Review client financial documents for loan approval',
        status: 'planned',
        priority: 'high',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      },
      {
        contact_id: contact.id,
        type: 'task',
        title: 'Prepare market analysis',
        description: 'Prepare market analysis report for the property',
        status: 'completed',
        priority: 'medium',
        due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        completed_at: new Date(),
      },
    ];

    for (const task of tasks) {
      const created = await prisma.activity.create({
        data: task,
      });
      console.log(`✓ Created task: ${created.title}`);
    }

    console.log('\n✅ Test tasks created successfully!');
  } catch (error) {
    console.error('Error creating test tasks:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestTasks();

