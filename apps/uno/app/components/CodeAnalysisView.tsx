import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, CheckCircle, Info, TriangleAlert, ShieldAlert } from 'lucide-react'; // Icons for severity
// Import Tabs components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"; 
import IndexView from './IndexView';

// --- Updated Types --- 
// No location/context/severity, add analyzer/line/diagnostic
interface AnalysisResultItem {
    type: 'error' | 'warning' | 'info'; // Specific union
    analyzer: string; // Added
    line: number;     // Added (0 for project/file level)
    message: string;
    diagnostic?: any; // Added diagnostic
}

// NEW: Define the structure for files within an analyzer category
interface AnalyzerFileData {
    [filePath: string]: AnalysisResultItem[];
}

// UPDATED: AnalysisData is now categorized by analyzer name
interface AnalysisData {
    [analyzerName: string]: AnalyzerFileData;
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
            // Directly parse the new categorized structure
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
    const { overviewSummary, categorizedResults } = useMemo(() => {
        if (!analysisData) {
            // Return empty structure with all categories initialized
            return { 
                overviewSummary: {}, 
                categorizedResults: {
                    quality: {},
                    security: {},
                    performance: {},
                    other: {}
                }
            }; 
        }

        const summary: { [analyzerName: string]: { errors: number; warnings: number; info: number; total: number } } = {};
        // Use a structure to hold categorized results for tabs
        const categorized: { [category: string]: AnalysisData } = {
            quality: {}, // Primarily 'eslint' results
            security: {}, // 'secrets', 'dependency-vulnerability'
            performance: {}, // Example: 'sync-fs' (can be customized)
            other: {}, // Any other analyzers
        };
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;

        // Iterate through analyzers in the data
        Object.entries(analysisData).forEach(([analyzerName, filesMap]) => {
            // Initialize summary for the analyzer
            if (!summary[analyzerName]) {
                summary[analyzerName] = { errors: 0, warnings: 0, info: 0, total: 0 };
            }
            
            let category: keyof typeof categorized = 'other'; // Default category
            if (analyzerName === 'eslint') {
                category = 'quality';
            } else if (analyzerName === 'secrets' || analyzerName === 'dependency-vulnerability') {
                category = 'security';
            } else if (analyzerName === 'sync-fs') { // Example performance category
                category = 'performance';
            }
            
            // Ensure the analyzer category exists in the categorized results
            if (!categorized[category][analyzerName]) {
                 categorized[category][analyzerName] = {};
            }

            // Iterate through files for this analyzer
            Object.entries(filesMap).forEach(([filePath, items]) => {
                
                // Add file data to the correct category
                 categorized[category][analyzerName][filePath] = items; 
                 
                // Calculate summary counts for this analyzer based on items in this file
                items.forEach(item => {
                    summary[analyzerName].total++;
                    if (item.type === 'error') {
                        summary[analyzerName].errors++;
                        totalErrors++;
                    } else if (item.type === 'warning') {
                        summary[analyzerName].warnings++;
                        totalWarnings++;
                    } else {
                        summary[analyzerName].info++;
                        totalInfo++;
                    }
                });
            });
        });

        // Debug Log:
        console.log("[CodeAnalysisView useMemo] Processed Categorized Results:", JSON.stringify(categorized, null, 2));

        return { 
            overviewSummary: { summary, totalErrors, totalWarnings, totalInfo }, 
            categorizedResults: categorized // Return the categorized structure
        };
    }, [analysisData]);

    // --- Helper to get severity icon --- 
    const getSeverityIcon = (type: AnalysisResultItem['type'], analyzer?: string) => {
        if (analyzer === 'secrets-detector' || analyzer === 'dependency-vulnerability') {
            if (type === 'error') return <ShieldAlert className="h-4 w-4 text-red-600 mr-2 flex-shrink-0" />;
            if (type === 'warning') return <ShieldAlert className="h-4 w-4 text-yellow-600 mr-2 flex-shrink-0" />;
        }

        switch (type) {
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
                         {getSeverityIcon(item.type, item.analyzer)}
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

    // --- Renders collapsible sections for a given category of results ---
    // Data structure passed is: { [analyzerName: string]: { [filePath: string]: AnalysisResultItem[] } }
    const renderFileSections = (categoryData: AnalysisData | undefined, tabName?: string) => {
        if (!categoryData || Object.keys(categoryData).length === 0) {
             return <div className="p-4 text-center text-muted-foreground text-sm">No issues found for this category.</div>;
        }
        
        // Get sorted analyzer names within the category
        const sortedAnalyzers = Object.keys(categoryData).sort();

        return sortedAnalyzers.map((analyzerName) => {
            const filesMap = categoryData[analyzerName];
            if (!filesMap || Object.keys(filesMap).length === 0) return null;
            
            // Get sorted file paths for this analyzer
            const sortedFiles = Object.keys(filesMap).sort();

            return (
                // Add a top-level section for the analyzer
                <div key={analyzerName} className="mb-4 border border-border rounded">
                    <h3 className="text-sm font-semibold p-2 bg-muted border-b border-border">{analyzerName}</h3>
                    {sortedFiles.map((filePath) => {
                        const items = filesMap[filePath];
                        if (!items || items.length === 0) return null; 

                        return (
                            <details key={`${analyzerName}-${filePath}`} className="border-b border-border last:border-b-0 group" open>
                                <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/80 text-sm font-medium list-none">
                                    <span>{filePath}</span>
                                    <span className="text-xs px-1.5 py-0.5 bg-background rounded-full">
                                        {items.length} issue(s)
                                    </span>
                                </summary>
                                {renderIssueList(items)} {/* Use existing function to render items */}
                            </details>
                        );
                    })}
                </div>
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
            return <div className="p-4 text-center">Loading analysis results...</div>;
        }
        if (error) {
            return <div className="p-4 text-center text-red-500">{error}</div>;
        }
        if (!analysisData) {
            return <div className="p-4 text-center text-muted-foreground">No analysis results found. Run analysis first.</div>;
        }

        // Tabbed Interface
        return (
            <Tabs defaultValue="index" className="w-full">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="index">Index</TabsTrigger>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="quality">Code Quality</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                </TabsList>

                <TabsContent value="index" className="mt-4">
                    <IndexView />
                </TabsContent>

                <TabsContent value="overview" className="mt-4">
                    {renderOverview()}
                </TabsContent>

                <TabsContent value="quality" className="mt-4">
                    {renderFileSections(categorizedResults.quality, 'quality')}
                </TabsContent>

                <TabsContent value="security" className="mt-4">
                    {renderFileSections(categorizedResults.security, 'security')}
                </TabsContent>

                <TabsContent value="performance" className="mt-4">
                    {renderFileSections(categorizedResults.performance, 'performance')}
                </TabsContent>

                <TabsContent value="other" className="mt-4">
                    {renderFileSections(categorizedResults.other, 'other')}
                </TabsContent>
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