"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Lightbulb, AlertCircle, CheckCircle2, Zap } from "lucide-react"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface LoanAITabProps {
  loanId: string
}

const INITIAL_SUGGESTIONS = [
  {
    icon: AlertCircle,
    title: 'Missing Documents',
    description: 'Request updated tax returns from borrower',
    color: 'text-orange-600',
  },
  {
    icon: Zap,
    title: 'DSCR Analysis',
    description: 'Current DSCR is 1.18, which meets minimum requirements',
    color: 'text-green-600',
  },
  {
    icon: CheckCircle2,
    title: 'Next Steps',
    description: 'Schedule property inspection and appraisal review',
    color: 'text-blue-600',
  },
]

export default function LoanAITab({ loanId }: LoanAITabProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async () => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages([...messages, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: `I'm analyzing your loan application. Based on the information provided, here are my insights:\n\n• Your DSCR ratio is strong at 1.18\n• All required documents are pending review\n• Property valuation is within acceptable range\n• Recommend scheduling appraisal within 5 business days`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col">
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 mx-auto text-blue-500 mb-3" />
            <h3 className="font-semibold text-lg mb-2">AI Loan Assistant</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Ask me anything about this loan application. I can help with analysis, document review, and next steps.
            </p>
          </div>

          {/* Quick Suggestions */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            {INITIAL_SUGGESTIONS.map((suggestion) => {
              const Icon = suggestion.icon
              return (
                <Card
                  key={suggestion.title}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setInput(suggestion.description)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 ${suggestion.color} mt-1`} />
                      <div>
                        <div className="font-semibold text-sm">{suggestion.title}</div>
                        <div className="text-xs text-muted-foreground">{suggestion.description}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 mb-4 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <div className="text-xs mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-900 px-4 py-2 rounded-lg rounded-bl-none">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <Input
          placeholder="Ask me about this loan..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

