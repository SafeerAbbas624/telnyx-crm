import { useState } from 'react';
import { useDealsStore } from '../stores/useDealsStore';
import { useContactStore } from '../stores/useContactStore';
import { formatCurrency, addCommas } from '../utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import { 
  Plus, 
  DollarSign, 
  Calendar, 
  User, 
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Circle,
  Settings,
  TrendingUp,
  Target,
  Phone,
  Mail,
  MapPin,
  Building,
  Home,
  PhoneCall,
  MessageSquare,
  Send as SendIcon,
  Archive,
  Pencil,
  X,
  Check,
  GripVertical,
  Search,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { toast } from 'sonner@2.0.3';
import { Deal, DealTask, Pipeline } from '../types/deals';
import { Contact } from '../types';

const TEAM_MEMBERS = [
  { id: '1', name: 'John Doe' },
  { id: '2', name: 'Jane Smith' },
  { id: '3', name: 'Mike Johnson' },
];

export function DealsModule() {
  const { 
    deals, 
    stages, 
    pipelines,
    activePipelineId,
    activePipeline,
    setActivePipelineId,
    createDeal, 
    updateDeal, 
    moveDeal, 
    deleteDeal,
    archiveDeal,
    addTaskToDeal,
    updateTask,
    deleteTask,
    createPipeline,
    updatePipeline,
    deletePipeline,
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
  } = useDealsStore();
  const { contacts } = useContactStore();
  
  const [showNewDealDialog, setShowNewDealDialog] = useState(false);
  const [showEditStagesDialog, setShowEditStagesDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showNewPipelineDialog, setShowNewPipelineDialog] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editingTask, setEditingTask] = useState<{dealId: string; taskId: string} | null>(null);
  const [taskEditValue, setTaskEditValue] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3b82f6');
  const [editingStage, setEditingStage] = useState<{id: string; name: string; color: string} | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Preset colors for stages
  const STAGE_COLORS = [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Green
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#6366f1', // Indigo
  ];

  // New Deal Form
  const [newDealForm, setNewDealForm] = useState({
    title: '',
    value: '',
    contactId: '',
    stage: stages[0]?.id || '',
    probability: '50',
    expectedCloseDate: '',
    notes: '',
  });

  // New Pipeline Form
  const [newPipelineForm, setNewPipelineForm] = useState({
    name: '',
    description: '',
  });

  // Calculate total value and stats
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const weightedValue = deals.reduce((sum, deal) => sum + (deal.value * (deal.probability / 100)), 0);
  const avgDealSize = deals.length > 0 ? totalValue / deals.length : 0;

  const getDealsByStage = (stageId: string) => {
    return deals.filter(deal => deal.stage === stageId);
  };

  const handleCreateDeal = () => {
    if (!newDealForm.title || !newDealForm.value || !newDealForm.contactId) {
      toast.error('Please fill in all required fields');
      return;
    }

    const contact = contacts.find(c => c.id === newDealForm.contactId);
    if (!contact) return;

    createDeal({
      title: newDealForm.title,
      value: parseFloat(newDealForm.value),
      contactId: contact.id,
      contactName: contact.name,
      stage: newDealForm.stage,
      probability: parseInt(newDealForm.probability),
      expectedCloseDate: newDealForm.expectedCloseDate,
      notes: newDealForm.notes,
      tasks: [],
      assignedTo: '1',
      pipelineId: activePipelineId,
    });

    toast.success('Deal created successfully!');
    setShowNewDealDialog(false);
    setNewDealForm({
      title: '',
      value: '',
      contactId: '',
      stage: stages[0]?.id || '',
      probability: '50',
      expectedCloseDate: '',
      notes: '',
    });
  };

  const handleCreatePipeline = () => {
    if (!newPipelineForm.name) {
      toast.error('Please enter a pipeline name');
      return;
    }

    createPipeline({
      name: newPipelineForm.name,
      description: newPipelineForm.description,
      stages: [...stages], // Copy current stages
      isDefault: false,
    });

    toast.success('Pipeline created successfully!');
    setShowNewPipelineDialog(false);
    setNewPipelineForm({ name: '', description: '' });
  };

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    e.dataTransfer.setData('dealId', deal.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    moveDeal(dealId, stageId);
    toast.success('Deal moved successfully!');
  };

  const handleContactClick = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      setSelectedContact(contact);
      setShowContactDialog(true);
    }
  };

  const handleTaskEdit = (dealId: string, task: DealTask) => {
    setEditingTask({ dealId, taskId: task.id });
    setTaskEditValue(task.title);
  };

  const handleTaskSave = (dealId: string, taskId: string) => {
    if (taskEditValue.trim()) {
      updateTask(dealId, taskId, { title: taskEditValue.trim() });
      toast.success('Task updated!');
    }
    setEditingTask(null);
    setTaskEditValue('');
  };

  const handleTaskToggle = (dealId: string, taskId: string, completed: boolean) => {
    updateTask(dealId, taskId, { completed });
    toast.success(completed ? 'Task completed!' : 'Task reopened');
  };

  const handleAddTask = (dealId: string) => {
    const taskTitle = prompt('Enter task title:');
    if (taskTitle && taskTitle.trim()) {
      const dueDate = prompt('Enter due date (YYYY-MM-DD):') || new Date().toISOString().split('T')[0];
      addTaskToDeal(dealId, {
        title: taskTitle.trim(),
        dueDate,
        completed: false,
      });
      toast.success('Task added!');
    }
  };

  // Stage drag and drop handlers
  const handleStageDragStart = (e: React.DragEvent, stageId: string) => {
    setDraggedStageId(stageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleStageDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleStageDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    
    if (!draggedStageId || draggedStageId === targetStageId) {
      setDraggedStageId(null);
      setDragOverStageId(null);
      return;
    }

    const draggedIndex = stages.findIndex(s => s.id === draggedStageId);
    const targetIndex = stages.findIndex(s => s.id === targetStageId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newStages = [...stages];
    const [draggedStage] = newStages.splice(draggedIndex, 1);
    newStages.splice(targetIndex, 0, draggedStage);

    reorderStages(newStages);
    toast.success('Stage order updated');
    
    setDraggedStageId(null);
    setDragOverStageId(null);
  };

  const handleStageDragEnd = () => {
    setDraggedStageId(null);
    setDragOverStageId(null);
  };

  const getStageColor = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.color || '#94a3b8';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1>Deals Pipeline</h1>
            <p className="text-muted-foreground">Manage your deals and track progress</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Pipeline Selector */}
            <Select value={activePipelineId} onValueChange={(newId) => {
              setActivePipelineId(newId);
              const pipeline = pipelines.find(p => p.id === newId);
              toast.success('Pipeline Switched', {
                description: `Now viewing ${pipeline?.name} with ${pipeline?.stages.length} stages`
              });
            }}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(pipeline => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{pipeline.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {pipeline.stages.length} stages
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              onClick={() => setShowNewPipelineDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Pipeline
            </Button>

            <Button onClick={() => setShowNewDealDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Deal
            </Button>

            <Button variant="outline" onClick={() => setShowEditStagesDialog(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Edit Stages
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                  <p className="text-2xl">{deals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl">{formatCurrency(totalValue, { notation: 'compact' })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weighted Value</p>
                  <p className="text-2xl">{formatCurrency(weightedValue, { notation: 'compact' })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                  <p className="text-2xl">{formatCurrency(avgDealSize, { notation: 'compact' })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pipeline Board */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="flex gap-4 min-w-max">
            {stages.map(stage => {
              const stageDeals = getDealsByStage(stage.id);
              const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);

              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-80"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <CardTitle className="text-base">{stage.name}</CardTitle>
                          <Badge variant="secondary">{stageDeals.length}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(stageValue, { notation: 'compact' })} value
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ScrollArea className="h-[calc(100vh-400px)]">
                        <div className="space-y-3 pr-3">
                          {stageDeals.map(deal => {
                            const contact = contacts.find(c => c.id === deal.contactId);
                            
                            return (
                              <Card
                                key={deal.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, deal)}
                                className="cursor-move hover:shadow-md transition-shadow border-l-4"
                                style={{ borderLeftColor: getStageColor(deal.stage) }}
                              >
                                <CardContent className="p-4 space-y-3">
                                  {/* Deal Header */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium line-clamp-2">{deal.title}</h4>
                                        {deal.loanData && (
                                          <Badge variant="secondary" className="text-xs shrink-0">
                                            Loan
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        ${deal.value.toLocaleString()}
                                      </p>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setSelectedDeal(deal)}>
                                          <Edit className="h-4 w-4 mr-2" />
                                          Edit Deal
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => archiveDeal(deal.id)}>
                                          <Archive className="h-4 w-4 mr-2" />
                                          Archive
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            if (confirm('Delete this deal?')) {
                                              deleteDeal(deal.id);
                                              toast.success('Deal deleted');
                                            }
                                          }}
                                          className="text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  {/* Contact - Clickable */}
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span
                                      className="text-sm cursor-pointer hover:underline text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleContactClick(deal.contactId);
                                      }}
                                    >
                                      {deal.contactName}
                                    </span>
                                  </div>

                                  {/* Close Date */}
                                  {deal.expectedCloseDate && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Calendar className="h-4 w-4" />
                                      <span>{deal.expectedCloseDate}</span>
                                    </div>
                                  )}

                                  {/* Tasks */}
                                  {deal.tasks.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t">
                                      {deal.tasks.map(task => (
                                        <div
                                          key={task.id}
                                          className="flex items-center gap-2 group"
                                        >
                                          {editingTask?.dealId === deal.id && editingTask?.taskId === task.id ? (
                                            <>
                                              <Input
                                                value={taskEditValue}
                                                onChange={(e) => setTaskEditValue(e.target.value)}
                                                className="h-7 text-xs flex-1"
                                                autoFocus
                                                onKeyPress={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleTaskSave(deal.id, task.id);
                                                  }
                                                }}
                                              />
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => handleTaskSave(deal.id, task.id)}
                                              >
                                                <Check className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                  setEditingTask(null);
                                                  setTaskEditValue('');
                                                }}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </>
                                          ) : (
                                            <>
                                              <Checkbox
                                                checked={task.completed}
                                                onCheckedChange={(checked) => 
                                                  handleTaskToggle(deal.id, task.id, !!checked)
                                                }
                                                className="h-4 w-4"
                                              />
                                              <span
                                                className={`text-xs flex-1 ${
                                                  task.completed ? 'line-through text-muted-foreground' : ''
                                                }`}
                                              >
                                                {task.title}
                                              </span>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                                onClick={() => handleTaskEdit(deal.id, task)}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                                onClick={() => {
                                                  deleteTask(deal.id, task.id);
                                                  toast.success('Task deleted');
                                                }}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-full text-xs"
                                        onClick={() => handleAddTask(deal.id)}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Task
                                      </Button>
                                    </div>
                                  )}

                                  {deal.tasks.length === 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-full text-xs mt-2"
                                      onClick={() => handleAddTask(deal.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Task
                                    </Button>
                                  )}

                                  {/* Probability Badge */}
                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <Badge variant="outline" className="text-xs">
                                      {deal.probability}% probability
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* New Deal Dialog */}
      <Dialog open={showNewDealDialog} onOpenChange={setShowNewDealDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>Add a new deal to your pipeline</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label>Deal Title *</Label>
              <Input
                value={newDealForm.title}
                onChange={(e) => setNewDealForm({ ...newDealForm, title: e.target.value })}
                placeholder="123 Main St - Duplex"
              />
            </div>

            <div className="space-y-2">
              <Label>Deal Value *</Label>
              <Input
                type="number"
                value={newDealForm.value}
                onChange={(e) => setNewDealForm({ ...newDealForm, value: e.target.value })}
                placeholder="500000"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact *</Label>
              <Select
                value={newDealForm.contactId}
                onValueChange={(value) => {
                  setNewDealForm({ ...newDealForm, contactId: value });
                  setContactSearchQuery('');
                }}
                onOpenChange={(open) => {
                  if (!open) setContactSearchQuery('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search contacts..."
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {contacts
                      .filter(contact => {
                        if (!contactSearchQuery) return true;
                        const query = contactSearchQuery.toLowerCase();
                        return (
                          contact.name.toLowerCase().includes(query) ||
                          contact.email.toLowerCase().includes(query) ||
                          contact.phone.toLowerCase().includes(query) ||
                          (contact.company && contact.company.toLowerCase().includes(query))
                        );
                      })
                      .map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{contact.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {contact.email} · {contact.phone}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    {contacts.filter(contact => {
                      if (!contactSearchQuery) return false;
                      const query = contactSearchQuery.toLowerCase();
                      return (
                        contact.name.toLowerCase().includes(query) ||
                        contact.email.toLowerCase().includes(query) ||
                        contact.phone.toLowerCase().includes(query) ||
                        (contact.company && contact.company.toLowerCase().includes(query))
                      );
                    }).length === 0 && contactSearchQuery && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No contacts found matching "{contactSearchQuery}"
                      </div>
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={newDealForm.stage}
                onValueChange={(value) => setNewDealForm({ ...newDealForm, stage: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Probability (%)</Label>
              <Input
                type="number"
                value={newDealForm.probability}
                onChange={(e) => setNewDealForm({ ...newDealForm, probability: e.target.value })}
                placeholder="50"
                min="0"
                max="100"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Expected Close Date</Label>
              <Input
                type="date"
                value={newDealForm.expectedCloseDate}
                onChange={(e) => setNewDealForm({ ...newDealForm, expectedCloseDate: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newDealForm.notes}
                onChange={(e) => setNewDealForm({ ...newDealForm, notes: e.target.value })}
                placeholder="Additional notes about this deal..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDealDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeal}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Pipeline Dialog */}
      <Dialog open={showNewPipelineDialog} onOpenChange={setShowNewPipelineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Pipeline</DialogTitle>
            <DialogDescription>
              Create a new deal pipeline. It will start with the same stages as your current pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pipeline Name *</Label>
              <Input
                value={newPipelineForm.name}
                onChange={(e) => setNewPipelineForm({ ...newPipelineForm, name: e.target.value })}
                placeholder="Q4 2025 Pipeline"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={newPipelineForm.description}
                onChange={(e) => setNewPipelineForm({ ...newPipelineForm, description: e.target.value })}
                placeholder="Describe the purpose of this pipeline..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPipelineDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePipeline}>Create Pipeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">
                  {selectedContact?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-2xl">{selectedContact?.name}</DialogTitle>
                <p className="text-muted-foreground">{selectedContact?.company}</p>
              </div>
            </div>
          </DialogHeader>

          {selectedContact && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="property">Property</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedContact.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedContact.phone}</span>
                    </div>
                    {selectedContact.company && (
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedContact.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Badge>{selectedContact.status}</Badge>
                      {selectedContact.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selectedContact.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{selectedContact.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="property" className="space-y-4">
                {selectedContact.property ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Property Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{selectedContact.property.address}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedContact.property.city}, {selectedContact.property.state} {selectedContact.property.zip}
                          </p>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Property Type</p>
                          <p className="font-medium">{selectedContact.property.type}</p>
                        </div>
                        {selectedContact.property.units && (
                          <div>
                            <p className="text-sm text-muted-foreground">Units</p>
                            <p className="font-medium">{selectedContact.property.units}</p>
                          </div>
                        )}
                      </div>
                      {selectedContact.property.llcOwner && (
                        <div>
                          <p className="text-sm text-muted-foreground">LLC Owner</p>
                          <p className="font-medium">{selectedContact.property.llcOwner}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No property information available</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <ScrollArea className="h-[400px]">
                  {selectedContact.activities && selectedContact.activities.length > 0 ? (
                    <div className="space-y-3">
                      {selectedContact.activities.map(activity => (
                        <Card key={activity.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                {activity.type === 'call' && <PhoneCall className="h-4 w-4 text-primary" />}
                                {activity.type === 'email' && <Mail className="h-4 w-4 text-primary" />}
                                {activity.type === 'sms' && <MessageSquare className="h-4 w-4 text-primary" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium capitalize">{activity.type}</span>
                                  <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{activity.content}</p>
                                {activity.duration && (
                                  <Badge variant="outline" className="mt-2">{activity.duration}</Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No activity history available</p>
                      </CardContent>
                    </Card>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button onClick={() => setShowContactDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Pipeline Dialog */}
      <Dialog open={showNewPipelineDialog} onOpenChange={setShowNewPipelineDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Pipeline</DialogTitle>
            <DialogDescription>
              Create a new sales pipeline with custom stages
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pipeline Name *</Label>
              <Input
                placeholder="e.g., Commercial Sales, Wholesaling"
                value={newPipelineForm.name}
                onChange={(e) => setNewPipelineForm({ ...newPipelineForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description for this pipeline"
                rows={3}
                value={newPipelineForm.description}
                onChange={(e) => setNewPipelineForm({ ...newPipelineForm, description: e.target.value })}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">
                📝 The pipeline will be created with default stages (Lead, Contacted, Qualified, Proposal, Negotiation, Closed Won). 
                You can customize stages after creation using "Edit Stages".
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewPipelineDialog(false);
              setNewPipelineForm({ name: '', description: '' });
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newPipelineForm.name.trim()) {
                  const newPipeline = createPipeline({
                    name: newPipelineForm.name,
                    description: newPipelineForm.description,
                    stages: [...stages], // Copy current stages as default
                    isDefault: false,
                  });
                  setActivePipelineId(newPipeline.id);
                  toast.success('Pipeline Created', {
                    description: `"${newPipelineForm.name}" is now active`
                  });
                  setNewPipelineForm({ name: '', description: '' });
                  setShowNewPipelineDialog(false);
                }
              }}
              disabled={!newPipelineForm.name.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stages Dialog */}
      <Dialog open={showEditStagesDialog} onOpenChange={setShowEditStagesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Stages for {activePipeline?.name}</DialogTitle>
            <DialogDescription>
              Customize the stages for this pipeline. Changes only affect "{activePipeline?.name}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Stages List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Current Stages</Label>
                <span className="text-xs text-muted-foreground">Drag to reorder</span>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stages.map((stage, index) => (
                  <div 
                    key={stage.id}
                    draggable={!editingStage}
                    onDragStart={(e) => handleStageDragStart(e, stage.id)}
                    onDragOver={(e) => handleStageDragOver(e, stage.id)}
                    onDrop={(e) => handleStageDrop(e, stage.id)}
                    onDragEnd={handleStageDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-all ${
                      draggedStageId === stage.id 
                        ? 'opacity-50 cursor-grabbing' 
                        : dragOverStageId === stage.id
                        ? 'border-primary bg-primary/5 scale-105'
                        : 'hover:bg-accent/50 cursor-grab'
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex items-center gap-2 flex-1">
                      {editingStage?.id === stage.id ? (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="h-6 w-6 rounded-full flex-shrink-0 border-2 hover:scale-110 transition-transform cursor-pointer" 
                                style={{ backgroundColor: editingStage.color }}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-40">
                              <div className="p-2 grid grid-cols-4 gap-2">
                                {STAGE_COLORS.map(color => (
                                  <button
                                    key={color}
                                    className={`h-6 w-6 rounded-full border-2 transition-all hover:scale-110 ${
                                      editingStage.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                                    }`}
                                    style={{ backgroundColor: color, borderColor: color }}
                                    onClick={() => setEditingStage({ ...editingStage, color })}
                                  />
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Input
                            value={editingStage.name}
                            onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateStage(stage.id, { name: editingStage.name, color: editingStage.color });
                                setEditingStage(null);
                                toast.success('Stage Updated');
                              } else if (e.key === 'Escape') {
                                setEditingStage(null);
                              }
                            }}
                            className="h-8"
                            autoFocus
                          />
                        </>
                      ) : (
                        <>
                          <div 
                            className="h-3 w-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="font-medium">{stage.name}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {editingStage?.id === stage.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              updateStage(stage.id, { name: editingStage.name, color: editingStage.color });
                              setEditingStage(null);
                              toast.success('Stage Updated');
                            }}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingStage(null)}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingStage({ id: stage.id, name: stage.name, color: stage.color })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (stages.length <= 1) {
                                toast.error('Cannot delete the last stage');
                                return;
                              }
                              deleteStage(stage.id);
                              toast.success('Stage Deleted');
                            }}
                            disabled={stages.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Add New Stage */}
            <div className="space-y-3">
              <Label>Add New Stage</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <div 
                    className="h-8 w-8 rounded-full border-2 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform" 
                    style={{ backgroundColor: newStageColor }}
                    title="Click to change color"
                  />
                  <Input
                    placeholder="Stage name (e.g., Due Diligence)"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newStageName.trim()) {
                        addStage({
                          name: newStageName,
                          color: newStageColor,
                        });
                        setNewStageName('');
                        setNewStageColor('#3b82f6');
                        toast.success('Stage Added', {
                          description: `"${newStageName}" added to ${activePipeline?.name}`
                        });
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={() => {
                    if (newStageName.trim()) {
                      addStage({
                        name: newStageName,
                        color: newStageColor,
                      });
                      setNewStageName('');
                      setNewStageColor('#3b82f6');
                      toast.success('Stage Added', {
                        description: `"${newStageName}" added to ${activePipeline?.name}`
                      });
                    }
                  }}
                  disabled={!newStageName.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
              </div>

              {/* Color Picker */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color:</span>
                <div className="flex gap-1.5">
                  {STAGE_COLORS.map(color => (
                    <button
                      key={color}
                      className={`h-6 w-6 rounded-full border-2 transition-all hover:scale-110 ${
                        newStageColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color, borderColor: color }}
                      onClick={() => setNewStageColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Press Enter to add the stage
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Settings className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Pipeline-Specific Stages
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    These stages only apply to "{activePipeline?.name}". Other pipelines have their own independent stages.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setShowEditStagesDialog(false);
              setEditingStage(null);
              setNewStageName('');
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
