"use client"

import React, { useState, useEffect } from "react"
import { Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/components/ui/use-toast"

interface Comment {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
}

interface TaskCommentsProps {
  taskId: string
  currentUserId: string
}

export default function TaskComments({ taskId, currentUserId }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [taskId])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tasks/comments?taskId=${taskId}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setComments(data)
    } catch (error) {
      console.error('Error fetching comments:', error)
      toast({ title: 'Error', description: 'Failed to load comments' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      const response = await fetch('/api/tasks/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          content: newComment,
          mentions: [],
        }),
      })
      if (!response.ok) throw new Error('Failed to create comment')
      setNewComment("")
      fetchComments()
      toast({ title: 'Success', description: 'Comment added' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add comment' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      const response = await fetch('/api/tasks/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchComments()
      toast({ title: 'Success', description: 'Comment deleted' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete comment' })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-4">Comments</h3>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No comments yet</div>
        ) : (
          <div className="space-y-4 mb-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.user.image} />
                  <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{comment.user.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {comment.user.id === currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(comment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm mt-2 text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-20"
        />
        <Button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Posting...' : 'Post Comment'}
        </Button>
      </form>
    </div>
  )
}

