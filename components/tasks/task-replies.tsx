'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Send, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface TaskRepliesProps {
  taskId: string;
  isAssignee?: boolean;
}

export default function TaskReplies({ taskId, isAssignee = false }: TaskRepliesProps) {
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<string>('');
  const { toast } = useToast();

  // Fetch replies
  useEffect(() => {
    const fetchReplies = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks/replies?taskId=${taskId}`);
        if (response.ok) {
          const data = await response.json();
          setReplies(data.replies || []);
        }
      } catch (error) {
        console.error('Error fetching replies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReplies();
  }, [taskId]);

  const handleSubmitReply = async () => {
    if (!content.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a reply',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/tasks/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          content: content.trim(),
          status: status || null,
          attachments: [],
        }),
      });

      if (!response.ok) throw new Error('Failed to submit reply');

      const newReply = await response.json();
      setReplies([newReply, ...replies]);
      setContent('');
      setStatus('');

      toast({
        title: 'Success',
        description: 'Reply posted successfully',
      });
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit reply',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'issue':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'issue':
        return 'Issue';
      case 'blocked':
        return 'Blocked';
      case 'on_hold':
        return 'On Hold';
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Reply Form (only for assignees) */}
      {isAssignee && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="text-sm font-medium">Your Reply</label>
            <Textarea
              placeholder="Add a status update or comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Status Update (Optional)</label>
            <Select value={status} onValueChange={setStatus} disabled={submitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No status change</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="issue">Issue Found</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmitReply}
            disabled={submitting || !content.trim()}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Posting...' : 'Post Reply'}
          </Button>
        </div>
      )}

      {/* Replies List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">
          Replies ({replies.length})
        </h3>

        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading replies...</div>
        ) : replies.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No replies yet
          </div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="bg-white border rounded-lg p-3 space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback>
                      {reply.user.firstName.charAt(0)}
                      {reply.user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">
                      {reply.user.firstName} {reply.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(reply.createdAt).toLocaleDateString()} at{' '}
                      {new Date(reply.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                {reply.status && (
                  <div className="flex items-center gap-1">
                    {getStatusIcon(reply.status)}
                    <span className="text-xs font-medium">
                      {getStatusLabel(reply.status)}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <p className="text-sm text-gray-700">{reply.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

