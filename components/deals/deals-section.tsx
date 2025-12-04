'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, TrendingUp, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Deal {
  id: string;
  name: string;
  stage: string;
  value: number;
  probability: number;
  expectedCloseDate?: string;
  contactName?: string;
  createdAt: string;
}

export default function DealsSection() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    totalValue: 0,
    won: 0,
    inProgress: 0,
  });

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/deals');
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
        
        // Calculate stats
        const total = data.deals?.length || 0;
        const totalValue = data.deals?.reduce((sum: number, deal: Deal) => sum + Number(deal.value || 0), 0) || 0;
        const won = data.deals?.filter((d: Deal) => d.stage === 'won').length || 0;
        const inProgress = data.deals?.filter((d: Deal) => !['won', 'lost'].includes(d.stage)).length || 0;
        
        setStats({ total, totalValue, won, inProgress });
      }
    } catch (error) {
      console.error('Error loading deals:', error);
      toast.error('Failed to load deals');
    } finally {
      setIsLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-gray-500',
      qualified: 'bg-blue-500',
      proposal: 'bg-purple-500',
      negotiation: 'bg-orange-500',
      won: 'bg-green-500',
      lost: 'bg-red-500',
    };
    return colors[stage] || 'bg-gray-500';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground">Manage your sales pipeline</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Deal
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.won}</div>
          </CardContent>
        </Card>
      </div>

      {/* Deals List */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Deals</CardTitle>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No deals yet. Create your first deal to get started.</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Deal
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex-1">
                    <h3 className="font-semibold">{deal.name}</h3>
                    {deal.contactName && (
                      <p className="text-sm text-muted-foreground">{deal.contactName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={getStageColor(deal.stage)}>
                      {deal.stage}
                    </Badge>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(deal.value)}</p>
                      <p className="text-sm text-muted-foreground">{deal.probability}% probability</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

