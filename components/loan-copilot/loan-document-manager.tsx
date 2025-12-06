'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, FolderOpen, File, FileText, Image, Download, 
  Trash2, Eye, Search, Plus, ExternalLink, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface LoanDocumentManagerProps {
  dealId: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  size: number;
  uploadedAt: string;
  url?: string;
}

const DOCUMENT_CATEGORIES = [
  { key: 'borrower', label: 'Borrower Documents', icon: FileText },
  { key: 'property', label: 'Property Documents', icon: File },
  { key: 'financial', label: 'Financial Documents', icon: FileText },
  { key: 'legal', label: 'Legal Documents', icon: FileText },
  { key: 'lender', label: 'Lender Documents', icon: File },
  { key: 'other', label: 'Other', icon: File },
];

export default function LoanDocumentManager({ dealId }: LoanDocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [dealId]);

  const loadDocuments = async () => {
    // TODO: Implement document loading from API
    // For now, show placeholder
    setDocuments([]);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    toast.info('Document upload coming soon - integrate with Google Drive');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return Image;
    if (type.includes('pdf')) return FileText;
    return File;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Document Manager</h2>
          <p className="text-sm text-muted-foreground">
            Manage all loan-related documents in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Open in Drive
          </Button>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Documents
            <input
              type="file"
              multiple
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <Button
              key={cat.key}
              variant={selectedCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.key)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      {filteredDocuments.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload documents or connect to Google Drive to get started
            </p>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload First Document
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {filteredDocuments.map((doc) => {
            const FileIcon = getFileIcon(doc.type);
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded">
                      <FileIcon className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                      <p className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{doc.category}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

