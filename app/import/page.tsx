'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type CSVRow = Record<string, string>;
type ImportHistory = {
  id: string;
  fileName: string;
  importedAt: string;
  totalRecords: number;
  importedCount: number;
  duplicateCount: number;
  missingPhoneCount: number;
  errors: Array<{ row: number; error: string }>;
  firstFewErrors?: Array<{ row: number; error: string }>;
  errorCount?: number;
  duplicates?: number;
  missingPhones?: number;
  imported?: number;
};

type FieldCategory = {
  id: string;
  label: string;
  description?: string;
  fields: Array<{
    id: string;
    label: string;
    required: boolean;
    description?: string;
    placeholder?: string;
  }>;
};

const FIELD_CATEGORIES: FieldCategory[] = [
  {
    id: 'basic',
    label: 'Basic Information',
    fields: [
      { id: 'fullName', label: 'Full Name', required: true, description: 'Will be split into first and last name.' },
    ],
  },
  {
    id: 'contact',
    label: 'Contact Information',
    fields: [
      { id: 'phone1', label: 'Primary Phone', required: true },
      { id: 'phone2', label: 'Alternate Phone 1', required: false },
      { id: 'phone3', label: 'Alternate Phone 2', required: false },
      { id: 'email1', label: 'Primary Email', required: false },
      { id: 'email2', label: 'Alternate Email 1', required: false },
      { id: 'email3', label: 'Alternate Email 2', required: false },
      { id: 'contactAddress', label: 'Contact Address', required: false, description: 'Where the person lives (different from property address)' },
    ],
  },
  {
    id: 'property',
    label: 'Property Address',
    fields: [
      { id: 'propertyStreet', label: 'Street Address', required: false },
      { id: 'propertyCity', label: 'City', required: false },
      { id: 'propertyState', label: 'State', required: false },
      { id: 'propertyCounty', label: 'County', required: false },
    ],
  },
  {
    id: 'details',
    label: 'Property Details',
    fields: [
      { id: 'propertyType', label: 'Property Type', required: false },
      { id: 'bedrooms', label: 'Bedrooms', required: false },
      { id: 'bathrooms', label: 'Bathrooms', required: false },
      { id: 'buildingSqft', label: 'Square Footage', required: false },
      { id: 'yearBuilt', label: 'Year Built', required: false },
    ],
  },
  {
    id: 'financial',
    label: 'Financial Information',
    fields: [
      { id: 'estimatedValue', label: 'Estimated Value', required: false },
      { id: 'estimatedEquity', label: 'Estimated Equity', required: false },
      { id: 'llcName', label: 'LLC Name', required: false },
    ],
  },
  {
    id: 'other',
    label: 'Other Information',
    fields: [
      { id: 'notes', label: 'Notes', required: false },
      { id: 'tags', label: 'Tags', required: false },
    ],
  },
];

const DATABASE_FIELDS = FIELD_CATEGORIES.flatMap(category => category.fields);

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('import');
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);

  const loadImportHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/import/history');
      if (response.ok) {
        const data = await response.json();
        setImportHistory(data);
      } else {
        console.error('Failed to fetch import history');
      }
    } catch (error) {
      console.error('Failed to refresh history:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadImportHistory();
    }
  }, [activeTab, loadImportHistory]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const hasRequiredFields = () => {
    const values = Object.values(mapping);
    return values.includes('fullName') && values.includes('phone1');
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  }, []);

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 1) return;
      
      const rawHeaders = lines[0].split(',');
      const cleanHeaders = rawHeaders.map(h => h.trim().replace(/^"|"$/g, ''));
      setHeaders(cleanHeaders);

      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        return cleanHeaders.reduce((obj, header, index) => {
          obj[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
          return obj;
        }, {} as CSVRow);
      });

      setPreviewData(data.slice(0, 5));

      const initialMapping: Record<string, string> = {};
      cleanHeaders.forEach(header => {
        const lowerHeader = header.toLowerCase().replace(/\s+/g, '');
        const matchedField = DATABASE_FIELDS.find(field => 
          field.id.toLowerCase() === lowerHeader || 
          field.label.toLowerCase().replace(/\s+/g, '') === lowerHeader
        );
        if (matchedField) {
          initialMapping[header] = matchedField.id;
        }
      });
      setMapping(initialMapping);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!file || !hasRequiredFields()) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    try {
      const response = await fetch('/api/import', { method: 'POST', body: formData });
      const result = await response.json();

      if (!response.ok) {
        alert(`Error: ${result.error || 'An unknown error occurred.'}`);
        return;
      }
      
      let message = `Successfully imported ${result.imported || 0} of ${result.total || 0} records.`;
      if (result.duplicates > 0) message += `\n- ${result.duplicates} duplicate records skipped`;
      if (result.missingPhones > 0) message += `\n- ${result.missingPhones} records skipped due to missing phone numbers`;
      if (result.errors > 0) message += `\n- ${result.errors} records had errors`;
      alert(message);
      
      setFile(null);
      setHeaders([]);
      setPreviewData([]);
      setMapping({});
      
      setActiveTab('history');
    } catch (error) {
      console.error('Error during import:', error);
      alert('An unexpected error occurred during import.');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 });

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-10rem)]">
        <h1 className="text-3xl font-bold mb-2">Import Contacts</h1>
        <p className="text-muted-foreground mb-6">Upload a CSV file to import new contacts.</p>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="flex-1 mt-6 overflow-y-auto">
            {!file ? (
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Upload CSV</CardTitle>
                  <CardDescription>Select a CSV file to begin.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <UploadIcon className="w-12 h-12 text-muted-foreground" />
                      <p className="text-lg font-medium">{isDragActive ? 'Drop the file here...' : 'Drag & drop a CSV file, or click to select'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB · {headers.length} columns</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setFile(null); setHeaders([]); setPreviewData([]); setMapping({}); }}>Change File</Button>
                  </CardContent>
                </Card>

                <div>
                  <h3 className="text-lg font-medium">Step 2: Map Fields</h3>
                  <p className="text-sm text-muted-foreground mb-4">Map CSV columns to database fields. Required fields are marked with *.</p>
                  <div className="space-y-4">
                    {FIELD_CATEGORIES.map((category) => (
                      <Card key={category.id}>
                        <CardHeader><CardTitle className="text-base">{category.label}</CardTitle></CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader><TableRow><TableHead>Database Field</TableHead><TableHead>CSV Column</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {category.fields.map((field) => {
                                const currentHeader = Object.keys(mapping).find(key => mapping[key] === field.id) || '';
                                return (
                                  <TableRow key={field.id}>
                                    <TableCell className="font-medium">
                                      {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                                      {field.description && <p className="text-xs text-muted-foreground font-normal">{field.description}</p>}
                                    </TableCell>
                                    <TableCell>
                                      <select
                                        className="w-full p-2 border rounded text-sm bg-background"
                                        value={currentHeader}
                                        onChange={(e) => {
                                          const newHeader = e.target.value;
                                          const newMapping = { ...mapping };
                                          const oldHeader = Object.keys(newMapping).find(key => newMapping[key] === field.id);
                                          if (oldHeader) delete newMapping[oldHeader];
                                          if (newHeader) newMapping[newHeader] = field.id;
                                          setMapping(newMapping);
                                        }}
                                      >
                                        <option value="">-- Select Column --</option>
                                        {headers.map((header) => {
                                          const mappedFieldId = mapping[header];
                                          const isMapped = !!(mappedFieldId && mappedFieldId !== field.id);
                                          return (
                                            <option key={header} value={header} disabled={isMapped}>
                                              {header}{isMapped && ` (mapped)`}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Step 3: Preview Data</h3>
                  <p className="text-sm text-muted-foreground mb-4">A preview of the first 5 rows from your file.</p>
                  <Card>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {headers.map((header) => (
                              <TableHead key={header}>
                                {header}
                                {mapping[header] && <div className="text-xs text-muted-foreground font-normal">→ {DATABASE_FIELDS.find(f => f.id === mapping[header])?.label}</div>}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {headers.map((header) => <TableCell key={header} className="max-w-[200px] truncate">{row[header] || '-'}</TableCell>)}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleImport} disabled={isUploading || !hasRequiredFields()} className="min-w-[150px]">
                    {isUploading ? 'Importing...' : `Import ${previewData.length > 0 ? previewData.length : ''} Records`}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6 flex-1 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Import History</CardTitle>
                <CardDescription>View the history of all your CSV imports.</CardDescription>
              </CardHeader>
              <CardContent>
                {importHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No import history found.</div>
                ) : (
                  <div className="space-y-4">
                    {importHistory.map((item) => (
                      <Card key={item.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{item.fileName}</CardTitle>
                              <p className="text-sm text-muted-foreground">{format(new Date(item.importedAt), 'MMM d, yyyy h:mm a')}</p>
                            </div>
                            <Badge variant={(item.imported || 0) > 0 ? 'secondary' : 'destructive'}>{(item.imported || 0)} / {item.totalRecords} imported</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><p className="font-medium">Duplicates</p><p>{(item.duplicates || 0)} found</p></div>
                            <div><p className="font-medium">Missing Phones</p><p>{(item.missingPhones || 0)} rows</p></div>
                          </div>
                          {item.firstFewErrors && item.firstFewErrors.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="font-medium text-sm mb-2">Errors ({item.errors.length})</p>
                              <div className="bg-muted/50 p-3 rounded-md max-h-40 overflow-y-auto text-sm">
                                {item.firstFewErrors?.map((e, i) => (
                                  <p key={i} className="text-red-600">Row {e.row}: {e.error}</p>
                                ))}
                                {(item.errorCount || 0) > 5 && (
                                  <p className="text-muted-foreground text-xs mt-1">...and {(item.errorCount || 0) - 5} more</p>
                                )}
                              </div>
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
        </Tabs>
      </div>
    </div>
  );
}

const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
