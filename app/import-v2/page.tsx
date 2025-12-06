'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, X, Check, AlertCircle, Upload, FileText, ArrowRight, History, Download, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizePropertyType } from '@/lib/property-type-mapper';
import { findFieldMapping, normalizeHeader } from '@/lib/import/fieldMappings';

type CSVRow = Record<string, string>;

type ImportHistoryRecord = {
  id: string;
  fileName: string;
  fileUrl: string | null;
  tags: string[];
  importedAt: string;
  totalRecords: number;
  imported: number;
  newContacts: number;
  existingContactsNewProperties: number;
  noPhoneEnriched: number;
  ambiguousMatches: number;
  duplicates: number;
  missingPhones: number;
  skipped: number;
  errorCount: number;
  firstFewErrors: Array<{ row: number; error: string }>;
};

type Tag = {
  id: string;
  name: string;
  color: string;
};

type FieldDefinition = {
  id: string;
  name: string;
  fieldKey: string;
  fieldType: string;
  category: string | null;
  options: string[] | null;
  isRequired: boolean;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number | null;
  placeholder: string | null;
  helpText: string | null;
};

type ColumnMapping = {
  csvColumn: string;
  fieldId: string | null;
  fieldKey: string | null;
  fieldName: string | null;
  fieldType: string | null;
  isNewField: boolean;
};

	// Helper to mirror backend name-splitting so preview matches import behavior
	function splitFullName(fullName?: string) {
	  if (!fullName) return { firstName: '', lastName: '' };
	  const parts = fullName.trim().split(/\s+/);
	  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
	  const firstName = parts[0];
	  const lastName = parts.slice(1).join(' ');
	  return { firstName, lastName };
	}

export default function ImportV2Page() {
  const [activeTab, setActiveTab] = useState<'import' | 'history' | 'fields'>('import');
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [showNewFieldDialog, setShowNewFieldDialog] = useState(false);
  const [newFieldColumn, setNewFieldColumn] = useState<string>('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const [newFieldCategory, setNewFieldCategory] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importHistory, setImportHistory] = useState<ImportHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Tags state
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');

  // Field deletion confirmation dialog state
  const [showDeleteFieldDialog, setShowDeleteFieldDialog] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<{ id: string; name: string } | null>(null);

  // Fetch field definitions on mount
  useEffect(() => {
    fetchFieldDefinitions();
    fetchImportHistory();
    fetchTags();
  }, []);

  const fetchFieldDefinitions = async () => {
    try {
      const response = await fetch('/api/fields?activeOnly=true');
      if (!response.ok) throw new Error('Failed to fetch fields');
      const fields = await response.json();
      setFieldDefinitions(fields);
    } catch (error) {
      console.error('Error fetching fields:', error);
      toast.error('Failed to load field definitions');
    }
  };

  const fetchImportHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/import/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      const history = await response.json();
      setImportHistory(history);
    } catch (error) {
      console.error('Error fetching import history:', error);
      toast.error('Failed to load import history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      // API returns { tags: [...], pagination: {...} }
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    // Check if tag already exists
    const existingTag = availableTags.find(t => t.name.toLowerCase() === newTagName.toLowerCase());
    if (existingTag) {
      if (!selectedTags.includes(existingTag.name)) {
        setSelectedTags(prev => [...prev, existingTag.name]);
      }
      setNewTagName('');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName, color: '#3b82f6' })
      });

      if (!response.ok) throw new Error('Failed to create tag');

      const newTag = await response.json();
      setAvailableTags(prev => [...prev, newTag]);
      setSelectedTags(prev => [...prev, newTag.name]);
      setNewTagName('');
      toast.success(`Created tag: ${newTag.name}`);
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleDeleteSelectedHistory = async () => {
    if (selectedHistoryIds.length === 0) {
      toast.error('No history records selected');
      return;
    }

    if (!confirm(`Delete ${selectedHistoryIds.length} import history record(s)?`)) {
      return;
    }

    try {
      const response = await fetch('/api/import/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedHistoryIds })
      });

      if (!response.ok) throw new Error('Failed to delete history');

      const result = await response.json();
      toast.success(result.message);
      setSelectedHistoryIds([]);
      await fetchImportHistory();
    } catch (error) {
      console.error('Error deleting history:', error);
      toast.error('Failed to delete import history');
    }
  };

  const toggleHistorySelection = (id: string) => {
    setSelectedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(hid => hid !== id) : [...prev, id]
    );
  };

  const toggleAllHistorySelection = () => {
    if (selectedHistoryIds.length === importHistory.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(importHistory.map(h => h.id));
    }
  };

  const parseCSV = useCallback((text: string) => {
    try {
      // Use a simple CSV parser that handles quoted values
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        toast.error('CSV file is empty');
        return;
      }

      // Parse CSV properly handling quoted values with commas
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++; // Skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows: CSVRow[] = [];

      // Parse ALL rows, not just 100
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }

      setCsvColumns(headers);
      setCsvData(rows);

      // Initialize mappings with empty values
      const initialMappings: ColumnMapping[] = headers.map(col => ({
        csvColumn: col,
        fieldId: null,
        fieldKey: null,
        fieldName: null,
        fieldType: null,
        isNewField: false
      }));

      // Track which fields have already been mapped (prevents duplicate mappings)
      const mappedFieldKeys = new Set<string>();

      // Auto-map columns using centralized field mappings
      initialMappings.forEach(mapping => {
        // Use centralized auto-mapping from lib/import/fieldMappings.ts
        const fieldKey = findFieldMapping(mapping.csvColumn);

        if (fieldKey && !mappedFieldKeys.has(fieldKey)) {
          const matchedField = fieldDefinitions.find(f => f.fieldKey === fieldKey);
          if (matchedField) {
            mapping.fieldId = matchedField.id;
            mapping.fieldKey = matchedField.fieldKey;
            mapping.fieldName = matchedField.name;
            mapping.fieldType = matchedField.fieldType;
            mappedFieldKeys.add(fieldKey);
            return;
          }
        }

        // Fallback: try exact name/key match (for custom fields)
        const normalizedColumn = normalizeHeader(mapping.csvColumn);
        const matchedField = fieldDefinitions.find(
          f => normalizeHeader(f.name) === normalizedColumn ||
               normalizeHeader(f.fieldKey) === normalizedColumn
        );
        if (matchedField && !mappedFieldKeys.has(matchedField.fieldKey)) {
          mapping.fieldId = matchedField.id;
          mapping.fieldKey = matchedField.fieldKey;
          mapping.fieldName = matchedField.name;
          mapping.fieldType = matchedField.fieldType;
          mappedFieldKeys.add(matchedField.fieldKey);
        }
      });

      setColumnMappings(initialMappings);
      setStep('map');
      toast.success(`Loaded ${rows.length} rows with ${headers.length} columns`);
    } catch (error) {
      console.error('CSV parsing error:', error);
      toast.error('Failed to parse CSV file');
      return;
    }
  }, [fieldDefinitions]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };

    reader.readAsText(file);
  }, [parseCSV]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const handleFieldMapping = (csvColumn: string, fieldId: string) => {
    setColumnMappings(prev => prev.map(m => {
      if (m.csvColumn === csvColumn) {
        if (fieldId === 'new') {
          // Open dialog to create new field
          setNewFieldColumn(csvColumn);
          setNewFieldName(csvColumn);
          setShowNewFieldDialog(true);
          return m;
        } else if (fieldId === 'skip') {
          return { ...m, fieldId: null, fieldKey: null, fieldName: null, fieldType: null, isNewField: false };
        } else {
          const field = fieldDefinitions.find(f => f.id === fieldId);
          return {
            ...m,
            fieldId: field?.id || null,
            fieldKey: field?.fieldKey || null,
            fieldName: field?.name || null,
            fieldType: field?.fieldType || null,
            isNewField: false
          };
        }
      }
      return m;
    }));
  };

  const handleCreateNewField = async () => {
    if (!newFieldName.trim()) {
      toast.error('Field name is required');
      return;
    }

    try {
      const fieldKey = newFieldName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const response = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFieldName,
          fieldKey,
          fieldType: newFieldType,
          category: newFieldCategory || 'Custom Fields',
          isRequired: false,
          isSystem: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create field');
      }

      const newField = await response.json();
      setFieldDefinitions(prev => [...prev, newField]);

      // Update the mapping for this column
      setColumnMappings(prev => prev.map(m => {
        if (m.csvColumn === newFieldColumn) {
          return {
            ...m,
            fieldId: newField.id,
            fieldKey: newField.fieldKey,
            fieldName: newField.name,
            fieldType: newField.fieldType,
            isNewField: true
          };
        }
        return m;
      }));

      toast.success(`Created new field: ${newFieldName}`);
      setShowNewFieldDialog(false);
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldCategory('');
    } catch (error) {
      console.error('Error creating field:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create field');
    }
  };

  const handleDeleteFieldPrompt = (fieldId: string, fieldName: string) => {
    setFieldToDelete({ id: fieldId, name: fieldName });
    setShowDeleteFieldDialog(true);
  };

  const handleDeleteFieldConfirm = async () => {
    if (!fieldToDelete) return;

    try {
      const response = await fetch(`/api/fields/${fieldToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete field');
      }

      // Remove from field definitions
      setFieldDefinitions(prev => prev.filter(f => f.id !== fieldToDelete.id));

      // Remove from any mappings
      setColumnMappings(prev => prev.map(m => {
        if (m.fieldId === fieldToDelete.id) {
          return {
            ...m,
            fieldId: null,
            fieldKey: null,
            fieldName: null,
            fieldType: null,
            isNewField: false
          };
        }
        return m;
      }));

      toast.success(`Deleted field: ${fieldToDelete.name}`);
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete field');
    } finally {
      setShowDeleteFieldDialog(false);
      setFieldToDelete(null);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    setImportProgress(0);
    setImportStatus('Preparing import...');

    try {
      if (!file) throw new Error('No file selected');

      // Build the mapping object for the API
      const mapping: Record<string, string> = {};
      columnMappings.forEach(m => {
        if (m.fieldKey) {
          mapping[m.csvColumn] = m.fieldKey;
        }
      });

      setImportProgress(10);
      setImportStatus('📤 Uploading CSV file...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('tags', JSON.stringify(selectedTags));
      formData.append('useCustomFields', 'true');

      setImportProgress(20);
      setImportStatus(`📤 Uploading ${csvData.length} contacts...`);

      // Use AbortController with 5 minute timeout for large files
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

      // Simulate progress while waiting for import
      let currentProgress = 20;
      const progressInterval = setInterval(() => {
        // Slowly increase progress from 20 to 75 while waiting
        if (currentProgress < 75) {
          currentProgress += Math.random() * 3; // Random increment 0-3%
          const progress = Math.min(75, Math.round(currentProgress));
          setImportProgress(progress);

          // Update status based on progress stage
          if (progress < 30) {
            setImportStatus(`📤 Uploading ${csvData.length} contacts...`);
          } else if (progress < 50) {
            setImportStatus(`⚙️ Processing ${csvData.length} contacts...`);
          } else if (progress < 70) {
            setImportStatus(`💾 Saving contacts to database...`);
          } else {
            setImportStatus(`🔄 Finalizing import...`);
          }
        }
      }, 1000);

      let response;
      try {
        response = await fetch('/api/import-v2', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
      }

      setImportProgress(85);
      setImportStatus('Finalizing import...');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();

      setImportProgress(100);
      setImportStatus('✅ Import complete!');

      // Show detailed success message
      const messages = [`✅ Successfully imported ${result.imported} contacts!`];
      if (result.skippedNoPhone > 0) {
        messages.push(`⚠️ Skipped ${result.skippedNoPhone} contacts (no phone number)`);
      }
      if (result.duplicates > 0) {
        messages.push(`⚠️ Skipped ${result.duplicates} duplicates`);
      }
      if (result.totalErrors > 0) {
        messages.push(`❌ ${result.totalErrors} errors occurred`);
      }

      // Show success toast with longer duration
      toast.success(messages.join('\n'), { duration: 10000 });

      // Refresh history immediately
      await fetchImportHistory();

      // Keep the results visible for 3 seconds, then switch to history tab
      setTimeout(() => {
        // Reset state and switch to history tab
        setFile(null);
        setCsvData([]);
        setCsvColumns([]);
        setColumnMappings([]);
        setSelectedTags([]);
        setStep('upload');
        setImportProgress(0);
        setImportStatus('');
        setActiveTab('history');
      }, 3000); // Wait 3 seconds to show completion
    } catch (error) {
      console.error('Import error:', error);

      // Check if it was an abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Import timed out. Checking history for results...', { duration: 5000 });
        // Still check history - import might have completed on the server
        await fetchImportHistory();
        setActiveTab('history');
        setFile(null);
        setCsvData([]);
        setCsvColumns([]);
        setColumnMappings([]);
        setSelectedTags([]);
        setStep('upload');
      } else {
        toast.error(error instanceof Error ? error.message : 'Import failed');
        setStep('preview');
      }
      setImportProgress(0);
      setImportStatus('');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Contacts</h1>
        <p className="text-muted-foreground">Upload a CSV file and map columns to your custom fields</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'history' | 'fields')} className="w-full">
        <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
          <TabsTrigger value="import">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="fields">
            <Settings className="h-4 w-4 mr-2" />
            Manage Fields
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8 gap-4">
            <StepIndicator step={1} label="Upload" active={step === 'upload'} completed={step !== 'upload'} />
            <ArrowRight className="text-muted-foreground" />
            <StepIndicator step={2} label="Map Fields" active={step === 'map'} completed={step === 'preview' || step === 'importing'} />
            <ArrowRight className="text-muted-foreground" />
            <StepIndicator step={3} label="Preview & Import" active={step === 'preview' || step === 'importing'} completed={false} />
          </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>Drag and drop your CSV file or click to browse</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? 'Drop the file here...' : 'Drag & drop a CSV file, or click to select'}
              </p>
              <p className="text-sm text-muted-foreground">Supports CSV files up to 10MB</p>
            </div>
            {file && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{file.name}</span>
                <Badge variant="secondary">{(file.size / 1024).toFixed(2)} KB</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Fields */}
      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle>Map CSV Columns to Fields</CardTitle>
            <CardDescription>
              Match your CSV columns to existing fields or create new custom fields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {columnMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium mb-1 block">CSV Column</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{mapping.csvColumn}</Badge>
                      {csvData[0] && (
                        <span className="text-xs text-muted-foreground">
                          Example: {csvData[0][mapping.csvColumn]?.substring(0, 30)}
                          {csvData[0][mapping.csvColumn]?.length > 30 ? '...' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <Label className="text-sm font-medium mb-1 block">Map to Field</Label>
                    <Select
                      value={mapping.fieldId || 'skip'}
                      onValueChange={(value) => handleFieldMapping(mapping.csvColumn, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">
                          <span className="text-muted-foreground">Skip this column</span>
                        </SelectItem>
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span className="font-medium">Create New Field</span>
                          </div>
                        </SelectItem>
                        {(() => {
                          // Get list of field IDs that are already mapped to OTHER columns
                          const usedFieldIds = columnMappings
                            .filter(m => m.fieldId && m.csvColumn !== mapping.csvColumn)
                            .map(m => m.fieldId);

                          return Object.entries(
                            fieldDefinitions
                              // Hide firstName and lastName - they are auto-derived from fullName
                              .filter(f => f.fieldKey !== 'firstName' && f.fieldKey !== 'lastName')
                              .reduce((acc, field) => {
                                const cat = field.category || 'Other';
                                if (!acc[cat]) acc[cat] = [];
                                acc[cat].push(field);
                                return acc;
                              }, {} as Record<string, FieldDefinition[]>)
                          ).map(([category, fields]) => (
                            <React.Fragment key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                {category}
                              </div>
                              {fields.map(field => {
                                const isUsedElsewhere = usedFieldIds.includes(field.id);
                                return (
                                  <SelectItem
                                    key={field.id}
                                    value={field.id}
                                    disabled={isUsedElsewhere}
                                    className={isUsedElsewhere ? 'opacity-50' : ''}
                                  >
                                    <div className="flex items-center justify-between gap-2 w-full">
                                      <div className="flex items-center gap-2">
                                        {isUsedElsewhere && (
                                          <Check className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        <span className={isUsedElsewhere ? 'text-muted-foreground' : ''}>
                                          {field.name}
                                        </span>
                                        {field.isRequired && (
                                          <Badge variant="destructive" className="text-xs">Required</Badge>
                                        )}
                                        <Badge variant="secondary" className="text-xs">{field.fieldType}</Badge>
                                        {isUsedElsewhere && (
                                          <Badge variant="outline" className="text-xs text-muted-foreground">mapped</Badge>
                                        )}
                                      </div>
                                      {!field.isSystem && !isUsedElsewhere && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFieldPrompt(field.id, field.name);
                                          }}
                                          className="text-red-500 hover:text-red-700 ml-2"
                                          title="Delete field"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </React.Fragment>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  {mapping.fieldName && (
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={() => setStep('preview')}>
                Continue to Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <CardDescription>Review the first 15 rows before importing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Rows:</span>
                  <span className="ml-2 font-semibold">{csvData.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mapped Fields:</span>
                  <span className="ml-2 font-semibold">
                    {columnMappings.filter(m => m.fieldId).length}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped Columns:</span>
                  <span className="ml-2 font-semibold">
                    {columnMappings.filter(m => !m.fieldId).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend for highlighted cells */}
            <div className="mb-3 flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-amber-100 border border-amber-300">Amber</span>
                <span className="text-muted-foreground">= Derived from Full Name (will be auto-created)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-blue-100 border border-blue-300">Blue</span>
                <span className="text-muted-foreground">= Full Property Address (combined from address, city, state, zip)</span>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto max-w-full">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    {columnMappings.filter(m => m.fieldId).map((mapping, i) => (
                      <TableHead key={i} className="whitespace-nowrap min-w-[120px]">
                        <div>
                          <div className="font-semibold text-xs">{mapping.fieldName}</div>
                          <div className="text-[10px] text-muted-foreground">{mapping.csvColumn}</div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 15).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {columnMappings.filter(m => m.fieldId).map((mapping, colIndex) => {
                        const rawValue = row[mapping.csvColumn];
                        const isFullNameField = mapping.fieldKey === 'fullName';
                        const isPropertyAddressField = mapping.fieldKey === 'propertyAddress';

                        if (isFullNameField) {
                          const { firstName, lastName } = splitFullName(rawValue);
                          return (
                            <TableCell key={colIndex} className="whitespace-nowrap text-sm max-w-[220px]">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {rawValue || <span className="text-muted-foreground">—</span>}
                                </div>
                                {(firstName || lastName) && (
                                  <div className="flex flex-wrap gap-1 text-[10px]">
                                    <span className="px-1 rounded bg-amber-100 border border-amber-300">
                                      First: {firstName || '—'}
                                    </span>
                                    <span className="px-1 rounded bg-amber-100 border border-amber-300">
                                      Last: {lastName || '—'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        }

                        if (isPropertyAddressField) {
                          // Build full property address from multiple fields
                          const address = rawValue || '';
                          const cityMapping = columnMappings.find(m => m.fieldKey === 'city');
                          const stateMapping = columnMappings.find(m => m.fieldKey === 'state');
                          const zipMapping = columnMappings.find(m => m.fieldKey === 'zip');

                          const city = cityMapping ? row[cityMapping.csvColumn] : '';
                          const state = stateMapping ? row[stateMapping.csvColumn] : '';
                          const zip = zipMapping ? row[zipMapping.csvColumn] : '';

                          const fullAddress = [
                            address,
                            city && state ? `${city}, ${state}` : city || state,
                            zip
                          ].filter(Boolean).join(' ');

                          return (
                            <TableCell key={colIndex} className="whitespace-nowrap text-sm max-w-[220px]">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {rawValue || <span className="text-muted-foreground">—</span>}
                                </div>
                                {fullAddress && fullAddress !== rawValue && (
                                  <div className="flex flex-wrap gap-1 text-[10px]">
                                    <span className="px-1 rounded bg-blue-100 border border-blue-300">
                                      Full: {fullAddress}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        }

                        // Normalize property type for display
                        const isPropertyTypeField = mapping.fieldKey === 'propertyType';
                        const displayValue = isPropertyTypeField && rawValue
                          ? normalizePropertyType(rawValue)
                          : rawValue;

                        return (
                          <TableCell key={colIndex} className="whitespace-nowrap text-sm max-w-[200px] truncate">
                            {isPropertyTypeField && rawValue && displayValue !== rawValue ? (
                              <div className="space-y-1">
                                <div className="font-medium">{displayValue}</div>
                                <div className="text-[10px] text-muted-foreground line-through">{rawValue}</div>
                              </div>
                            ) : (
                              displayValue || <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Tag Selection */}
            <div className={`mt-6 p-4 border-2 rounded-lg transition-all ${
              selectedTags.length > 0
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-muted/50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold block">
                  Add Tags to Imported Contacts (Optional)
                </Label>
                {selectedTags.length > 0 && (
                  <Badge variant="default" className="bg-primary text-white">
                    {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} selected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                All imported contacts will be tagged with the selected tags for easy filtering later.
              </p>

              {/* Selected Tags - More prominent display */}
              {selectedTags.length > 0 && (
                <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs font-medium text-primary mb-2">Selected Tags (click to remove):</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tagName => (
                      <Badge
                        key={tagName}
                        className="cursor-pointer bg-primary text-white hover:bg-red-500 transition-colors px-3 py-1"
                        onClick={() => toggleTag(tagName)}
                      >
                        {tagName}
                        <X className="h-3 w-3 ml-2" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Tags */}
              {availableTags.filter(tag => !selectedTags.includes(tag.name)).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">Available tags (click to add):</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags
                      .filter(tag => !selectedTags.includes(tag.name))
                      .map(tag => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => toggleTag(tag.name)}
                        >
                          + {tag.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* Create New Tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Create new tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  className="max-w-xs"
                />
                <Button variant="outline" size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tag
                </Button>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep('map')}>
                Back to Mapping
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : `Import ${csvData.length} Contacts`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Importing with Progress */}
      {step === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Importing Contacts</CardTitle>
            <CardDescription>Please wait while we import your contacts...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Large Progress Bar with Percentage */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{importStatus}</span>
                  <span className="text-3xl font-bold text-primary">{importProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-8 overflow-hidden border-2 border-primary/20">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/80 h-full transition-all duration-500 ease-out rounded-full flex items-center justify-end pr-3"
                    style={{ width: `${importProgress}%` }}
                  >
                    {importProgress > 10 && (
                      <span className="text-white text-sm font-semibold">{importProgress}%</span>
                    )}
                  </div>
                </div>

                {/* Progress Stage Indicator */}
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span className={importProgress >= 0 ? 'text-primary font-semibold' : ''}>
                    {importProgress >= 10 ? '✓' : '○'} Upload
                  </span>
                  <span className={importProgress >= 20 ? 'text-primary font-semibold' : ''}>
                    {importProgress >= 20 ? '✓' : '○'} Processing
                  </span>
                  <span className={importProgress >= 85 ? 'text-primary font-semibold' : ''}>
                    {importProgress >= 85 ? '✓' : '○'} Finalizing
                  </span>
                  <span className={importProgress >= 100 ? 'text-primary font-semibold' : ''}>
                    {importProgress >= 100 ? '✓' : '○'} Complete
                  </span>
                </div>
              </div>

              {/* Import Stats */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{csvData.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Contacts</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{columnMappings.filter(m => m.fieldId).length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Mapped Fields</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold animate-pulse">⏳</div>
                  <div className="text-sm text-muted-foreground mt-1">Processing</div>
                </div>
              </div>

              {/* Info Message */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Import in progress</p>
                  <p>Please don't close this page. This may take a few moments depending on the number of contacts.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Import History</CardTitle>
                  <CardDescription>View past imports and their results</CardDescription>
                </div>
                {importHistory.length > 0 && selectedHistoryIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelectedHistory}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedHistoryIds.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-8 text-muted-foreground">Loading history...</div>
              ) : importHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No import history yet</div>
              ) : (
                <div className="space-y-4">
                  {/* Select All Checkbox */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                    <Checkbox
                      checked={selectedHistoryIds.length === importHistory.length && importHistory.length > 0}
                      onCheckedChange={toggleAllHistorySelection}
                    />
                    <Label className="text-sm font-medium cursor-pointer" onClick={toggleAllHistorySelection}>
                      Select All ({importHistory.length} records)
                    </Label>
                  </div>

                  {importHistory.map((record) => (
                    <Card key={record.id} className="border">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedHistoryIds.includes(record.id)}
                              onCheckedChange={() => toggleHistorySelection(record.id)}
                            />
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-semibold">{record.fileName}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(record.importedAt).toLocaleString()}
                              </p>
                              {/* Tags */}
                              {record.tags && record.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {record.tags.map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Download Button */}
                          {record.fileUrl && (
                            <a
                              href={record.fileUrl}
                              download={record.fileName}
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Rows</p>
                            <p className="text-lg font-semibold">{record.totalRecords}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Imported</p>
                            <p className="text-lg font-semibold text-green-600">{record.imported}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">New Contacts</p>
                            <p className="text-lg font-semibold text-blue-600">{record.newContacts || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">New Properties (via Phone)</p>
                            <p className="text-lg font-semibold text-purple-600">{(record.existingContactsNewProperties || 0) - (record.noPhoneEnriched || 0)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Enriched (Name+City)</p>
                            <p className="text-lg font-semibold text-teal-600">{record.noPhoneEnriched || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Duplicates</p>
                            <p className="text-lg font-semibold text-yellow-600">{record.duplicates}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">No Phone (No Match)</p>
                            <p className="text-lg font-semibold text-orange-600">{record.missingPhones}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Ambiguous</p>
                            <p className="text-lg font-semibold text-amber-600">{record.ambiguousMatches || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Errors</p>
                            <p className="text-lg font-semibold text-red-600">{record.errorCount}</p>
                          </div>
                        </div>

                        {record.errorCount > 0 && record.firstFewErrors.length > 0 && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-semibold text-red-900 mb-2">Errors (showing first 5):</p>
                            <ul className="text-xs text-red-800 space-y-1">
                              {record.firstFewErrors.map((err, idx) => (
                                <li key={idx}>
                                  Row {err.row}: {err.error}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Manage Fields
              </CardTitle>
              <CardDescription>View and manage all fields used in imports. Protected fields cannot be deleted.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Protected Fields Section */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Protected Fields (Cannot be deleted)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {fieldDefinitions
                      .filter(f => ['phone1', 'fullName', 'email1', 'firstName', 'lastName', 'propertyAddress', 'city', 'state', 'zipCode', 'llcName'].includes(f.fieldKey))
                      .map(field => (
                        <div key={field.id} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {field.name}
                        </div>
                      ))}
                  </div>
                </div>

                {/* All Other Fields Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">All Fields</h3>
                  {fieldDefinitions.filter(f => !['phone1', 'fullName', 'email1', 'firstName', 'lastName', 'propertyAddress', 'city', 'state', 'zipCode', 'llcName'].includes(f.fieldKey)).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No additional fields. Create one during import or use the button below.</p>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {fieldDefinitions
                        .filter(f => !['phone1', 'fullName', 'email1', 'firstName', 'lastName', 'propertyAddress', 'city', 'state', 'zipCode', 'llcName'].includes(f.fieldKey))
                        .map(field => (
                          <div key={field.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium">
                                  {field.name}
                                  {field.isSystem && <span className="ml-2 text-xs text-muted-foreground">(System)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Key: {field.fieldKey} • Type: {field.fieldType}
                                  {field.category && ` • Category: ${field.category}`}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteFieldPrompt(field.id, field.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Create New Field Button */}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewFieldColumn('');
                      setNewFieldName('');
                      setShowNewFieldDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Field
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Field Dialog */}
      <Dialog open={showNewFieldDialog} onOpenChange={setShowNewFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Custom Field</DialogTitle>
            <DialogDescription>
              Add a new field to your CRM for the column "{newFieldColumn}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g., Customer Source"
              />
            </div>
            <div>
              <Label htmlFor="fieldType">Field Type</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="decimal">Decimal</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={newFieldCategory || 'Custom Fields'} onValueChange={setNewFieldCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contact Info">Contact Info</SelectItem>
                  <SelectItem value="Property Info">Property Info</SelectItem>
                  <SelectItem value="Financial">Financial</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Custom Fields">Custom Fields</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFieldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewField}>
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Field Confirmation Dialog */}
      <Dialog open={showDeleteFieldDialog} onOpenChange={setShowDeleteFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Field
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the field "{fieldToDelete?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">
              <strong>Warning:</strong> This action cannot be undone. The field will be permanently deleted and any data stored in this field will be lost.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteFieldDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFieldConfirm}>
              Delete Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepIndicator({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
        completed ? 'bg-primary text-primary-foreground' :
        active ? 'bg-primary text-primary-foreground' :
        'bg-muted text-muted-foreground'
      }`}>
        {completed ? <Check className="h-5 w-5" /> : step}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );
}

