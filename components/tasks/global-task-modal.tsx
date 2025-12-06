'use client';

import { useTaskUI } from '@/lib/context/task-ui-context';
import UnifiedCreateTaskModal from './unified-create-task-modal';

/**
 * Global Task Modal - renders the unified task creation modal
 * based on the TaskUIContext state.
 * 
 * This component should be rendered once at the app level (in providers.tsx)
 * and will automatically show/hide based on context state.
 */
export default function GlobalTaskModal() {
  const { isOpen, modalProps, closeTask, onTaskCreated } = useTaskUI();

  const handleTaskCreated = (task: any) => {
    // Call the registered callback if any
    onTaskCreated?.();
  };

  return (
    <UnifiedCreateTaskModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeTask();
      }}
      onTaskCreated={handleTaskCreated}
      initialContactId={modalProps.contactId}
      initialContactName={modalProps.contactName}
      initialSubject={modalProps.subject}
      initialType={modalProps.taskType}
      initialDueDate={modalProps.dueDate}
      initialPriority={modalProps.priority}
      initialDescription={modalProps.description}
    />
  );
}

