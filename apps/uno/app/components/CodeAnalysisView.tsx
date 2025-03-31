import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-react'; // Icons for severity
// Import Tabs components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"; 

// --- Updated Types --- 
// No location/context/severity, add analyzer/line/diagnostic
interface AnalysisResultItem {
    type: 'error' | 'warning' | 'info'; // Specific union
    analyzer: string; // Added
    line: number;     // Added (0 for project/file level)
    message: string;
    diagnostic?: any; // Added diagnostic
}

interface AnalysisData {
    // Keep analysisData structure as is, assuming it matches the JSON file output 
    // which uses filePath as key and the updated AnalysisResultItem[] as value.
    [filePath: string]: AnalysisResultItem[]; 
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
    // Store analyzedAt separately if needed, or assume it's not in the main results map
    const [analyzedAt, setAnalyzedAt] = useState<string | null>(null); 

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
            // Assuming the root of the JSON is the map now, handle potential metadata separately if needed
            const parsedData: AnalysisData = JSON.parse(fileContent); 
            // Example: If JSON root was { analyzedAt: '...', results: { ... } }
            // const fullParsedData = JSON.parse(fileContent);
            // const parsedData: AnalysisData = fullParsedData.results; 
            // setAnalyzedAt(fullParsedData.analyzedAt); 
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
            setAnalyzedAt(null);
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

    // --- Memoized calculation for overview and filtered results ---
    const { overviewSummary, codeQualityResults, dependencyResults } = useMemo(() => {
        if (!analysisData) {
            return { overviewSummary: {}, codeQualityResults: {}, dependencyResults: {} };
        }

        const summary: { [key: string]: { errors: number; warnings: number; info: number; total: number } } = {};
        const quality: AnalysisData = {};
        const dependencies: AnalysisData = {};
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;

        Object.entries(analysisData).forEach(([filePath, items]) => {
            const fileQualityItems: AnalysisResultItem[] = [];
            const fileDependencyItems: AnalysisResultItem[] = [];

            items.forEach(item => {
                // Initialize summary for the analyzer if not present
                if (!summary[item.analyzer]) {
                    summary[item.analyzer] = { errors: 0, warnings: 0, info: 0, total: 0 };
                }
                
                summary[item.analyzer].total++;
                if (item.type === 'error') {
                    summary[item.analyzer].errors++;
                    totalErrors++;
                } else if (item.type === 'warning') {
                    summary[item.analyzer].warnings++;
                    totalWarnings++;
                } else {
                    summary[item.analyzer].info++;
                    totalInfo++;
                }

                // Separate results for tabs
                if (item.analyzer === 'dependency-vulnerability') {
                     // Use a consistent key like 'package.json' for dependency results
                     if (!dependencies['package.json']) dependencies['package.json'] = [];
                    dependencies['package.json'].push(item);
                } else if (item.analyzer !== 'cli' && item.analyzer !== 'CodeAnalytics Core') { // Exclude CLI/Core errors from quality tab
                    if (!quality[filePath]) quality[filePath] = [];
                    quality[filePath].push(item);
                } 
                // CLI/Core errors will appear in the overview counts but not specific tabs unless handled otherwise
            });
        });

        return { 
            overviewSummary: { summary, totalErrors, totalWarnings, totalInfo }, 
            codeQualityResults: quality, 
            dependencyResults: dependencies 
        };
    }, [analysisData]);

    // --- Helper to get severity icon --- 
    const getSeverityIcon = (severity: AnalysisResultItem['type']) => {
        switch (severity) {
            case 'error': return <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />;
            case 'warning': return <TriangleAlert className="h-4 w-4 text-yellow-500 mr-2 flex-shrink-0" />;
            case 'info': return <Info className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />;
            default: return null;
        }
    };

    // --- Renders list of issues for a given file path and items ---
    const renderIssueList = (items: AnalysisResultItem[]) => {
        if (!items || items.length === 0) return null;
        
        return (
             <ul className="pl-4 pr-2 pb-2 text-xs bg-background/50">
                 {items.sort((a, b) => a.line - b.line).map((item, index) => ( // Sort by line
                     <li key={index} className="flex items-start py-1 border-t border-border/50 first:border-t-0">
                         {getSeverityIcon(item.type)}
                         <div className="flex-grow">
                             <span className="text-muted-foreground mr-2">
                                 {`L${item.line}`} {/* Use line directly */}
                                 {` [${item.analyzer}]`} {/* Show analyzer */}
                             </span>
                             <span>{item.message}</span>
                             {item.diagnostic && ( // Use diagnostic
                                <pre className="mt-1 text-muted-foreground/70 text-[0.7rem] bg-muted/50 p-1 rounded">
                                    {JSON.stringify(item.diagnostic)}
                                </pre>
                             )}
                         </div>
                     </li>
                 ))}
             </ul>
        );
    };

    // --- Renders collapsible file sections for Quality/Dependency tabs ---
    const renderFileSections = (data: AnalysisData) => {
        const sortedFiles = Object.keys(data).sort();
         if (sortedFiles.length === 0) {
             return <div className="p-4 text-center text-muted-foreground text-sm">No issues found for this category.</div>;
         }

        return sortedFiles.map((filePath) => {
            const items = data[filePath];
            if (!items || items.length === 0) return null; 

            return (
                <details key={filePath} className="border-b border-border last:border-b-0 group" open>
                    <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted text-sm font-medium list-none">
                        <span>{filePath}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded-full">
                            {items.length} issue(s)
                        </span>
                    </summary>
                    {renderIssueList(items)}
                </details>
            );
        });
    };
    
    // --- Render Overview Tab Content ---
     const renderOverview = () => {
         const { summary, totalErrors, totalWarnings, totalInfo } = overviewSummary;
         // Add checks for potentially undefined values from useMemo initial state
         if (summary === undefined || totalErrors === undefined || totalWarnings === undefined || totalInfo === undefined) {
             return <div className="p-4 text-center text-muted-foreground text-sm">Calculating overview...</div>; // Or handle appropriately
         }

         const totalIssues = totalErrors + totalWarnings + totalInfo;

         if (totalIssues === 0) {
             return <div className="p-4 text-green-600 flex items-center"><CheckCircle className="h-4 w-4 mr-2"/>No issues found.</div>;
         }

         return (
             <div className="p-4 space-y-2 text-sm">
                 <p className="font-semibold">Analysis Summary:</p>
                 <div className="flex space-x-4">
                     <span className="text-red-500">Errors: {totalErrors}</span>
                     <span className="text-yellow-500">Warnings: {totalWarnings}</span>
                     <span className="text-blue-500">Info: {totalInfo}</span>
                 </div>
                 <p className="font-semibold pt-2">Issues by Analyzer:</p>
                 {/* Check if summary is not empty before mapping */} 
                 {Object.keys(summary).length > 0 ? (
                     <ul className="list-disc pl-5 space-y-1 text-xs">
                         {Object.entries(summary).map(([analyzerName, counts]) => (
                             <li key={analyzerName}>
                                 <span className="font-medium">{analyzerName}:</span> {counts.total} issue(s) 
                                 ({counts.errors > 0 ? <span className="text-red-500">{counts.errors}E</span> : ''}
                                 {counts.warnings > 0 ? <span className="text-yellow-500 ml-1">{counts.warnings}W</span> : ''}
                                 {counts.info > 0 ? <span className="text-blue-500 ml-1">{counts.info}I</span> : ''})
                             </li>
                         ))}
                     </ul>
                    ) : (
                        <p className="text-xs text-muted-foreground">No specific analyzer data available.</p>
                    )}
             </div>
         );
     };

    // --- Render Logic (Main component render) --- 
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
        if (!analysisData) {
            return <div className="p-4 text-center text-muted-foreground">No analysis results found. Run analysis first.</div>;
        }

        // Tabbed Interface
        return (
             <Tabs defaultValue="overview" className="flex-grow flex flex-col overflow-hidden">
                 <TabsList className="shrink-0 border-b border-border rounded-none px-2 justify-start bg-muted/30">
                     <TabsTrigger value="overview">Overview</TabsTrigger>
                     <TabsTrigger value="quality">Code Quality</TabsTrigger>
                     <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                 </TabsList>
                 <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted">
                     <TabsContent value="overview">
                         {renderOverview()}
                     </TabsContent>
                     <TabsContent value="quality">
                         {renderFileSections(codeQualityResults)}
                     </TabsContent>
                     <TabsContent value="dependencies">
                         {renderFileSections(dependencyResults)}
                     </TabsContent>
                 </div>
             </Tabs>
         );
    }

    return (
        <div className="flex flex-col h-full bg-background text-foreground text-sm">
            <h2 className="p-2 font-semibold border-b border-border shrink-0">
                Code Analysis
            </h2>
            {renderContent()}
        </div>
    );
};

export default CodeAnalysisView; 