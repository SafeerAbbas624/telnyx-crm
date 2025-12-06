'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Wand2, FileText, CheckSquare, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LoanAIAssistantProps {
  dealId: string;
  deal: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: 'Generate Checklist', icon: CheckSquare, prompt: 'Generate a document checklist for this loan based on the loan type and lender requirements.' },
  { label: 'Draft Email to Borrower', icon: Mail, prompt: 'Draft a professional email to the borrower requesting missing documents.' },
  { label: 'Summarize Loan', icon: FileText, prompt: 'Provide a summary of this loan including key details, current status, and next steps.' },
  { label: 'Analyze Deal', icon: Wand2, prompt: 'Analyze this deal and provide insights on potential issues or areas that need attention.' },
];

export default function LoanAIAssistant({ dealId, deal }: LoanAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (prompt?: string) => {
    const messageText = prompt || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // TODO: Integrate with actual AI API
      // For now, simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I understand you're asking about "${messageText.substring(0, 50)}..."\n\nThis is a placeholder response. The AI assistant will be integrated with your preferred AI provider (OpenAI, Anthropic, etc.) to provide intelligent responses about:\n\n• Loan document requirements\n• Lender guidelines\n• Deal analysis\n• Email drafting\n• Checklist generation\n\nPlease configure your AI API key in settings to enable this feature.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to get AI response');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            AI Assistant
          </h2>
          <p className="text-sm text-muted-foreground">
            Get help with loan processing, document analysis, and more
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleSend(action.prompt)}
            disabled={loading}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">How can I help?</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ask me anything about this loan, or use the quick actions above to get started.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            </div>
          )}
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this loan..."
              className="min-h-[60px] resize-none"
              disabled={loading}
            />
            <Button onClick={() => handleSend()} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

