import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-react'; // Icons for severity

// --- Types mirroring analysis-results.json structure --- 
interface AnalysisLocation {
    start: { row: number; column: number };
    end: { row: number; column: number };
}

interface AnalysisResultItem {
    type: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    location?: AnalysisLocation;
    context?: Record<string, any>;
}

interface AnalysisData {
    analyzedAt: string; 
    results: { [filePath: string]: AnalysisResultItem[] };
}

interface FileChangeData { // Re-defined here for clarity, or import if shared
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
}

// --- Config --- 
// Assume the JSON file is at the project root for now
const ANALYSIS_RESULTS_PATH = './analysis-results.json'; 

// --- Component --- 
const CodeAnalysisView: React.FC = () => {
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [absoluteAnalysisPath, setAbsoluteAnalysisPath] = useState<string | null>(null);

    // Function to fetch and parse the analysis results
    const fetchAnalysisData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // In Electron, we need to ask the main process to read the file
            if (!window.electron?.readFile) {
                throw new Error("File reading API not available.");
            }
            const fileContent = await window.electron.readFile(ANALYSIS_RESULTS_PATH);
            if (fileContent === null) {
                 throw new Error(`Analysis results file not found or could not be read: ${ANALYSIS_RESULTS_PATH}`);
            }
            const parsedData: AnalysisData = JSON.parse(fileContent);
            setAnalysisData(parsedData);
            
            // Get the absolute path for watcher comparison
            if (window.electron?.resolvePath) {
                const absPath = await window.electron.resolvePath(ANALYSIS_RESULTS_PATH);
                setAbsoluteAnalysisPath(absPath);
            }

        } catch (err: any) {
            console.error("Error fetching analysis data:", err);
            setError(err.message || 'Failed to load analysis results');
            setAnalysisData(null); // Clear data on error
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchAnalysisData();
    }, [fetchAnalysisData]);

    // --- Add useEffect for file watching --- 
    useEffect(() => {
        // Only set up watcher if we successfully resolved the absolute path
        if (!absoluteAnalysisPath || !window.electron?.onFileChanged || !window.electron?.removeFileChangedListener) {
            if (!absoluteAnalysisPath && !loading) { // Avoid warning during initial load
                 console.warn("File watching for analysis results skipped: absolute path or Electron API not available.");
            }
            return; // Cannot set up watcher
        }

        console.log(`Setting up watcher for: ${absoluteAnalysisPath}`);

        const handleAnalysisFileChange = (data: FileChangeData) => {
            // Check if the changed file path matches the absolute path of our JSON file
             if (data.path === absoluteAnalysisPath) {
                console.log(`Change detected in ${absoluteAnalysisPath}, reloading analysis data...`);
                // Re-fetch the data when the file changes
                fetchAnalysisData(); 
            } else {
                 // Log other changes if needed for debugging, but don't reload
                 // console.log(`Ignoring change in ${data.path}`);
            }
        };

        // Register the listener
        window.electron.onFileChanged(handleAnalysisFileChange);
        console.log("Analysis file change listener attached.");

        // Return cleanup function
        return () => {
            console.log("Removing analysis file change listener...");
            window.electron.removeFileChangedListener(handleAnalysisFileChange);
            console.log("Analysis file change listener removed.");
        };

    }, [absoluteAnalysisPath, fetchAnalysisData, loading]); // Re-run if path changes or fetch function changes

    // --- Helper to get severity icon --- 
    const getSeverityIcon = (severity: AnalysisResultItem['severity']) => {
        switch (severity) {
            case 'error': return <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />;
            case 'warning': return <TriangleAlert className="h-4 w-4 text-yellow-500 mr-2 flex-shrink-0" />;
            case 'info': return <Info className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />;
            default: return null;
        }
    };

    // --- Render Logic --- 
    const renderContent = () => {
         if (loading) {
            return <div className="p-4 text-center text-muted-foreground">Loading analysis results...</div>;
        }
        if (error) {
            return (
                 <div className="p-4 text-red-500 flex flex-col items-center">
                     <AlertCircle className="h-6 w-6 mb-2" />
                     <p className="font-semibold">Error loading results:</p>
                     <p className="text-xs mt-1">{error}</p>
                     {/* Add a retry button? */}
                 </div>
             );
        }
        if (!analysisData || Object.keys(analysisData.results).length === 0) {
            return <div className="p-4 text-center text-muted-foreground">No analysis results found or file is empty. Run analysis first.</div>;
        }

        const sortedFiles = Object.keys(analysisData.results).sort();

        return (
             <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted pr-1">
                 <p className="text-xs text-muted-foreground px-2 pb-2 border-b border-border">
                     Analyzed at: {new Date(analysisData.analyzedAt).toLocaleString()}
                 </p>
                 {sortedFiles.map((filePath) => {
                     const items = analysisData.results[filePath];
                     if (!items || items.length === 0) return null; // Don't render files with no issues

                     return (
                         <details key={filePath} className="border-b border-border last:border-b-0 group" open>
                             <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted text-sm font-medium list-none">
                                 <span>{filePath}</span>
                                 <span className="text-xs px-1.5 py-0.5 bg-muted rounded-full">
                                     {items.length} issue(s)
                                 </span>
                             </summary>
                             <ul className="pl-4 pr-2 pb-2 text-xs bg-background/50">
                                 {items.sort((a, b) => (a.location?.start.row ?? 0) - (b.location?.start.row ?? 0)).map((item, index) => (
                                     <li key={index} className="flex items-start py-1 border-t border-border/50 first:border-t-0">
                                         {getSeverityIcon(item.severity)}
                                         <div className="flex-grow">
                                             <span className="text-muted-foreground mr-2">
                                                 {item.location ? `L${item.location.start.row + 1}:${item.location.start.column + 1}` : 'Global'}
                                                 {` [${item.type}]`}
                                             </span>
                                             <span>{item.message}</span>
                                             {item.context && (
                                                <pre className="mt-1 text-muted-foreground/70 text-[0.7rem] bg-muted/50 p-1 rounded">
                                                    {JSON.stringify(item.context)}
                                                </pre>
                                             )}
                                         </div>
                                     </li>
                                 ))}
                             </ul>
                         </details>
                     );
                 })}
             </div>
         );
    }

    return (
        <div className="flex flex-col h-full bg-white text-foreground font-mono">
             <h2 className="p-2 text-sm font-semibold border-b border-border sticky top-0 bg-white z-10">
                 Code Analysis Overview
             </h2>
             {renderContent()}
        </div>
    );
};

export default CodeAnalysisView; 