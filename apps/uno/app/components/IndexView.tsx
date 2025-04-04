import React, { useState, useEffect } from 'react';
import { Progress } from "./ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/Button";
import { Loader2, Search, FileText, AlertCircle, Play } from 'lucide-react';
import { CodePanel } from './code-panel/CodePanel';
import { useCodePanel } from '../context/code-panel-context';
import { cn } from '../../lib/utils';

interface IndexResult {
  filePath: string;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  error?: string;
  progress?: number;
}

interface IndexViewProps {
  onSearch?: (query: string) => void;
}

// Renamed original component to IndexViewContent and moved logic here
const IndexViewContent: React.FC<IndexViewProps> = ({ onSearch }) => {
  const [indexResults, setIndexResults] = useState<IndexResult[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Get isSyncMode from context instead of local state
  const { setIsOpen, setCurrentFile, isSyncMode } = useCodePanel(); 

  const startIndexing = async () => {
    setIsInitializing(true);
    try {
      if (window.electron?.startIndexing) {
        await window.electron.startIndexing();
      } else {
        throw new Error('Indexing API not available');
      }
    } catch (error) {
      console.error('Failed to start indexing:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Subscribe to indexing events from the electron main process
    const handleIndexingStart = () => {
      setIsIndexing(true);
      setOverallProgress(0);
    };

    const handleIndexingProgress = (data: { filePath: string; progress: number }) => {
      setIndexResults(prev => {
        const newResults = [...prev];
        const existingIndex = newResults.findIndex(r => r.filePath === data.filePath);
        
        if (existingIndex >= 0) {
          newResults[existingIndex] = {
            ...newResults[existingIndex],
            status: 'processing',
            progress: data.progress
          };
        } else {
          newResults.push({
            filePath: data.filePath,
            status: 'processing',
            progress: data.progress
          });
        }

        // Calculate overall progress
        const totalProgress = newResults.reduce((acc, curr) => acc + (curr.progress || 0), 0);
        const overallProgress = totalProgress / newResults.length;
        setOverallProgress(overallProgress);

        return newResults;
      });
    };

    const handleIndexingComplete = (data: { filePath: string }) => {
      setIndexResults(prev => {
        const newResults = [...prev];
        const existingIndex = newResults.findIndex(r => r.filePath === data.filePath);
        
        if (existingIndex >= 0) {
          newResults[existingIndex] = {
            ...newResults[existingIndex],
            status: 'indexed',
            progress: 100
          };
        }

        // Check if all files are indexed
        const allIndexed = newResults.every(r => r.status === 'indexed');
        if (allIndexed) {
          setIsIndexing(false);
          setOverallProgress(100);
        }

        return newResults;
      });
    };

    const handleIndexingError = (data: { filePath: string; error: string }) => {
      setIndexResults(prev => {
        const newResults = [...prev];
        const existingIndex = newResults.findIndex(r => r.filePath === data.filePath);
        
        if (existingIndex >= 0) {
          newResults[existingIndex] = {
            ...newResults[existingIndex],
            status: 'error',
            error: data.error
          };
        } else {
          newResults.push({
            filePath: data.filePath,
            status: 'error',
            error: data.error
          });
        }

        return newResults;
      });
    };

    // Subscribe to events
    if (window.electron?.onIndexingStart) {
      window.electron.onIndexingStart(handleIndexingStart);
    }
    if (window.electron?.onIndexingProgress) {
      window.electron.onIndexingProgress(handleIndexingProgress);
    }
    if (window.electron?.onIndexingComplete) {
      window.electron.onIndexingComplete(handleIndexingComplete);
    }
    if (window.electron?.onIndexingError) {
      window.electron.onIndexingError(handleIndexingError);
    }

    // Cleanup subscriptions
    return () => {
      if (window.electron?.removeIndexingStartListener) {
        window.electron.removeIndexingStartListener(handleIndexingStart);
      }
      if (window.electron?.removeIndexingProgressListener) {
        window.electron.removeIndexingProgressListener(handleIndexingProgress);
      }
      if (window.electron?.removeIndexingCompleteListener) {
        window.electron.removeIndexingCompleteListener(handleIndexingComplete);
      }
      if (window.electron?.removeIndexingErrorListener) {
        window.electron.removeIndexingErrorListener(handleIndexingError);
      }
    };
  }, []);

  const getStatusIcon = (status: IndexResult['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'indexed':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Search className="h-4 w-4 text-gray-500" />;
    }
  };

  // Return the JSX previously returned by IndexView
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Indexing Progress</CardTitle>
              <CardDescription>
                {isIndexing 
                  ? `Indexing in progress (${Math.round(overallProgress)}%)`
                  : overallProgress === 100 
                    ? 'All files indexed successfully'
                    : 'Ready to start indexing'}
              </CardDescription>
            </div>
            <Button 
              onClick={startIndexing} 
              disabled={isIndexing || isInitializing}
            >
              {isInitializing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isInitializing ? 'Initializing...' : 'Start Indexing'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress 
              value={overallProgress} 
              className="w-full h-2"
            />
            <p className="text-xs text-muted-foreground text-right">
              {indexResults.length} file{indexResults.length !== 1 ? 's' : ''} processed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results List Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Files</CardTitle>
            <CardDescription>
              {indexResults.length 
                ? `${indexResults.length} file${indexResults.length !== 1 ? 's' : ''} processed`
                : 'No files processed yet'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {indexResults.length > 0 ? (
                indexResults.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg bg-muted/50",
                      isSyncMode && "cursor-pointer hover:bg-muted" 
                    )}
                    onClick={() => {
                      if (isSyncMode) {
                        setCurrentFile(result.filePath);
                        setIsOpen(true);
                      }
                    }}
                  >
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{result.filePath}</p>
                      {result.error && (
                        <p className="text-xs text-red-500 truncate">{result.error}</p>
                      )}
                    </div>
                    {result.status === 'processing' && result.progress !== undefined && (
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={result.progress} 
                          className="w-20 h-1"
                        />
                        <span className="text-xs text-muted-foreground min-w-[2.5rem] text-right">
                          {Math.round(result.progress)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Click "Start Indexing" to begin processing files
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

// IndexView now just renders IndexViewContent and CodePanel (which is also rendered globally now, consider removing from here)
const IndexView: React.FC<IndexViewProps> = ({ onSearch }) => {
  return (
    <>
      <IndexViewContent onSearch={onSearch} />
      {/* CodePanel is now rendered globally in app.tsx, so we remove it from here */}
      {/* <CodePanel /> */}
    </>
  );
};

export default IndexView;