'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, MessageSquare, Mail, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  description?: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  textContent?: string;
  category?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function TemplatesSettings() {
  const [activeTab, setActiveTab] = useState('sms');
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // SMS Template Dialog
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [editingSmsTemplate, setEditingSmsTemplate] = useState<SmsTemplate | null>(null);
  const [smsForm, setSmsForm] = useState({ name: '', content: '', description: '' });
  const [savingSms, setSavingSms] = useState(false);
  
  // Email Template Dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);
  const [emailForm, setEmailForm] = useState({ name: '', subject: '', content: '', category: 'general' });
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const [smsRes, emailRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/email/templates')
      ]);
      if (smsRes.ok) {
        const smsData = await smsRes.json();
        setSmsTemplates(Array.isArray(smsData) ? smsData : smsData.templates || []);
      }
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        setEmailTemplates(emailData.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const openSmsDialog = (template?: SmsTemplate) => {
    if (template) {
      setEditingSmsTemplate(template);
      setSmsForm({ name: template.name, content: template.content, description: template.description || '' });
    } else {
      setEditingSmsTemplate(null);
      setSmsForm({ name: '', content: '', description: '' });
    }
    setShowSmsDialog(true);
  };

  const saveSmsTemplate = async () => {
    if (!smsForm.name.trim() || !smsForm.content.trim()) {
      toast.error('Name and content are required');
      return;
    }
    setSavingSms(true);
    try {
      const url = editingSmsTemplate ? `/api/templates/${editingSmsTemplate.id}` : '/api/templates';
      const method = editingSmsTemplate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smsForm)
      });
      if (res.ok) {
        toast.success(editingSmsTemplate ? 'Template updated' : 'Template created');
        setShowSmsDialog(false);
        fetchTemplates();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save template');
      }
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSavingSms(false);
    }
  };

  const deleteSmsTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Template deleted');
        fetchTemplates();
      } else {
        toast.error('Failed to delete template');
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const openEmailDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingEmailTemplate(template);
      setEmailForm({ name: template.name, subject: template.subject, content: template.content, category: template.category || 'general' });
    } else {
      setEditingEmailTemplate(null);
      setEmailForm({ name: '', subject: '', content: '', category: 'general' });
    }
    setShowEmailDialog(true);
  };

  const saveEmailTemplate = async () => {
    if (!emailForm.name.trim() || !emailForm.subject.trim() || !emailForm.content.trim()) {
      toast.error('Name, subject, and content are required');
      return;
    }
    setSavingEmail(true);
    try {
      const method = editingEmailTemplate ? 'PUT' : 'POST';
      const body = editingEmailTemplate ? { id: editingEmailTemplate.id, ...emailForm } : emailForm;
      const res = await fetch('/api/email/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        toast.success(editingEmailTemplate ? 'Template updated' : 'Template created');
        setShowEmailDialog(false);
        fetchTemplates();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save template');
      }
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSavingEmail(false);
    }
  };

  const deleteEmailTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/email/templates?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Template deleted');
        fetchTemplates();
      } else {
        toast.error('Failed to delete template');
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const extractVariables = (content: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const matches = Array.from(content.matchAll(regex));
    return [...new Set(matches.map(m => m[1]))];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Message Templates</h2>
          <p className="text-muted-foreground">Create and manage SMS and Email templates with variables</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Templates
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        {/* SMS Templates Tab */}
        <TabsContent value="sms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>SMS Templates</CardTitle>
                <CardDescription>Create templates with variables like {'{firstName}'}, {'{propertyAddress}'}</CardDescription>
              </div>
              <Button onClick={() => openSmsDialog()} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : smsTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No SMS templates yet. Create your first template!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {smsTemplates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4 hover:bg-muted/50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{template.name}</h3>
                          {template.description && <p className="text-sm text-muted-foreground mt-1">{template.description}</p>}
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{template.content}</p>
                          {template.variables && template.variables.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {(Array.isArray(template.variables) ? template.variables : []).map((v: string) => (
                                <Badge key={v} variant="secondary" className="text-xs">{`{${v}}`}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button variant="ghost" size="icon" onClick={() => openSmsDialog(template)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteSmsTemplate(template.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>Create email templates with subject lines and variables</CardDescription>
              </div>
              <Button onClick={() => openEmailDialog()} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : emailTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No email templates yet. Create your first template!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailTemplates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4 hover:bg-muted/50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{template.name}</h3>
                            {template.isSystem && <Badge variant="outline">System</Badge>}
                            <Badge variant="secondary">{template.category}</Badge>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground mt-1">Subject: {template.subject}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{template.content.replace(/<[^>]*>/g, '')}</p>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button variant="ghost" size="icon" onClick={() => openEmailDialog(template)} disabled={template.isSystem}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteEmailTemplate(template.id)} disabled={template.isSystem}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SMS Template Dialog */}
      <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSmsTemplate ? 'Edit SMS Template' : 'Create SMS Template'}</DialogTitle>
            <DialogDescription>Use {'{variableName}'} for dynamic content like {'{firstName}'}, {'{lastName}'}, {'{propertyAddress}'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Template Name</Label><Input value={smsForm.name} onChange={(e) => setSmsForm({ ...smsForm, name: e.target.value })} placeholder="e.g., Follow-up Message" /></div>
            <div><Label>Description (optional)</Label><Input value={smsForm.description} onChange={(e) => setSmsForm({ ...smsForm, description: e.target.value })} placeholder="Brief description" /></div>
            <div>
              <Label>Message Content</Label>
              <Textarea value={smsForm.content} onChange={(e) => setSmsForm({ ...smsForm, content: e.target.value })} placeholder="Hi {firstName}, I wanted to follow up about..." rows={5} />
              {smsForm.content && extractVariables(smsForm.content).length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Variables:</span>
                  {extractVariables(smsForm.content).map(v => <Badge key={v} variant="secondary" className="text-xs">{`{${v}}`}</Badge>)}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSmsDialog(false)}>Cancel</Button>
            <Button onClick={saveSmsTemplate} disabled={savingSms}>{savingSms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingSmsTemplate ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Template Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmailTemplate ? 'Edit Email Template' : 'Create Email Template'}</DialogTitle>
            <DialogDescription>Create reusable email templates with variables</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Template Name</Label><Input value={emailForm.name} onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })} placeholder="e.g., Welcome Email" /></div>
              <div><Label>Category</Label><Input value={emailForm.category} onChange={(e) => setEmailForm({ ...emailForm, category: e.target.value })} placeholder="e.g., general, marketing" /></div>
            </div>
            <div><Label>Subject Line</Label><Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder="e.g., Welcome to our service, {firstName}!" /></div>
            <div><Label>Email Content</Label><Textarea value={emailForm.content} onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })} placeholder="Dear {firstName},\n\nThank you for..." rows={8} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
            <Button onClick={saveEmailTemplate} disabled={savingEmail}>{savingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingEmailTemplate ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

