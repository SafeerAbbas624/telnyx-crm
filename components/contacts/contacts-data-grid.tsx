'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  ColumnSizingState,
  ColumnOrderState,
  FilterFn,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/format-phone';
import { autoFitColumn } from '@/lib/excel-column-utils';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Settings2,
  Filter,
  Download,
  Upload,
  Save,
  Eye,
  EyeOff,
  GripVertical,
  X,
  SlidersHorizontal,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  Tag,
  Check,
  Plus,
  Phone,
  MessageSquare,
  Mail,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { Contact } from '@/lib/types';
import ContactSidePanel from './contact-side-panel';
import SmartFilterPanel from './smart-filter-panel';
import { useSmsUI } from '@/lib/context/sms-ui-context';
import { useCallUI } from '@/lib/context/call-ui-context';
import { useEmailUI } from '@/lib/context/email-ui-context';
import { useContacts } from '@/lib/context/contacts-context';

// Custom filter function for number ranges
const numberRangeFilter: FilterFn<any> = (row, columnId, filterValue) => {
  const value = row.getValue(columnId) as number;
  const { min, max } = filterValue || {};
  if (min !== undefined && min !== '' && value < Number(min)) return false;
  if (max !== undefined && max !== '' && value > Number(max)) return false;
  return true;
};

// Custom filter function for tags
const tagsFilter: FilterFn<any> = (row, columnId, filterValue) => {
  const tags = row.original.tags || [];
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.some((tagId: string) =>
    tags.some((tag: any) => tag.id === tagId || tag.name === tagId)
  );
};

// Global search filter - searches across multiple text columns
// Supports multi-word search: "george mena" finds contacts where ALL words match somewhere
const globalFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  if (!filterValue || filterValue === '') return true;
  const search = String(filterValue).toLowerCase().trim();
  const searchWords = search.split(/\s+/).filter(word => word.length > 0);

  // Build a combined searchable string from all relevant fields
  const searchableFields = [
    'firstName', 'lastName', 'fullName', 'email1', 'phone1',
    'propertyAddress', 'city', 'state', 'zipCode', 'llcName',
    'propertyType', 'notes'
  ];

  // Combine all searchable text into one string for multi-word matching
  let combinedText = '';
  for (const field of searchableFields) {
    const value = row.original[field];
    if (value) {
      combinedText += ' ' + String(value).toLowerCase();
    }
  }

  // Also include tags in combined text
  const tags = row.original.tags || [];
  for (const tag of tags) {
    if (tag.name) {
      combinedText += ' ' + String(tag.name).toLowerCase();
    }
  }

  // For multi-word search: ALL words must be found somewhere in the combined text
  // e.g., "george mena" matches if "george" is in firstName AND "mena" is in lastName
  return searchWords.every(word => combinedText.includes(word));
};

interface ContactsDataGridProps {
  onContactSelect?: (contact: Contact) => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string) => void;
  onAddContact?: () => void;
}

// Number fields that should use range filters
const NUMBER_FIELDS = new Set([
  'bedrooms', 'totalBathrooms', 'buildingSqft', 'lotSizeSqft',
  'effectiveYearBuilt', 'estValue', 'estEquity', 'propertyValue',
  'units', 'lastSaleAmount', 'estRemainingBalance'
]);

// Currency fields for formatting
const CURRENCY_FIELDS = new Set([
  'estValue', 'estEquity', 'propertyValue', 'lastSaleAmount', 'estRemainingBalance'
]);

export default function ContactsDataGrid({
  onContactSelect,
  onEditContact,
  onDeleteContact,
  onAddContact,
}: ContactsDataGridProps) {
  // CRM Action Hooks
  const { openSms } = useSmsUI();
  const { openCall } = useCallUI();
  const { openEmail } = useEmailUI();

  // Contacts context for filter options
  const { filterOptions, refreshFilterOptions } = useContacts();

  // Show/hide filter panel
  const [showFilters, setShowFilters] = useState(true);

  // Current active filters for API calls
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    // Hide firstName and lastName by default since fullName is shown
    firstName: false,
    lastName: false,
    // Hide some less commonly used fields by default
    lotSizeSqft: false,
    effectiveYearBuilt: false,
    contactAddress: false,
    contactCityStateZip: false,
    llcName: false,
    propertyCounty: false,
  });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [fieldDefinitions, setFieldDefinitions] = useState<any[]>([]);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<string>('default');
  const [defaultView, setDefaultView] = useState<string>('default');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Available tags for bulk assignment
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  // Bulk delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bulk tag assignment state
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [assigningTags, setAssigningTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [creatingTag, setCreatingTag] = useState(false);

  // Preset colors for tags
  const PRESET_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
    '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
    '#8B5CF6', '#A855F7', '#C026D3', '#DB2777', '#E11D48', '#6B7280'
  ];

  // Column visibility dropdown state
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);

  // Side panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Create task dialog state
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [taskContact, setTaskContact] = useState<Contact | null>(null);
  const [openTaskCalendar, setOpenTaskCalendar] = useState(false);
  const [newTask, setNewTask] = useState({
    taskType: '',
    subject: '',
    description: '',
    dueDate: undefined as Date | undefined,
    priority: 'low' as 'low' | 'medium' | 'high',
  });
  const [savedTaskTypes, setSavedTaskTypes] = useState<string[]>([]);

  // Create deal dialog state
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [dealContact, setDealContact] = useState<Contact | null>(null);
  const [newDeal, setNewDeal] = useState({
    name: '',
    value: '',
    stage: 'lead',
    probability: '50',
    expectedCloseDate: undefined as Date | undefined,
    notes: '',
  });
  const [openDealCalendar, setOpenDealCalendar] = useState(false);
  const [dealStages, setDealStages] = useState([
    { id: 'lead', name: 'Lead', color: '#9CA3AF' },
    { id: 'qualified', name: 'Qualified', color: '#3B82F6' },
    { id: 'proposal', name: 'Proposal', color: '#8B5CF6' },
    { id: 'negotiation', name: 'Negotiation', color: '#F59E0B' },
    { id: 'won', name: 'Won', color: '#10B981' },
    { id: 'lost', name: 'Lost', color: '#EF4444' },
  ]);

  // Available phone numbers for calling
  const [availablePhoneNumbers, setAvailablePhoneNumbers] = useState<{phoneNumber: string, friendlyName?: string}[]>([]);

  // Fetch available phone numbers on mount
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const res = await fetch('/api/telnyx/phone-numbers');
        if (res.ok) {
          const data = await res.json();
          const numbers = Array.isArray(data) ? data : data.phoneNumbers || [];
          setAvailablePhoneNumbers(numbers.filter((n: any) => n.isActive));
        }
      } catch (error) {
        console.error('Failed to fetch phone numbers:', error);
      }
    };
    fetchPhoneNumbers();
  }, []);

  // Handle initiating a call via WebRTC
  const handleInitiateCall = async (contact: Contact) => {
    const phoneNumber = contact.phone1 || contact.phone2 || contact.phone3;
    if (!phoneNumber) {
      toast.error('No phone number available for this contact');
      return;
    }
    if (availablePhoneNumbers.length === 0) {
      toast.error('No phone numbers available. Please configure Telnyx numbers.');
      return;
    }
    const fromNumber = availablePhoneNumbers[0].phoneNumber;

    try {
      // Use WebRTC to make the call
      const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils');
      const toNumber = formatPhoneNumberForTelnyx(phoneNumber) || phoneNumber;

      // Get WebRTC client
      const { rtcClient } = await import('@/lib/webrtc/rtc-client');
      await rtcClient.ensureRegistered();
      const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber });

      // Log the call to database
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          contactId: contact.id,
          fromNumber,
          toNumber,
        })
      }).catch(err => console.error('Failed to log call:', err));

      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber,
        toNumber,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
      });

      toast.success(`Calling ${contact.firstName} ${contact.lastName}`);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      toast.error(error.message || 'Failed to initiate call');
    }
  };

  // Handle opening SMS panel
  const handleOpenSms = (contact: Contact) => {
    const phoneNumber = contact.phone1 || contact.phone2 || contact.phone3;
    if (!phoneNumber) {
      toast.error('No phone number available for this contact');
      return;
    }
    openSms({
      contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
      phoneNumber,
    });
  };

  // Handle opening email panel
  const handleOpenEmail = (contact: Contact) => {
    const email = contact.email1 || contact.email;
    if (!email) {
      toast.error('No email address available for this contact');
      return;
    }
    openEmail({
      contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, email1: email, propertyAddress: contact.propertyAddress, city: contact.city, state: contact.state },
      email,
    });
  };

  // Fetch contacts with caching
  useEffect(() => {
    // Check if we have cached data from the last 30 seconds
    const cachedData = sessionStorage.getItem('contacts_cache');
    const cacheTimestamp = sessionStorage.getItem('contacts_cache_timestamp');
    const now = Date.now();

    if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 30000) {
      // Use cached data if less than 30 seconds old
      setContacts(JSON.parse(cachedData));
      setLoading(false);
    } else {
      // Fetch fresh data
      fetchContacts();
    }

    fetchFieldDefinitions();
    fetchTags();
    loadSavedViews();
    fetchTaskTypes();
  }, []);

  const fetchTaskTypes = async () => {
    try {
      const response = await fetch('/api/settings/task-types');
      if (response.ok) {
        const data = await response.json();
        setSavedTaskTypes(data.taskTypes || []);
      }
    } catch (error) {
      console.error('Error fetching task types:', error);
    }
  };

  const fetchContacts = async (forceRefresh = false, filters: Record<string, string> = {}) => {
    try {
      setLoading(true);

      // Build query string with filters
      const params = new URLSearchParams({ limit: '10000' });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/contacts?${params.toString()}`, {
        cache: forceRefresh ? 'no-store' : 'force-cache',
        next: { revalidate: 30 }
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      const contactsData = data.contacts || [];
      setContacts(contactsData);

      // Only cache if no filters applied
      if (Object.keys(filters).length === 0) {
        sessionStorage.setItem('contacts_cache', JSON.stringify(contactsData));
        sessionStorage.setItem('contacts_cache_timestamp', Date.now().toString());
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    // Clear cache and refresh
    sessionStorage.removeItem('contacts_cache');
    sessionStorage.removeItem('contacts_cache_timestamp');
    fetchContacts(true);
  };

  const fetchFieldDefinitions = async () => {
    try {
      const response = await fetch('/api/fields');
      if (!response.ok) throw new Error('Failed to fetch fields');
      const data = await response.json();
      setFieldDefinitions(data.fields || []);
    } catch (error) {
      console.error('Error fetching field definitions:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setAvailableTags([]);
    }
  };

  const loadSavedViews = () => {
    const saved = localStorage.getItem('contactsGridViews');
    if (saved) {
      setSavedViews(JSON.parse(saved));
    }

    // Load default view
    const savedDefault = localStorage.getItem('contactsGridDefaultView');
    if (savedDefault) {
      setDefaultView(savedDefault);
      // Auto-load default view on mount
      const views = saved ? JSON.parse(saved) : [];
      const defaultViewData = views.find((v: any) => v.name === savedDefault);
      if (defaultViewData) {
        setColumnVisibility(defaultViewData.columnVisibility || {});
        setColumnSizing(defaultViewData.columnSizing || {});
        setColumnFilters(defaultViewData.columnFilters || []);
        setSorting(defaultViewData.sorting || []);
        setColumnOrder(defaultViewData.columnOrder || []);
        setCurrentView(savedDefault);
      }
    }
  };

  const saveCurrentView = (viewName: string) => {
    const view = {
      name: viewName,
      columnVisibility,
      columnSizing,
      columnFilters,
      sorting,
      columnOrder,
    };
    const updated = [...savedViews.filter(v => v.name !== viewName), view];
    setSavedViews(updated);
    localStorage.setItem('contactsGridViews', JSON.stringify(updated));
    setCurrentView(viewName);
    toast.success(`View "${viewName}" saved`);
  };

  const loadView = (viewName: string) => {
    const view = savedViews.find(v => v.name === viewName);
    if (view) {
      setColumnVisibility(view.columnVisibility || {});
      setColumnSizing(view.columnSizing || {});
      setColumnFilters(view.columnFilters || []);
      setSorting(view.sorting || []);
      setColumnOrder(view.columnOrder || []);
      setCurrentView(viewName);
      toast.success(`View "${viewName}" loaded`);
    }
  };

  const deleteView = (viewName: string) => {
    const updated = savedViews.filter(v => v.name !== viewName);
    setSavedViews(updated);
    localStorage.setItem('contactsGridViews', JSON.stringify(updated));
    if (currentView === viewName) setCurrentView('default');
    if (defaultView === viewName) {
      setDefaultView('default');
      localStorage.setItem('contactsGridDefaultView', 'default');
    }
    toast.success(`View "${viewName}" deleted`);
  };

  const setAsDefaultView = (viewName: string) => {
    setDefaultView(viewName);
    localStorage.setItem('contactsGridDefaultView', viewName);
    toast.success(`"${viewName}" set as default view`);
  };

  // Bulk delete handler
  const handleBulkDelete = async (e?: React.MouseEvent) => {
    // Prevent dialog from closing immediately
    if (e) {
      e.preventDefault();
    }

    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error('No contacts selected');
      setShowDeleteDialog(false);
      return;
    }

    setDeleting(true);
    try {
      const contactIds = selectedRows.map(row => row.original.id);

      console.log('Deleting contacts:', contactIds);

      const response = await fetch('/api/contacts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete contacts');
      }

      const result = await response.json();
      console.log('Delete result:', result);

      // Immediately update local state to remove deleted contacts
      setContacts(prev => prev.filter(contact => !contactIds.includes(contact.id)));

      // Clear selection and close dialog
      setRowSelection({});
      setShowDeleteDialog(false);
      setDeleting(false);

      toast.success(`Deleted ${result.deleted} contacts successfully!`);

      // Refresh data in background to ensure sync
      fetchContacts();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete contacts');
      setShowDeleteDialog(false);
      setDeleting(false);
    }
  };

  // Select all contacts (not just current page)
  const handleSelectAll = () => {
    const allRowIds = table.getFilteredRowModel().rows.reduce((acc, row) => {
      acc[row.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setRowSelection(allRowIds);
  };

  // Deselect all contacts
  const handleDeselectAll = () => {
    setRowSelection({});
  };

  // Create task for contact
  const handleCreateTask = async () => {
    if (!taskContact) {
      toast.error('No contact selected');
      return;
    }

    if (!newTask.subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: taskContact.id,
          taskType: newTask.taskType || 'General',
          subject: newTask.subject,
          description: newTask.description,
          dueDate: newTask.dueDate?.toISOString(),
          priority: newTask.priority,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }

      toast.success(`Task created for ${taskContact.firstName} ${taskContact.lastName}`);
      setShowCreateTaskDialog(false);
      setTaskContact(null);
      setNewTask({
        taskType: '',
        subject: '',
        description: '',
        dueDate: undefined,
        priority: 'low',
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    }
  };

  // Create deal for contact
  const handleCreateDeal = async () => {
    if (!dealContact) {
      toast.error('No contact selected');
      return;
    }

    if (!newDeal.name.trim()) {
      toast.error('Please enter a deal name');
      return;
    }

    if (!newDeal.value.trim()) {
      toast.error('Please enter a deal value');
      return;
    }

    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: dealContact.id,
          name: newDeal.name,
          value: parseFloat(newDeal.value),
          stage: newDeal.stage,
          probability: parseInt(newDeal.probability),
          expected_close_date: newDeal.expectedCloseDate?.toISOString(),
          notes: newDeal.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create deal');
      }

      toast.success(`Deal created for ${dealContact.firstName} ${dealContact.lastName}`);
      setShowCreateDealDialog(false);
      setDealContact(null);
      setNewDeal({
        name: '',
        value: '',
        stage: 'lead',
        probability: '50',
        expectedCloseDate: undefined,
        notes: '',
      });
      fetchContacts(true); // Refresh to show new deal
    } catch (error) {
      console.error('Error creating deal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create deal');
    }
  };

  // Bulk tag assignment handler
  const handleBulkTagAssignment = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error('No contacts selected');
      return;
    }

    if (bulkTagIds.length === 0) {
      toast.error('Please select at least one tag');
      return;
    }

    setAssigningTags(true);
    try {
      const contactIds = selectedRows.map(row => row.original.id);

      const response = await fetch('/api/contacts/bulk-assign-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds, tagIds: bulkTagIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign tags');
      }

      toast.success(`Tags assigned to ${selectedRows.length} contacts`);
      setShowBulkTagDialog(false);
      setBulkTagIds([]);
      setNewTagName('');
      setNewTagColor('#3b82f6');
      onRefresh();
    } catch (error) {
      console.error('Bulk tag assignment error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign tags');
    } finally {
      setAssigningTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    setCreatingTag(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tag');
      }

      const newTag = await response.json();
      toast.success(`Tag "${newTagName}" created`);

      // Refresh tags list
      await fetchTags();

      // Auto-select the new tag
      setBulkTagIds(prev => [...prev, newTag.id]);

      // Clear form
      setNewTagName('');
      setNewTagColor('#3b82f6');
    } catch (error) {
      console.error('Create tag error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  };

  // Export selected contacts to CSV
  const handleExportSelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error('No contacts selected');
      return;
    }

    try {
      // Get all visible columns
      const visibleColumns = table.getAllColumns().filter(col => col.getIsVisible() && col.id !== 'select');

      // Create CSV header
      const headers = visibleColumns.map(col => col.id).join(',');

      // Create CSV rows
      const rows = selectedRows.map(row => {
        return visibleColumns.map(col => {
          const value = row.getValue(col.id);
          // Handle special cases
          if (col.id === 'tags') {
            const tags = row.original.tags || [];
            return `"${tags.map((t: any) => t.name).join(', ')}"`;
          }
          // Escape commas and quotes in values
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',');
      }).join('\n');

      // Combine header and rows
      const csv = `${headers}\n${rows}`;

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${selectedRows.length} contacts`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export contacts');
    }
  };

  // Column display names mapping for Toggle Columns dropdown
  const columnDisplayNames: Record<string, string> = {
    select: 'Select',
    fullName: 'Full Name',
    firstName: 'First Name',
    lastName: 'Last Name',
    phone1: 'Phone',
    email: 'Email',
    propertyAddress: 'Property Address',
    city: 'City',
    state: 'State',
    zipCode: 'Zip Code',
    propertyType: 'Property Type',
    propertyValue: 'Property Value',
    estValue: 'Est. Value',
    estEquity: 'Est. Equity',
    bedrooms: 'Beds',
    totalBathrooms: 'Baths',
    buildingSqft: 'Sqft',
    effectiveYearBuilt: 'Year Built',
    units: 'Units',
    lotSizeSqft: 'Lot Size Sqft',
    lastSaleDate: 'Last Sale Date',
    lastSaleAmount: 'Last Sale Amount',
    estRemainingBalance: 'Est. Remaining Balance',
    llcName: 'LLC Name',
    propertyCount: 'Properties',
    propertyCounty: 'County',
    contactAddress: 'Contact Address',
    contactCityStateZip: 'Contact City, State, Zip',
    tags: 'Tags',
    tasks: 'Tasks',
    deals: 'Deals',
    actions: 'Actions',
  };

  // Define columns dynamically based on field definitions
  const columns = useMemo<ColumnDef<Contact>[]>(() => {
    const baseColumns: ColumnDef<Contact>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
      },
      {
        accessorKey: 'fullName',
        header: 'Full Name',
        cell: ({ row }) => (
          <div
            className="font-medium cursor-pointer hover:text-primary hover:underline"
            onClick={() => {
              setSelectedContact(row.original);
              setSidePanelOpen(true);
            }}
          >
            {row.getValue('fullName') || `${row.original.firstName || ''} ${row.original.lastName || ''}`.trim()}
          </div>
        ),
        size: 140,
        minSize: 100,
        maxSize: 200,
      },
      {
        accessorKey: 'firstName',
        header: 'First Name',
        cell: ({ row }) => (
          <div
            className="cursor-pointer hover:text-primary"
            onClick={() => onContactSelect?.(row.original)}
          >
            {row.getValue('firstName')}
          </div>
        ),
        size: 120,
        minSize: 80,
        maxSize: 200,
      },
      {
        accessorKey: 'lastName',
        header: 'Last Name',
        cell: ({ row }) => (
          <div
            className="cursor-pointer hover:text-primary"
            onClick={() => onContactSelect?.(row.original)}
          >
            {row.getValue('lastName')}
          </div>
        ),
        size: 120,
        minSize: 80,
        maxSize: 200,
      },
      {
        accessorKey: 'phone1',
        header: 'Phone',
        cell: ({ row }) => formatPhoneNumber(row.original.phone1),
        size: 180,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        size: 200,
      },
      {
        accessorKey: 'propertyAddress',
        header: 'Property Address',
        size: 250,
      },
      {
        accessorKey: 'propertyCount',
        header: 'Properties',
        cell: ({ row }) => {
          const count = row.original.propertyCount || 0;
          if (count <= 1) {
            return <span className="text-gray-500 text-xs">1</span>;
          }
          return (
            <div className="flex items-center gap-1">
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs px-1.5 py-0"
              >
                {count} properties
              </Badge>
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'city',
        header: 'City',
        size: 150,
      },
      {
        accessorKey: 'state',
        header: 'State',
        size: 100,
      },
      {
        accessorKey: 'zipCode',
        header: 'Zip Code',
        size: 100,
      },
      {
        accessorKey: 'propertyType',
        header: 'Property Type',
        cell: ({ row }) => {
          const propertyType = row.getValue('propertyType') as string;
          const propertyTypes = [
            "Single-family (SFR)",
            "Duplex",
            "Triplex",
            "Quadplex",
            "Multifamily (5+ units)",
            "Townhouse",
            "Condominium (Condo)",
          ];

          return (
            <div onClick={(e) => e.stopPropagation()} className="relative">
              <Select
                value={propertyType || ''}
                onValueChange={async (value) => {
                  try {
                    const response = await fetch(`/api/contacts/${row.original.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ propertyType: value }),
                    });
                    if (response.ok) {
                      toast.success('Property type updated');
                      fetchContacts();
                    } else {
                      const error = await response.json();
                      toast.error(error.error || 'Failed to update property type');
                    }
                  } catch (error) {
                    toast.error('Failed to update property type');
                  }
                }}
              >
                <SelectTrigger className="h-6 text-xs border-0 hover:bg-gray-100 w-full">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  className="z-[9999] max-h-[300px] overflow-y-auto"
                >
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs cursor-pointer">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: 'propertyValue',
        header: 'Property Value',
        cell: ({ row }) => {
          const value = row.getValue('propertyValue') as number;
          return value ? `$${value.toLocaleString()}` : '';
        },
        filterFn: numberRangeFilter,
        size: 150,
        meta: { filterType: 'number', isCurrency: true },
      },
      {
        accessorKey: 'estValue',
        header: 'Est. Value',
        cell: ({ row }) => {
          const value = row.original.estValue as number;
          return value ? `$${Number(value).toLocaleString()}` : '';
        },
        filterFn: numberRangeFilter,
        size: 150,
        meta: { filterType: 'number', isCurrency: true },
      },
      {
        accessorKey: 'estEquity',
        header: 'Est. Equity',
        cell: ({ row }) => {
          const value = row.original.estEquity as number;
          return value ? `$${Number(value).toLocaleString()}` : '';
        },
        filterFn: numberRangeFilter,
        size: 150,
        meta: { filterType: 'number', isCurrency: true },
      },
      {
        accessorKey: 'bedrooms',
        header: 'Beds',
        filterFn: numberRangeFilter,
        size: 80,
        meta: { filterType: 'number' },
      },
      {
        accessorKey: 'totalBathrooms',
        header: 'Baths',
        cell: ({ row }) => {
          const value = row.original.totalBathrooms;
          return value ? Number(value).toFixed(1) : '';
        },
        filterFn: numberRangeFilter,
        size: 80,
        meta: { filterType: 'number' },
      },
      {
        accessorKey: 'buildingSqft',
        header: 'Sqft',
        cell: ({ row }) => {
          const value = row.original.buildingSqft as number;
          return value ? value.toLocaleString() : '';
        },
        filterFn: numberRangeFilter,
        size: 100,
        meta: { filterType: 'number' },
      },
      {
        accessorKey: 'effectiveYearBuilt',
        header: 'Year Built',
        filterFn: numberRangeFilter,
        size: 100,
        meta: { filterType: 'number' },
      },
      {
        accessorKey: 'units',
        header: 'Units',
        filterFn: numberRangeFilter,
        size: 80,
        meta: { filterType: 'number' },
      },
      {
        accessorKey: 'lotSizeSqft',
        header: 'Lot Size Sqft',
        cell: ({ row }) => {
          const value = row.original.lotSizeSqft as number;
          return value ? value.toLocaleString() : '';
        },
        filterFn: numberRangeFilter,
        size: 120,
        meta: { filterType: 'number' },
      },
      {
        accessorKey: 'lastSaleDate',
        header: 'Last Sale Date',
        cell: ({ row }) => {
          const value = row.original.lastSaleDate;
          return value ? new Date(value).toLocaleDateString() : '';
        },
        size: 120,
      },
      {
        accessorKey: 'lastSaleAmount',
        header: 'Last Sale Amount',
        cell: ({ row }) => {
          const value = row.original.lastSaleAmount as number;
          return value ? `$${Number(value).toLocaleString()}` : '';
        },
        filterFn: numberRangeFilter,
        size: 150,
        meta: { filterType: 'number', isCurrency: true },
      },
      {
        accessorKey: 'estRemainingBalance',
        header: 'Est. Remaining Balance',
        cell: ({ row }) => {
          const value = row.original.estRemainingBalance as number;
          return value ? `$${Number(value).toLocaleString()}` : '';
        },
        filterFn: numberRangeFilter,
        size: 180,
        meta: { filterType: 'number', isCurrency: true },
      },
      {
        accessorKey: 'llcName',
        header: 'LLC Name',
        size: 180,
      },
      {
        accessorKey: 'propertyCounty',
        header: 'County',
        size: 120,
      },
      {
        accessorKey: 'contactAddress',
        header: 'Contact Address',
        size: 250,
      },
      {
        accessorKey: 'contactCityStateZip',
        header: 'Contact City, State, Zip',
        size: 200,
      },
      {
        id: 'tags',
        header: 'Tags',
        accessorFn: (row: any) => row.tags,
        cell: ({ row }) => {
          const tags = row.original.tags || [];
          const [showTagSelect, setShowTagSelect] = React.useState(false);
          const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(
            tags.map((t: any) => t.id)
          );

          const handleTagToggle = async (tagId: string, checked: boolean) => {
            try {
              const newSelectedIds = checked
                ? [...selectedTagIds, tagId]
                : selectedTagIds.filter(id => id !== tagId);

              setSelectedTagIds(newSelectedIds);

              const selectedTags = availableTags.filter(t => newSelectedIds.includes(t.id));
              const response = await fetch(`/api/contacts/${row.original.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tags: selectedTags.map(t => ({ id: t.id, name: t.name, color: t.color }))
                }),
              });
              if (response.ok) {
                toast.success('Tag updated');
                fetchContacts();
              }
            } catch (error) {
              toast.error('Failed to update tag');
            }
          };

          return (
            <div className="relative">
              <div
                className="flex flex-wrap gap-1 cursor-pointer hover:bg-gray-50 p-1 rounded"
                onClick={() => setShowTagSelect(!showTagSelect)}
              >
                {tags.slice(0, 2).map((tag: any) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      borderColor: tag.color,
                      color: tag.color
                    }}
                    className="text-xs"
                  >
                    {tag.name}
                  </Badge>
                ))}
                {tags.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{tags.length - 2}
                  </Badge>
                )}
                {tags.length === 0 && (
                  <span className="text-xs text-gray-400">Add tags...</span>
                )}
              </div>

              {showTagSelect && (
                <div
                  className="absolute z-50 mt-1 w-64 bg-white border rounded-lg shadow-lg p-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Select Tags</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTagSelect(false);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableTags.map((tag: any) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={(checked) => {
                            handleTagToggle(tag.id, !!checked);
                          }}
                        />
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            borderColor: tag.color,
                            color: tag.color
                          }}
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t text-xs text-gray-500 text-center">
                    Click tags to add/remove instantly
                  </div>
                </div>
              )}
            </div>
          );
        },
        filterFn: tagsFilter,
        size: 200,
        meta: { filterType: 'tags' },
      },
      {
        id: 'tasks',
        header: 'Tasks',
        accessorFn: (row: any) => row.activities,
        cell: ({ row }) => {
          const activities = row.original.activities || [];
          const tasks = activities.filter((a: any) => a.type === 'task' && a.status !== 'completed');

          if (tasks.length === 0) {
            return (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-gray-400 hover:text-gray-900"
                onClick={(e) => {
                  e.stopPropagation();
                  setTaskContact(row.original);
                  setShowCreateTaskDialog(true);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Task
              </Button>
            );
          }

          // Sort tasks by due date (earliest first)
          const sortedTasks = [...tasks].sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          });

          const latestTask = sortedTasks[0];
          const dueDate = latestTask.dueDate ? new Date(latestTask.dueDate) : null;
          const isOverdue = dueDate && dueDate < new Date();
          const isToday = dueDate && dueDate.toDateString() === new Date().toDateString();

          const otherTasks = sortedTasks.slice(1);
          const tooltipContent = otherTasks.map((task: any) => {
            const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
            const dateStr = taskDueDate ? taskDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
            return `${task.subject || task.title} - Due: ${dateStr}`;
          }).join('\n');

          return (
            <div className="flex items-center justify-between gap-2 group">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate" title={latestTask.subject || latestTask.title}>
                  {latestTask.subject || latestTask.title}
                </div>
                {dueDate && (
                  <div className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : isToday ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                    Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
                {tasks.length > 1 && (
                  <Badge
                    variant="secondary"
                    className="text-xs cursor-help"
                    title={tooltipContent}
                  >
                    +{tasks.length - 1} more
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setTaskContact(row.original);
                  setShowCreateTaskDialog(true);
                }}
                title="Add Task"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          );
        },
        size: 200,
        enableSorting: true,
        enableResizing: true,
        sortingFn: (rowA, rowB) => {
          const tasksA = rowA.original.activities?.filter((a: any) => a.type === 'task' && a.status !== 'completed') || [];
          const tasksB = rowB.original.activities?.filter((a: any) => a.type === 'task' && a.status !== 'completed') || [];

          if (tasksA.length === 0 && tasksB.length === 0) return 0;
          if (tasksA.length === 0) return 1;
          if (tasksB.length === 0) return -1;

          const dueDateA = tasksA[0]?.dueDate ? new Date(tasksA[0].dueDate).getTime() : Infinity;
          const dueDateB = tasksB[0]?.dueDate ? new Date(tasksB[0].dueDate).getTime() : Infinity;

          return dueDateA - dueDateB;
        },
      },
      {
        id: 'deals',
        header: 'Deals',
        accessorFn: (row: any) => row.deals,
        cell: ({ row }) => {
          const deals = row.original.deals || [];

          if (deals.length === 0) {
            return (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-gray-400 hover:text-gray-900"
                onClick={(e) => {
                  e.stopPropagation();
                  setDealContact(row.original);
                  setShowCreateDealDialog(true);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Deal
              </Button>
            );
          }

          // Sort deals by value (highest first)
          const sortedDeals = [...deals].sort((a, b) => {
            return (b.value || 0) - (a.value || 0);
          });

          const topDeal = sortedDeals[0];
          const stage = dealStages.find(s => s.id === topDeal.stage) || dealStages[0];

          const otherDeals = sortedDeals.slice(1);
          const tooltipContent = otherDeals.map((deal: any) => {
            const dealStage = dealStages.find(s => s.id === deal.stage) || dealStages[0];
            const value = deal.value ? `$${Number(deal.value).toLocaleString()}` : '$0';
            return `${deal.name} - ${dealStage.name} - ${value}`;
          }).join('\n');

          return (
            <div className="flex items-center justify-between gap-2 group">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate" title={topDeal.name}>
                  {topDeal.name}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      backgroundColor: `${stage.color}20`,
                      borderColor: stage.color,
                      color: stage.color
                    }}
                  >
                    {stage.name}
                  </Badge>
                  <span className="text-xs text-gray-600">
                    ${Number(topDeal.value || 0).toLocaleString()}
                  </span>
                </div>
                {deals.length > 1 && (
                  <Badge
                    variant="secondary"
                    className="text-xs cursor-help"
                    title={tooltipContent}
                  >
                    +{deals.length - 1} more
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setDealContact(row.original);
                  setShowCreateDealDialog(true);
                }}
                title="Add Deal"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          );
        },
        size: 220,
        enableSorting: true,
        enableResizing: true,
        sortingFn: (rowA, rowB) => {
          const dealsA = rowA.original.deals || [];
          const dealsB = rowB.original.deals || [];

          if (dealsA.length === 0 && dealsB.length === 0) return 0;
          if (dealsA.length === 0) return 1;
          if (dealsB.length === 0) return -1;

          const valueA = Math.max(...dealsA.map((d: any) => d.value || 0));
          const valueB = Math.max(...dealsB.map((d: any) => d.value || 0));

          return valueB - valueA;
        },
      },
    ];

    // Add custom fields as columns
    fieldDefinitions.forEach((field) => {
      if (!field.isSystem && field.isActive) {
        baseColumns.push({
          accessorFn: (row: any) => row.customFields?.[field.fieldKey],
          id: field.fieldKey,
          header: field.name,
          cell: ({ getValue }) => {
            const value = getValue();
            if (!value) return '';

            // Format based on field type
            if (field.fieldType === 'currency') {
              return `$${parseFloat(value).toLocaleString()}`;
            } else if (field.fieldType === 'date') {
              return new Date(value).toLocaleDateString();
            } else if (field.fieldType === 'boolean') {
              return value ? '✓' : '';
            }
            return value;
          },
          size: 150,
        });
      }
    });

    // Add Actions column
    baseColumns.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={(e) => {
              e.stopPropagation();
              handleInitiateCall(row.original);
            }}
            title="Call (WebRTC)"
            disabled={!row.original.phone1 && !row.original.phone2 && !row.original.phone3}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenSms(row.original);
            }}
            title="Send SMS"
            disabled={!row.original.phone1 && !row.original.phone2 && !row.original.phone3}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEmail(row.original);
            }}
            title="Send Email"
            disabled={!row.original.email}
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setTaskContact(row.original);
              setShowCreateTaskDialog(true);
            }}
            title="Create Task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: true,
      size: 180,
    });

    return baseColumns;
  }, [fieldDefinitions, onContactSelect, handleInitiateCall, handleOpenSms, handleOpenEmail]);



  const table = useReactTable({
    data: contacts,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnSizing,
      columnOrder,
    },
    filterFns: {
      numberRange: numberRangeFilter,
      tags: tagsFilter,
    },
    globalFilterFn: globalFilterFn,
    getRowId: (row) => row.id, // Use contact ID as row ID for proper selection
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange', // Real-time resize feedback as you drag
    columnResizeDirection: 'ltr', // Only resize the column being dragged, not others
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    );
  }

  const selectedCount = Object.keys(rowSelection).length;
  const totalFilteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-4">
      {/* Selection Bar - shows when contacts are selected */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="font-medium text-primary">
              {selectedCount} / {totalFilteredCount} contacts selected
            </span>
            {selectedCount < totalFilteredCount && (
              <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={handleSelectAll}>
                Select all {totalFilteredCount}
              </Button>
            )}
            <Button variant="link" size="sm" className="text-muted-foreground p-0 h-auto" onClick={handleDeselectAll}>
              Clear selection
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkTagDialog(true)}
            >
              <Tag className="h-4 w-4 mr-2" />
              Assign Tags ({selectedCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selected ({selectedCount})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Selected ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {/* Smart Filter Panel */}
      {showFilters && (
        <SmartFilterPanel
          filterOptions={filterOptions}
          currentFilters={activeFilters}
          onFiltersChange={async (filters) => {
            setActiveFilters(filters);
            await fetchContacts(true, filters);
          }}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search and Select All */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          {/* Toggle Filters Button */}
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="whitespace-nowrap"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
          </Button>

          {/* Select All Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={selectedCount === totalFilteredCount ? handleDeselectAll : handleSelectAll}
            className="whitespace-nowrap"
          >
            {selectedCount === totalFilteredCount ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Deselect
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </>
            )}
          </Button>

          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Add Contact Button */}
          <Button
            variant="default"
            size="sm"
            onClick={onAddContact}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>

          {/* Column Visibility */}
          <DropdownMenu open={columnDropdownOpen} onOpenChange={setColumnDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Toggle Columns</DropdownMenuLabel>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => setColumnDropdownOpen(false)}
                >
                  Done
                </Button>
              </div>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {columnDisplayNames[column.id] || column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save/Load Views */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const name = prompt('Enter view name:');
                    if (name) saveCurrentView(name);
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Current View
                </Button>
              </div>
              {savedViews.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">My Views</DropdownMenuLabel>
                  {savedViews.map((view) => (
                    <div key={view.name} className="space-y-1">
                      <div className="flex items-center justify-between px-2 py-1 hover:bg-muted rounded">
                        <button
                          className={`flex-1 text-left text-sm px-2 py-1 rounded ${
                            currentView === view.name
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => loadView(view.name)}
                        >
                          {currentView === view.name && '✓ '}
                          {view.name}
                          {defaultView === view.name && ' (Default)'}
                        </button>
                        <button
                          className="text-destructive hover:text-destructive/80 px-2"
                          onClick={() => deleteView(view.name)}
                        >
                          ×
                        </button>
                      </div>
                      {defaultView !== view.name && (
                        <button
                          className="w-full text-xs text-left px-4 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          onClick={() => setAsDefaultView(view.name)}
                        >
                          Set as Default
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>



      {/* Selected rows info */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            {Object.keys(rowSelection).length} row(s) selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRowSelection({})}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Data Grid - with scrollable container */}
      <div className="rounded-md border overflow-auto max-h-[calc(100vh-350px)] min-h-[400px]" style={{ overflowX: 'auto', overflowY: 'auto' }}>
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`border-r border-b px-1.5 py-1 text-left text-xs font-medium relative group ${
                      draggedColumn === header.id ? 'opacity-50 bg-primary/20' : ''
                    }`}
                    style={{
                      width: header.getSize(),
                      minWidth: header.column.columnDef.minSize,
                      maxWidth: header.column.columnDef.maxSize,
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId === header.id) return;

                      const currentOrder = columnOrder.length > 0
                        ? columnOrder
                        : table.getAllLeafColumns().map(c => c.id);

                      const draggedIndex = currentOrder.indexOf(draggedId);
                      const targetIndex = currentOrder.indexOf(header.id);

                      if (draggedIndex === -1 || targetIndex === -1) return;

                      const newOrder = [...currentOrder];
                      newOrder.splice(draggedIndex, 1);
                      newOrder.splice(targetIndex, 0, draggedId);

                      setColumnOrder(newOrder);
                      setDraggedColumn(null);
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {header.id !== 'select' && (
                            <div
                              draggable
                              onDragStart={(e) => {
                                setDraggedColumn(header.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', header.id);
                                e.stopPropagation();
                              }}
                              onDragEnd={() => {
                                setDraggedColumn(null);
                              }}
                              className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-100 rounded"
                              title="Drag to reorder column"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100" />
                            </div>
                          )}
                          <div
                            className={`flex items-center gap-2 ${
                              header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-muted-foreground">
                                {{
                                  asc: <ChevronUp className="h-4 w-4" />,
                                  desc: <ChevronDown className="h-4 w-4" />,
                                }[header.column.getIsSorted() as string] ?? (
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                    {/* Resize Handle - Excel-like column resizer */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => {
                          // Auto-fit column width on double-click (like Excel)
                          const optimalWidth = autoFitColumn(header.column, contacts, 80, 600);
                          setColumnSizing((prev) => ({
                            ...prev,
                            [header.column.id]: optimalWidth,
                          }));
                        }}
                        className={`absolute right-0 top-0 h-full cursor-col-resize select-none touch-none group/resize z-10 ${
                          header.column.getIsResizing() ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-400'
                        }`}
                        style={{
                          // Make the clickable area wider for easier grabbing
                          width: header.column.getIsResizing() ? '3px' : '8px',
                          marginRight: header.column.getIsResizing() ? '0' : '-4px',
                        }}
                        title="Drag to resize, double-click to auto-fit"
                      >
                        {/* Visual indicator on hover */}
                        <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover/resize:opacity-50 transition-opacity" />
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No contacts found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-muted/50 ${
                    row.getIsSelected() ? 'bg-muted' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-r border-b px-1.5 py-1 text-xs"
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.columnDef.minSize,
                        maxWidth: cell.column.columnDef.maxSize,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} contacts
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected contacts
              and all associated data (tags, activities, call history, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedCount} contacts
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Tag Assignment Dialog */}
      <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tags to {selectedCount} Contacts</DialogTitle>
            <DialogDescription>
              Select tags to assign to the selected contacts. These tags will be added to any existing tags.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Tags</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-background min-h-[100px]">
                {!Array.isArray(availableTags) || availableTags.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No tags available. Create tags first.</span>
                ) : (
                  availableTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={bulkTagIds.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={bulkTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                      onClick={() => {
                        setBulkTagIds(prev =>
                          prev.includes(tag.id)
                            ? prev.filter(t => t !== tag.id)
                            : [...prev, tag.id]
                        );
                      }}
                    >
                      {tag.name}
                      {bulkTagIds.includes(tag.id) && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {bulkTagIds.length} tag(s) selected
              </p>
            </div>

            {/* Create New Tag Section */}
            <div className="space-y-3 pt-4 border-t">
              <Label>Create New Tag</Label>
              <div className="space-y-3">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                  disabled={creatingTag}
                />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Select Color</Label>
                  <div className="grid grid-cols-9 gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          newTagColor === color ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewTagColor(color)}
                        disabled={creatingTag}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleCreateTag}
                  disabled={creatingTag || !newTagName.trim()}
                  size="sm"
                  className="w-full"
                >
                  {creatingTag ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Tag
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkTagDialog(false);
                setBulkTagIds([]);
              }}
              disabled={assigningTags}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkTagAssignment}
              disabled={assigningTags || bulkTagIds.length === 0}
            >
              {assigningTags ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Tag className="h-4 w-4 mr-2" />
                  Assign Tags
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription className="space-y-1">
              <div>Create a new task for {taskContact?.firstName} {taskContact?.lastName}</div>
              {taskContact?.phone1 && (
                <div className="text-xs text-muted-foreground">
                  📞 {formatPhoneNumber(taskContact.phone1)}
                </div>
              )}
              {taskContact?.email && (
                <div className="text-xs text-muted-foreground">
                  📧 {taskContact.email}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Task Type */}
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={newTask.taskType}
                onValueChange={(value) => setNewTask({ ...newTask, taskType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  {savedTaskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Enter task subject..."
                value={newTask.subject}
                onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter task description..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Due Date and Priority - Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover modal={true} open={openTaskCalendar} onOpenChange={setOpenTaskCalendar}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !newTask.dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTask.dueDate ? format(newTask.dueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[10000]" align="start" sideOffset={5} side="bottom">
                    <Calendar
                      mode="single"
                      selected={newTask.dueDate}
                      onSelect={(date) => {
                        setNewTask({ ...newTask, dueDate: date });
                        setOpenTaskCalendar(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high') =>
                    setNewTask({ ...newTask, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">⚪ Low</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="high">🔴 High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateTaskDialog(false);
                setTaskContact(null);
                setNewTask({
                  taskType: '',
                  subject: '',
                  description: '',
                  dueDate: undefined,
                  priority: 'low',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog open={showCreateDealDialog} onOpenChange={setShowCreateDealDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Deal</DialogTitle>
            <DialogDescription className="space-y-1">
              <div>Create a new deal for {dealContact?.firstName} {dealContact?.lastName}</div>
              {dealContact?.phone1 && (
                <div className="text-xs text-muted-foreground">
                  📞 {formatPhoneNumber(dealContact.phone1)}
                </div>
              )}
              {dealContact?.email && (
                <div className="text-xs text-muted-foreground">
                  📧 {dealContact.email}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Deal Name */}
            <div className="space-y-2">
              <Label>Deal Name *</Label>
              <Input
                placeholder="Enter deal name..."
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
              />
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label>Deal Value *</Label>
              <Input
                type="number"
                placeholder="Enter deal value..."
                value={newDeal.value}
                onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
              />
            </div>

            {/* Stage */}
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={newDeal.stage}
                onValueChange={(value) => setNewDeal({ ...newDeal, stage: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dealStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Probability */}
            <div className="space-y-2">
              <Label>Probability (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="50"
                value={newDeal.probability}
                onChange={(e) => setNewDeal({ ...newDeal, probability: e.target.value })}
              />
            </div>

            {/* Expected Close Date */}
            <div className="space-y-2">
              <Label>Expected Close Date</Label>
              <Popover modal={true} open={openDealCalendar} onOpenChange={setOpenDealCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !newDeal.expectedCloseDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDeal.expectedCloseDate ? format(newDeal.expectedCloseDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[10000]" align="start" sideOffset={5} side="bottom">
                  <Calendar
                    mode="single"
                    selected={newDeal.expectedCloseDate}
                    onSelect={(date) => {
                      setNewDeal({ ...newDeal, expectedCloseDate: date });
                      setOpenDealCalendar(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Enter deal notes..."
                value={newDeal.notes}
                onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDealDialog(false);
                setDealContact(null);
                setNewDeal({
                  name: '',
                  value: '',
                  stage: 'lead',
                  probability: '50',
                  expectedCloseDate: undefined,
                  notes: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateDeal}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Side Panel */}
      <ContactSidePanel
        contact={selectedContact}
        open={sidePanelOpen}
        onClose={() => {
          setSidePanelOpen(false);
          setSelectedContact(null);
        }}
      />
    </div>
  );
}

