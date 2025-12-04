'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Phone, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import Footer from '@/components/footer';

interface TelnyxPhoneNumber {
  id: string;
  phoneNumber: string;
  telnyxId?: string;
  state?: string;
  city?: string;
  isActive: boolean;
  capabilities: string[];
  monthlyPrice?: number;
  totalSmsCount: number;
  totalCallCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

export default function TelnyxNumbersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newNumber, setNewNumber] = useState({
    phoneNumber: '',
    telnyxId: '',
    state: '',
    city: '',
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  const fetchPhoneNumbers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/telnyx/phone-numbers');
      if (response.ok) {
        const data = await response.json();
        setPhoneNumbers(data);
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      toast.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNumber = async () => {
    if (!newNumber.phoneNumber.trim()) {
      toast.error('Phone number is required');
      return;
    }

    try {
      setAdding(true);
      const response = await fetch('/api/telnyx/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNumber),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add phone number');
      }

      toast.success('Phone number added successfully');
      setShowAddDialog(false);
      setNewNumber({ phoneNumber: '', telnyxId: '', state: '', city: '' });
      fetchPhoneNumbers();
    } catch (error) {
      console.error('Error adding phone number:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add phone number');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteNumber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phone number?')) return;

    try {
      const response = await fetch(`/api/telnyx/phone-numbers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete phone number');
      }

      toast.success('Phone number deleted');
      fetchPhoneNumbers();
    } catch (error) {
      console.error('Error deleting phone number:', error);
      toast.error('Failed to delete phone number');
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab="settings" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Telnyx Phone Numbers</h1>
                  <p className="text-muted-foreground">Manage your Telnyx phone numbers for calls and SMS</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Number
                </Button>
              </div>

              {/* Phone Numbers List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : phoneNumbers.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No phone numbers yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Add your first Telnyx phone number to start making calls and sending SMS
                      </p>
                      <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Number
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {phoneNumbers.map((number) => (
                    <Card key={number.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-xl">{formatPhoneNumber(number.phoneNumber)}</CardTitle>
                              <CardDescription>
                                {number.city && number.state ? `${number.city}, ${number.state}` : 'Location not specified'}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {number.isActive ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNumber(number.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Capabilities</p>
                            <div className="flex gap-1 mt-1">
                              {number.capabilities.map((cap) => (
                                <Badge key={cap} variant="secondary" className="text-xs">
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Calls</p>
                            <p className="text-lg font-semibold">{number.totalCallCount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total SMS</p>
                            <p className="text-lg font-semibold">{number.totalSmsCount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Last Used</p>
                            <p className="text-sm">
                              {number.lastUsedAt
                                ? new Date(number.lastUsedAt).toLocaleDateString()
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                        {number.telnyxId && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted-foreground">
                              Telnyx ID: <span className="font-mono">{number.telnyxId}</span>
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Add Number Dialog */}
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Telnyx Phone Number</DialogTitle>
                    <DialogDescription>
                      Add a phone number from your Telnyx account. Make sure the number is already purchased in Telnyx.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        placeholder="+12345678900"
                        value={newNumber.phoneNumber}
                        onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter in E.164 format (e.g., +12345678900)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telnyxId">Telnyx ID (Optional)</Label>
                      <Input
                        id="telnyxId"
                        placeholder="Enter Telnyx phone number ID"
                        value={newNumber.telnyxId}
                        onChange={(e) => setNewNumber({ ...newNumber, telnyxId: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City (Optional)</Label>
                        <Input
                          id="city"
                          placeholder="Miami"
                          value={newNumber.city}
                          onChange={(e) => setNewNumber({ ...newNumber, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State (Optional)</Label>
                        <Input
                          id="state"
                          placeholder="FL"
                          value={newNumber.state}
                          onChange={(e) => setNewNumber({ ...newNumber, state: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={adding}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddNumber} disabled={adding}>
                      {adding ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Number
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}

