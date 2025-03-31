/**
 * Represents the result of a single analysis check.
 */
export interface AnalysisResult {
    type: 'error' | 'warning' | 'info';
    // severity: 'error' | 'warning' | 'info'; // Let's consolidate on 'type'
    message: string;
    analyzer: string; // Ensure this property exists
    line: number;     // Ensure this property exists
    diagnostic: any; // Diagnostic for structured data
} 