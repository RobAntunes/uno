import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Folder, FileText, ArrowUp, AlertCircle, FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
// Trying a relative path for Button - adjust if your Shadcn setup differs
import { Button } from '../../components/ui/Button';

// Define types matching the main process and preload script
interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirectoryListing {
  path: string;
  entries: FSEntry[];
}

interface FileChangeData {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
}

interface Breadcrumb {
    name: string;
    path: string;
}

// --- Helper Function to build breadcrumbs (Simplified for Renderer) ---
const buildBreadcrumbs = (currentPath: string | null): Breadcrumb[] => {
    if (!currentPath) return [{ name: 'Root', path: '.' }];

    // Assume '/' as separator, which Electron/Node usually normalizes to.
    // The absolute paths returned from the main process should be consistent.
    const parts = currentPath.split('/').filter(Boolean);

    // Handle absolute root case
    if (currentPath === '/' && parts.length === 0) {
        return [{ name: 'Root', path: '/' }];
    }
    // Handle relative root '.' (should ideally be resolved to absolute by main process, but handle defensively)
    if (currentPath === '.') {
        return [{ name: 'Root', path: '.' }];
    }

    const breadcrumbs: Breadcrumb[] = [{ name: 'Root', path: '.' }]; // Start with relative root for navigation

    let cumulativePath = '';
    parts.forEach((part) => {
        // Simple join with '/'. Main process should handle complexities.
        cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
        // Handle potential absolute paths starting with /
        if (currentPath.startsWith('/') && breadcrumbs.length === 1 && !cumulativePath.startsWith('/')) {
             cumulativePath = '/' + cumulativePath;
        }
        breadcrumbs.push({ name: part, path: cumulativePath });
    });

    // Ensure the root path is correct based on the original path type
    if (currentPath.startsWith('/')) {
        breadcrumbs[0] = { name: 'Root', path: '/' };
    } else {
         breadcrumbs[0] = { name: 'Root', path: '.' };
    }

    return breadcrumbs;
};

// --- Helper to get parent directory path (Simplified for Renderer) ---
const getParentPath = (filePath: string | null): string => {
    if (!filePath || filePath === '.' || filePath === '/') return '.'; // Cannot go up from root

    // Find the last '/'
    const lastSlashIndex = filePath.lastIndexOf('/');

    // If no slash or it's the only character (root), return root
    if (lastSlashIndex <= 0) {
        return filePath.startsWith('/') ? '/' : '.';
    }

    // Return the substring before the last slash
    return filePath.substring(0, lastSlashIndex);
};


const FileExplorer: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string | null>('.'); // Start at root '.'
  const [entries, setEntries] = useState<FSEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch directory contents
  const fetchDirectory = useCallback(async (dirPath: string) => {
    if (!window.electron?.readDirectory) {
        setError("File system API not available.");
        return;
    }
    // Removed pathModule check
    console.log(`Fetching directory: ${dirPath}`);
    setLoading(true);
    setError(null);
    try {
      const listing: DirectoryListing = await window.electron.readDirectory(dirPath);
      console.log("Received listing:", listing);
      // Trust the path returned by the main process
      setCurrentPath(listing.path);
      setEntries(listing.entries);
    } catch (err: any) {
      console.error("Error fetching directory:", err);
      setError(err.message || 'Failed to read directory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handler for clicking on a file or directory
  const handleEntryClick = (entry: FSEntry) => {
    if (entry.isDirectory) {
        if (entry.name === '..') {
             // Handle "Up" navigation
             fetchDirectory(entry.path);
        } else {
            // Navigate into the directory
            fetchDirectory(entry.path);
        }
    } else {
      // Handle file click
      console.log(`File clicked: ${entry.path}`);
      alert(`File selected: ${entry.name}`);
    }
  };

  // Handler for clicking on breadcrumbs
  const handleBreadcrumbClick = (pathToGo: string) => {
      fetchDirectory(pathToGo);
  };

  // Initial load
  useEffect(() => {
    // Delay initial fetch slightly to potentially avoid startup race conditions
    const timer = setTimeout(() => {
      fetchDirectory('.');
    }, 500); // 500ms delay

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, [fetchDirectory]);

  // Set up file change listener
  useEffect(() => {
    console.log("Setting up file change listener...");

    // Define the handler function
    const handleFileChange = (data: FileChangeData) => {
        console.log('File change detected:', data);

        if (!currentPath) return; // Should not happen if loaded

        // Simplified refresh logic:
        // 1. Refresh if the changed item *is* the current directory.
        // 2. Refresh if the changed item is directly *inside* the current directory.
        const parentOfChange = getParentPath(data.path);

        if (data.path === currentPath || parentOfChange === currentPath) {
            console.log(`Change detected in/at current directory (${currentPath}), refreshing...`);
            fetchDirectory(currentPath);
        } else {
             console.log(`Change for '${data.path}' ignored, current is '${currentPath}'.`);
        }
    };

    // Check if the necessary APIs exist
    if (window.electron?.onFileChanged && window.electron?.removeFileChangedListener) {
        // Register the listener
        window.electron.onFileChanged(handleFileChange);
        console.log("File change listener attached.");

        // Return a cleanup function that calls the specific remove function
        return () => {
            console.log("Removing file change listener...");
            // Call the dedicated remove function with the original handler
            window.electron.removeFileChangedListener(handleFileChange);
            console.log("File change listener removed.");
        };
    } else {
        console.warn("window.electron file change listener APIs are not available.");
        return () => {}; // Return empty cleanup if APIs aren't there
    }
  }, [currentPath, fetchDirectory]); // Dependencies remain the same

  const breadcrumbs = buildBreadcrumbs(currentPath);
  const parentPath = getParentPath(currentPath);
  const showUpButton = currentPath !== '.' && currentPath !== '/'; // Simplified condition

  return (
    <div className="flex flex-col h-full p-2 bg-background text-foreground text-sm font-mono">
      {/* --- Toolbar --- */}
      <div className="flex items-center space-x-1 p-1 mb-2 border-b border-border">
          <Button variant="ghost" size="sm" className="h-6 px-2" title="New File (Not Implemented)">
              <FilePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2" title="New Folder (Not Implemented)">
              <FolderPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2" title="Refresh" onClick={() => currentPath && fetchDirectory(currentPath)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
      </div>
      {/* --- End Toolbar --- */}

      {/* --- Breadcrumbs --- */}
      <div className="flex items-center space-x-1 text-xs mb-2 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted">
        {breadcrumbs.map((crumb: Breadcrumb, index: number) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => handleBreadcrumbClick(crumb.path)}
              className={`hover:underline ${index === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              disabled={loading}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>
      {/* --- End Breadcrumbs --- */}

      {/* --- Loading State --- */}
      {loading && <div className="text-center p-4 text-muted-foreground">Loading...</div>}

      {/* --- Error State --- */}
      {error && (
        <div className="flex flex-col items-center justify-center p-4 text-destructive">
            <AlertCircle className="h-6 w-6 mb-2" />
            <p className="font-semibold">Error loading directory:</p>
            <p className="text-xs mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => currentPath && fetchDirectory(currentPath)} disabled={loading}>
                Retry
            </Button>
        </div>
      )}

      {/* --- File/Folder Listing --- */}
      {!loading && !error && (
        <ul className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted pr-1">
          {/* Up Directory Button - Simplified logic */} 
          {showUpButton && (
             <li key=".." className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer"
                 onClick={() => handleEntryClick({ name: '..', path: parentPath, isDirectory: true})}>
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
                <span>..</span>
              </li>
          )}

          {/* Entries */} 
          {entries.map((entry) => (
            <li
              key={entry.path}
              className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer"
              onClick={() => handleEntryClick(entry)}
              title={entry.path}
            >
              {entry.isDirectory ? (
                <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{entry.name}</span>
            </li>
          ))}
          {/* Empty Directory */} 
          {entries.length === 0 && !showUpButton && !loading && !error && ( // Also check showUpButton
             <li className="text-center text-muted-foreground p-4 text-xs">Directory is empty.</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default FileExplorer;

// Removed dynamic path import
