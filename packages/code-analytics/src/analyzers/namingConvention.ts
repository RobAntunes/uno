import Parser, { SyntaxNode, TreeCursor } from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult } from './types';

// Basic regex for checks
const CAMEL_CASE_REGEX = /^[a-z]+([A-Z][a-z\d]*)*$/;
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z\d]*$/;
const UPPER_SNAKE_CASE_REGEX = /^[A-Z][A-Z\d]*(_[A-Z\d]+)*$/; // Allow single word caps

// Removed obsolete helper function findNamedIdentifier

export class NamingConventionAnalyzer implements CodeAnalyzer {
    name = 'naming-convention';
    description = 'Checks for standard naming conventions (camelCase, PascalCase, UPPER_SNAKE_CASE for const)';

    async analyze(tree: Parser.Tree): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        this.checkNamingRecursive(tree.walk(), results);
        return results;
    }

    // --- Helper Function --- 
    private _findIdentifierForDeclaration(cursor: TreeCursor, nodeType: string): { identifierNode: SyntaxNode | null, name: string | null } {
        let identifierNode: SyntaxNode | null = null;
        let name: string | null = null;
        
        if (cursor.gotoFirstChild()) {
            do {
                 // Check based on common field names or node types
                 const fieldName = cursor.currentFieldName;
                 if (cursor.nodeType === 'identifier' && (fieldName === 'name' || fieldName === 'alias')) {
                     identifierNode = cursor.currentNode;
                     name = identifierNode.text;
                     if (fieldName === 'alias') break; // Prioritize alias
                 }
                 // Special handling for parameters where name might be nested
                 if (nodeType === 'parameter' && cursor.nodeType === 'identifier' && fieldName !== 'type') {
                      identifierNode = cursor.currentNode;
                      name = identifierNode.text;
                      break; // Assume first non-type identifier is the name
                 }
                 // For method definitions, the name field is correct
                 if (nodeType === 'method_definition' && fieldName === 'name' && cursor.nodeType === 'identifier') {
                      identifierNode = cursor.currentNode;
                      name = identifierNode.text;
                      break;
                 }
                 
             } while (cursor.gotoNextSibling());
             cursor.gotoParent();
         }
         return { identifierNode, name };
    }

    // --- Main Recursive Check --- 
    private checkNamingRecursive(cursor: TreeCursor, results: AnalysisResult[]) {
        do {
            const node = cursor.currentNode;
            const nodeType = node.type;
            let expectedFormat: 'camelCase' | 'PascalCase' | 'camelOrUpperSnakeCase' | null = null;
            let entityType: string | null = null;
            let isConst = false;

            // Check if variable declaration is const
            if (nodeType === 'variable_declarator') {
                 const lexicalDeclaration = node.parent; 
                 if (lexicalDeclaration?.type === 'lexical_declaration' && lexicalDeclaration.child(0)?.text === 'const') {
                    isConst = true;
                 }
            }

            // Determine expected format and entity type based on node type
            switch (nodeType) {
                case 'variable_declarator':
                     expectedFormat = isConst ? 'camelOrUpperSnakeCase' : 'camelCase';
                     entityType = 'variable';
                     break;
                case 'function_declarator':
                     expectedFormat = 'camelCase';
                     entityType = 'function';
                     break;
                case 'parameter':
                     expectedFormat = 'camelCase';
                     entityType = 'parameter';
                     break;
                case 'method_definition':
                     expectedFormat = 'camelCase';
                     entityType = 'method';
                     break;
                 case 'class_declarator':
                 case 'interface_declaration':
                 case 'enum_declaration':
                     expectedFormat = 'PascalCase';
                     entityType = nodeType.split('_')[0];
                     break;
            }
            
            // If it's a node type we care about checking...
            if (expectedFormat && entityType) {
                 // Find the identifier using the helper
                 const { identifierNode, name: nameToCheck } = this._findIdentifierForDeclaration(cursor, nodeType);

                 // Skip constructor checks for methods
                 if (nodeType === 'method_definition' && nameToCheck === 'constructor') {
                     // Do nothing, skip validation
                 } else if (identifierNode && nameToCheck) {
                     // Perform the validation check
                     let isValid = false;
                     let expectedPattern = '';

                     if (expectedFormat === 'camelCase') {
                         isValid = CAMEL_CASE_REGEX.test(nameToCheck);
                         expectedPattern = 'camelCase';
                     } else if (expectedFormat === 'PascalCase') {
                         isValid = PASCAL_CASE_REGEX.test(nameToCheck);
                         expectedPattern = 'PascalCase';
                     } else if (expectedFormat === 'camelOrUpperSnakeCase') {
                         isValid = CAMEL_CASE_REGEX.test(nameToCheck) || UPPER_SNAKE_CASE_REGEX.test(nameToCheck);
                         expectedPattern = 'camelCase or UPPER_SNAKE_CASE';
                     }

                     if (!isValid) {
                         results.push({
                             type: 'naming-convention',
                             severity: 'info', 
                             message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} '${nameToCheck}' should be in ${expectedPattern}`,
                             location: {
                                 start: { row: identifierNode.startPosition.row, column: identifierNode.startPosition.column },
                                 end: { row: identifierNode.endPosition.row, column: identifierNode.endPosition.column }
                             }
                         });
                     }
                 }
            }

            // Recursively check children
            if (cursor.gotoFirstChild()) {
                this.checkNamingRecursive(cursor, results);
                cursor.gotoParent();
            }

        } while(cursor.gotoNextSibling());
    }
} 