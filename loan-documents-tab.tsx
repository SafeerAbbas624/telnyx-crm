import { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  Clock,
  AlertCircle,
  Check,
  X,
  Send,
  Cloud,
  RotateCcw,
  Info,
  HelpCircle,
} from 'lucide-react';
import { Loan, LoanDocument, DocumentCategory, LENDER_REQUIRED_DOCS } from '../types/loans';
import { getRequirementsForFunder, getCategoryDisplayName, getCategoryIcon, getRequiredDocumentCount } from '../utils/loanDocumentRequirements';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../contexts/AuthContext';

interface LoanDocumentsTabProps {
  selectedLoan: Loan;
  loanDocuments: LoanDocument[];
  onAddDocument: (docData: Omit<LoanDocument, 'id' | 'uploadedAt'>) => void;
  onUpdateDocument?: (docId: string, updates: Partial<LoanDocument>) => void;
}

type DocumentTab = 'all' | 'missing' | 'completed';

export function LoanDocumentsTab({ selectedLoan, loanDocuments, onAddDocument, onUpdateDocument }: LoanDocumentsTabProps) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<DocumentTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<LoanDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMissingDoc, setSelectedMissingDoc] = useState<string>('');
  const [assigningDocId, setAssigningDocId] = useState<string>('');
  const [uploadingForCategory, setUploadingForCategory] = useState<string>('');
  const [showAddRequirementDialog, setShowAddRequirementDialog] = useState(false);
  const [customRequirements, setCustomRequirements] = useState<string[]>([]);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    customName: '',
    category: '',
    notes: '',
    file: null as File | null,
  });

  // Custom requirement form state
  const [customRequirementForm, setCustomRequirementForm] = useState({
    name: '',
    category: 'Other' as DocumentCategory,
    description: '',
  });

  // Get required documents for this loan's lender using funder-specific requirements
  const funderRequirements = getRequirementsForFunder(selectedLoan.lender);
  const requiredDocs = funderRequirements.filter(req => req.required).map(req => req.id);

  // Get assigned documents (documents that are assigned to a required category and marked as required)
  const assignedDocs = loanDocuments.filter(doc => doc.isRequired && doc.status !== 'Rejected');

  // Get unassigned documents (documents that are not assigned to required categories)
  const unassignedDocs = loanDocuments.filter(doc => !doc.isRequired);

  // Build missing documents list
  const missingDocs = useMemo(() => {
    const standardMissing = requiredDocs
      .filter(category => {
        // Check if this category has an approved/uploaded document
        return !assignedDocs.some(doc => doc.category === category);
      })
      .map(category => ({
        category,
        stage: getDocumentStage(category),
      }));
    
    // Add custom requirements that haven't been fulfilled
    const customMissing = customRequirements
      .filter(req => !assignedDocs.some(doc => doc.category === req))
      .map(category => ({
        category,
        stage: 'missing',
      }));
    
    return [...standardMissing, ...customMissing];
  }, [requiredDocs, assignedDocs, customRequirements]);

  // Build completed documents list
  const completedDocs = useMemo(() => {
    return assignedDocs.filter(doc => doc.status === 'Approved' || doc.status === 'Uploaded');
  }, [assignedDocs]);

  // Filter documents based on active tab
  const filteredDocuments = useMemo(() => {
    let docs: LoanDocument[] = [];
    
    if (activeTab === 'all') {
      docs = loanDocuments;
    } else if (activeTab === 'completed') {
      docs = completedDocs;
    }

    // Apply search filter
    if (searchQuery) {
      docs = docs.filter(doc => {
        const displayName = doc.customName ? `${doc.customName} - ${doc.fileName}` : doc.fileName;
        return (
          displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    return docs;
  }, [activeTab, loanDocuments, completedDocs, searchQuery]);

  // Calculate summary counts
  const summary = useMemo(() => {
    return {
      all: loanDocuments.length,
      missing: missingDocs.length,
      completed: completedDocs.length,
    };
  }, [loanDocuments, missingDocs, completedDocs]);

  const handleUploadClick = (category?: string) => {
    setUploadForm({
      customName: '',
      category: category || '',
      notes: '',
      file: null,
    });
    setUploadingForCategory(category || '');
    setShowUploadDialog(true);
  };

  const handlePreview = (doc: LoanDocument) => {
    setPreviewDocument(doc);
    setShowPreviewDialog(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUploadSubmit = () => {
    if (!uploadForm.file || !uploadForm.category) {
      toast.error('Please select a file and category');
      return;
    }

    const isRequired = requiredDocs.includes(uploadForm.category as DocumentCategory);

    onAddDocument({
      loanId: selectedLoan.id,
      fileName: uploadForm.file.name,
      customName: uploadForm.customName.trim() || undefined,
      fileType: uploadForm.file.type,
      fileSize: uploadForm.file.size,
      category: uploadForm.category,
      status: 'Uploaded',
      uploadedBy: currentUser.id,
      notes: uploadForm.notes,
      isRequired,
    });

    const displayName = uploadForm.customName ? `${uploadForm.customName} - ${uploadForm.file.name}` : uploadForm.file.name;
    toast.success(`${displayName} uploaded successfully!`);
    setShowUploadDialog(false);
    setUploadForm({ customName: '', category: '', notes: '', file: null });
    setUploadingForCategory('');
    setAssigningDocId('');
  };

  const handleAssignDocument = (missingCategory: string, documentId: string) => {
    if (!onUpdateDocument) {
      toast.error('Document update not available');
      return;
    }

    // Update the document to be required and assigned to this category
    onUpdateDocument(documentId, {
      category: missingCategory,
      isRequired: true,
      status: 'Uploaded',
    });

    toast.success(`Document assigned to ${missingCategory} and marked as complete!`);
    setSelectedMissingDoc('');
    setAssigningDocId('');
  };

  const handleUnmarkDocument = (documentId: string) => {
    if (!onUpdateDocument) {
      toast.error('Document update not available');
      return;
    }

    // Unassign the document from the requirement
    onUpdateDocument(documentId, {
      isRequired: false,
      status: 'Uploaded',
    });

    toast.success('Document unmarked and moved back to unassigned pool');
  };

  const handleRemoveAssignment = (documentId: string, category: string) => {
    if (!onUpdateDocument) {
      toast.error('Document update not available');
      return;
    }

    onUpdateDocument(documentId, {
      isRequired: false,
      status: 'Uploaded',
    });

    toast.success(`Document removed from ${category}`);
  };

  const handleSendToAnalyst = () => {
    toast.success('Documents sent to analyst for review');
  };

  const handleSendToDrive = () => {
    toast.success('Documents uploaded to Drive');
  };

  const handleResetDocuments = () => {
    if (confirm('Are you sure you want to reset all document assignments? This will move all assigned documents back to the unassigned pool.')) {
      // Reset all assigned documents
      assignedDocs.forEach(doc => {
        if (onUpdateDocument) {
          onUpdateDocument(doc.id, {
            isRequired: false,
            status: 'Uploaded',
          });
        }
      });
      toast.success('All document assignments have been reset');
    }
  };

  const handleAddCustomRequirement = () => {
    if (!customRequirementForm.name.trim()) {
      toast.error('Please enter a requirement name');
      return;
    }

    // Add the custom requirement to the list
    const newRequirement = customRequirementForm.name.trim();
    setCustomRequirements(prev => [...prev, newRequirement]);
    
    toast.success(`Added custom requirement: ${newRequirement}`);
    setShowAddRequirementDialog(false);
    setCustomRequirementForm({
      name: '',
      category: 'Other',
      description: '',
    });
    
    // Switch to missing tab to show the new requirement
    setActiveTab('missing');
  };

  const handleDownload = (doc: LoanDocument) => {
    const displayName = doc.customName ? `${doc.customName} - ${doc.fileName}` : doc.fileName;
    toast.success(`Downloading ${displayName}...`);
  };

  const handleOpen = (doc: LoanDocument) => {
    const displayName = doc.customName ? `${doc.customName} - ${doc.fileName}` : doc.fileName;
    toast.success(`Opening ${displayName}...`);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Approved') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'Uploaded') return <Clock className="h-4 w-4 text-blue-600" />;
    if (status === 'Rejected') return <AlertCircle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === 'Approved') return 'default';
    if (status === 'Uploaded') return 'secondary';
    if (status === 'Rejected') return 'destructive';
    return 'outline';
  };

  const getDisplayName = (doc: LoanDocument) => {
    return doc.customName ? `${doc.customName} - ${doc.fileName}` : doc.fileName;
  };

  return (
    <div className="space-y-6">
      {/* Lender Requirements Banner */}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {selectedLoan.lender} Document Requirements
                  <Badge variant="secondary" className="font-mono">
                    {completedDocs.length}/{funderRequirements.filter(r => r.required).length}
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {funderRequirements.filter(r => r.required).length} required documents for this lender
                  {funderRequirements.filter(r => r.funderSpecific).length > 0 && (
                    <span className="ml-2 text-primary">
                      • {funderRequirements.filter(r => r.funderSpecific).length} lender-specific
                    </span>
                  )}
                </p>
                {funderRequirements.filter(r => r.required && r.funderSpecific).length > 0 && (
                  <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Note:</strong> This lender requires {funderRequirements.filter(r => r.required && r.funderSpecific).length} specific form(s). Make sure to obtain these from the lender's portal or representative.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Management Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2>Document Management</h2>
          <div className="flex items-center gap-2">
            {activeTab === 'completed' && completedDocs.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handleSendToAnalyst}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Analyst
                </Button>
                <Button variant="outline" size="sm" onClick={handleSendToDrive}>
                  <Cloud className="h-4 w-4 mr-2" />
                  Send to Drive
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetDocuments} className="text-destructive hover:text-destructive">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Documents
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {activeTab === 'all' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button onClick={handleUploadClick}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocumentTab)}>
        <TabsList>
          <TabsTrigger value="all">
            All Documents ({summary.all})
          </TabsTrigger>
          <TabsTrigger value="missing">
            Missing ({summary.missing})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({summary.completed})
          </TabsTrigger>
        </TabsList>

        {/* All Documents Tab */}
        <TabsContent value="all" className="mt-6">
          {filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
                </p>
                <Button onClick={handleUploadClick}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header with Icon */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" title={getDisplayName(doc)}>
                            {getDisplayName(doc)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handlePreview(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Category and Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {doc.category}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(doc.status)} className="text-xs">
                          {doc.status}
                        </Badge>
                        {doc.isRequired && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>

                      {/* Notes Preview */}
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{doc.notes}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleOpen(doc)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Open
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Missing Documents Tab */}
        <TabsContent value="missing" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddRequirementDialog(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Custom Requirement
            </Button>
          </div>
          
          {missingDocs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
                <h3 className="mb-2">All Required Documents Complete!</h3>
                <p className="text-muted-foreground">
                  All required documents have been uploaded and assigned.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {missingDocs.map((item) => {
                    const isAssigning = assigningDocId === item.category;
                    const hasUnassignedDocs = unassignedDocs.length > 0;

                    return (
                      <div
                        key={item.category}
                        className={`p-4 ${isAssigning ? 'bg-accent/50' : 'hover:bg-accent/30'} transition-colors`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <XCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">{item.category}</p>
                              <p className="text-sm text-muted-foreground">Stage: {item.stage}</p>
                              
                              {isAssigning && (
                                <div className="mt-3 space-y-2">
                                  <Label className="text-sm">Assign existing document:</Label>
                                  <Select
                                    value={selectedMissingDoc}
                                    onValueChange={setSelectedMissingDoc}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select a document..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unassignedDocs.length === 0 ? (
                                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                          No unassigned documents available
                                        </div>
                                      ) : (
                                        unassignedDocs.map((doc) => (
                                          <SelectItem key={doc.id} value={doc.id}>
                                            <div className="flex items-center gap-2">
                                              <span>{getDisplayName(doc)}</span>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 ml-2"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePreview(doc);
                                                }}
                                              >
                                                <Eye className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  {selectedMissingDoc && (
                                    <div className="mt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                          const doc = unassignedDocs.find(d => d.id === selectedMissingDoc);
                                          if (doc) handlePreview(doc);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Preview Selected Document
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAssigning ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAssigningDocId('');
                                    setSelectedMissingDoc('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAssignDocument(item.category, selectedMissingDoc)}
                                  disabled={!selectedMissingDoc}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Save & Complete
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUploadClick(item.category)}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload New
                                </Button>
                                {hasUnassignedDocs && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setAssigningDocId(item.category)}
                                  >
                                    Assign Existing
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Completed Documents Tab */}
        <TabsContent value="completed" className="mt-6">
          {completedDocs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No completed documents yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Completed Requirements */}
              <div>
                <h3 className="mb-1">Completed Requirements</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Document requirements that have been satisfied and marked as complete.
                </p>

                <div className="space-y-3">
                  {funderRequirements.filter(req => req.required).map((requirement) => {
                    // Find documents assigned to this requirement
                    const docsForCategory = completedDocs.filter(doc => doc.category === requirement.id);
                    
                    if (docsForCategory.length === 0) return null;

                    const categoryIcon = getCategoryIcon(requirement.category);
                    const categoryDisplay = getCategoryDisplayName(requirement.category);

                    return (
                      <Card key={requirement.id} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-lg">{categoryIcon}</span>
                                  <p className="font-medium text-green-700 dark:text-green-400">
                                    {requirement.name}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {categoryDisplay}
                                  </Badge>
                                  {requirement.funderSpecific && (
                                    <Badge variant="default" className="text-xs bg-primary">
                                      {selectedLoan.lender} Specific
                                    </Badge>
                                  )}
                                </div>
                                {requirement.description && (
                                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                    <HelpCircle className="h-3 w-3" />
                                    {requirement.description}
                                  </p>
                                )}
                                
                                <p className="text-sm text-green-600 dark:text-green-400 mb-3">
                                  Assigned documents:
                                </p>

                                {/* Assigned Documents */}
                                <div className="space-y-2">
                                  {docsForCategory.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                                    >
                                      <FileText className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                                      <span className="flex-1 text-sm text-green-700 dark:text-green-300 truncate" title={getDisplayName(doc)}>
                                        {getDisplayName(doc)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                                        onClick={() => handlePreview(doc)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        onClick={() => handleRemoveAssignment(doc.id, requirement.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Unmark Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => {
                                docsForCategory.forEach(doc => handleUnmarkDocument(doc.id));
                              }}
                            >
                              Unmark
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document for {selectedLoan.borrowerName}'s loan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {uploadForm.file ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                  <p className="font-medium">{uploadForm.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(uploadForm.file.size)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadForm({ ...uploadForm, file: null })}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    PDF, Word, Excel, or Images
                  </p>
                  <Input
                    type="file"
                    className="hidden"
                    id="file-upload"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </div>

            {/* Custom Name Field */}
            <div className="space-y-2">
              <Label>Custom Name (Optional)</Label>
              <Input
                placeholder="e.g., Articles of Origination"
                value={uploadForm.customName}
                onChange={(e) => setUploadForm({ ...uploadForm, customName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {uploadForm.customName && uploadForm.file
                  ? `Will be saved as: ${uploadForm.customName} - ${uploadForm.file.name}`
                  : 'If provided, file will be named "Custom Name - Original Filename"'}
              </p>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <Label>Document Category *</Label>
              <Select
                value={uploadForm.category}
                onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Required</div>
                  {requiredDocs.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <Separator className="my-1" />
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Other</div>
                  <SelectItem value="Contracts">Contracts</SelectItem>
                  <SelectItem value="Invoices">Invoices</SelectItem>
                  <SelectItem value="Receipts">Receipts</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this document..."
                value={uploadForm.notes}
                onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUploadSubmit}
                disabled={!uploadForm.file || !uploadForm.category}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Custom Requirement Dialog */}
      <Dialog open={showAddRequirementDialog} onOpenChange={setShowAddRequirementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Document Requirement</DialogTitle>
            <DialogDescription>
              Add a custom document requirement that will appear in the missing documents list
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Requirement Name *</Label>
              <Input
                placeholder="e.g., Property Survey, Phase 1 Environmental Report"
                value={customRequirementForm.name}
                onChange={(e) => setCustomRequirementForm({ ...customRequirementForm, name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                This will appear in the missing documents list until fulfilled
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Add notes about this requirement..."
                value={customRequirementForm.description}
                onChange={(e) => setCustomRequirementForm({ ...customRequirementForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddRequirementDialog(false);
                  setCustomRequirementForm({
                    name: '',
                    category: 'Other',
                    description: '',
                  });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddCustomRequirement}>
                <FileText className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>
              {previewDocument && getDisplayName(previewDocument)}
            </DialogDescription>
          </DialogHeader>

          {previewDocument && (
            <div className="space-y-4">
              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Original Filename</Label>
                  <p className="text-sm">{previewDocument.fileName}</p>
                </div>
                {previewDocument.customName && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Custom Name</Label>
                    <p className="text-sm">{previewDocument.customName}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <p className="text-sm">{previewDocument.category}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">File Size</Label>
                  <p className="text-sm">{formatFileSize(previewDocument.fileSize)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Badge variant={getStatusBadgeVariant(previewDocument.status)} className="text-xs">
                    {previewDocument.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Uploaded</Label>
                  <p className="text-sm">{previewDocument.uploadedAt}</p>
                </div>
                {previewDocument.isRequired && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Type</Label>
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  </div>
                )}
              </div>

              {/* Notes */}
              {previewDocument.notes && (
                <div>
                  <Label className="text-sm text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded">{previewDocument.notes}</p>
                </div>
              )}

              <Separator />

              {/* Preview Area */}
              <div className="border rounded-lg p-8 bg-muted/20 min-h-[300px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">Document Preview</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Preview functionality coming soon
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      File type: {previewDocument.fileType || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDownload(previewDocument)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleOpen(previewDocument);
                    setShowPreviewDialog(false);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open Full View
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper functions
function getDocumentStage(category: string): string {
  const stageMap: Record<string, string> = {
    'Application': 'Initial',
    'Income Verification': 'Documents',
    'Tax Returns': 'Documents',
    'Bank Statements': 'Documents',
    'Credit Report': 'Review',
    'Appraisal': 'Underwriting',
    'Title Report': 'Closing',
    'Insurance': 'Closing',
    'Purchase Agreement': 'Initial',
  };
  return stageMap[category] || 'Documents';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
