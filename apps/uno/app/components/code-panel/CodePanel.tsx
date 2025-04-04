import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { useCodePanel } from '../../context/code-panel-context';
import { useWorkspace } from '../../context/workspace-context';
import { cn } from '../../../lib/utils';
// Removed incorrect type import
// Import core Monaco type for editor instance and monaco object
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Dynamically import Monaco Editor component
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// Helper to get language from file path
function getLanguageFromPath(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
      return 'markdown';
    // Add more cases as needed
    default:
      return undefined; // Or 'plaintext'
  }
}

export function CodePanel() {
  const { isOpen, setIsOpen, currentFile, mainContentWidth } = useCodePanel();
  const { projectRoot } = useWorkspace();
  const [codeContent, setCodeContent] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // Ref to store monaco instance
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (currentFile) {
      setIsLoadingCode(true);
      setErrorCode(null);
      setCodeContent('');
      console.log(`[CodePanel] Fetching content for: ${currentFile}`);
      
      window.electron.readFile(currentFile)
        .then(content => {
          if (content !== null) {
            console.log(`[CodePanel] Content received for: ${currentFile}`);
            setCodeContent(content);
          } else {
            console.warn(`[CodePanel] Received null content for: ${currentFile}`);
          }
        })
        .catch(err => {
          console.error(`[CodePanel] Error reading file ${currentFile}:`, err);
          setErrorCode(err.message || 'Failed to read file content.');
        })
        .finally(() => {
          setIsLoadingCode(false);
        });
    } else {
      setCodeContent('');
      setIsLoadingCode(false);
      setErrorCode(null);
    }
  }, [currentFile]);

  // Update onChange handler for Monaco's signature
  const handleCodeChange = useCallback((value: string | undefined) => {
    setCodeContent(value ?? ''); // Monaco might pass undefined
    // TODO: Implement saving logic later
  }, []);

  // onMount handler with corrected types
  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor, 
    monacoInstance: typeof monaco
  ) => {
    monacoRef.current = editor;
    console.log("[CodePanel] Monaco instance mounted.");

    // Fetch tsconfig paths async
    const configureTsDefaults = async () => {
      let tsPaths: { [key: string]: string[] } | null | undefined = {}; // Default to empty object
      if (projectRoot) {
        try {
          console.log(`[CodePanel] Fetching tsconfig paths for root: ${projectRoot}`);
          tsPaths = await window.electron.getTsConfigPaths(projectRoot);
          console.log("[CodePanel] Received tsconfig paths:", tsPaths);
          if (!tsPaths) tsPaths = {}; // Ensure it's an object if IPC returns null
        } catch (err) {
          console.error("[CodePanel] Error fetching tsconfig paths:", err);
          tsPaths = {}; // Fallback on error
        }
      }

      // --- Configure TypeScript Worker --- 
      monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
        // Base options
        jsx: monacoInstance.languages.typescript.JsxEmit.ReactJSX,
        esModuleInterop: true,
        target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
        moduleResolution: monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs, 
        allowSyntheticDefaultImports: true,

        // Context
        baseUrl: projectRoot ?? ".",
        
        // Explicitly add core libraries
        lib: ["esnext", "dom"], // Add standard libs

        // Use fetched paths
        paths: tsPaths
      });

      console.log(`[CodePanel] TypeScript defaults configured with baseUrl: ${projectRoot ?? "."}, paths:`, tsPaths);
    };

    configureTsDefaults(); // Call the async configuration function
  };

  // Loading fallback for Suspense
  const editorLoadingFallback = (
    <div className="flex items-center justify-center h-full text-muted-foreground p-4">
      <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading editor...
    </div>
  );

  return (
    <div
      className={cn(
        'fixed top-0 right-0 h-full bg-white transform transition-transform duration-200 ease-in-out z-50',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
      style={{
        width: mainContentWidth ? `${mainContentWidth}px` : '600px' 
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-medium truncate" title={currentFile ?? 'Code View'}>
            {currentFile ? currentFile.split('/').pop() : 'Code View'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {isLoadingCode ? (
            <div className="flex items-center justify-center h-full text-muted-foreground p-4">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading content...
            </div>
          ) : errorCode ? (
            <div className="flex items-center justify-center h-full text-red-500 p-4">
              <AlertCircle className="h-5 w-5 mr-2" /> Error: {errorCode}
            </div>
          ) : currentFile !== null ? (
            <Suspense fallback={editorLoadingFallback}>
              <MonacoEditor
                height="100%"
                language={getLanguageFromPath(currentFile) || 'plaintext'}
                theme="vs-light"
                value={codeContent}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                loading={editorLoadingFallback}
                options={{
                  minimap: { enabled: true },
                  fontSize: 12,
                  wordWrap: 'on'
                }}
              />
            </Suspense>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground p-4">
              No file selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}