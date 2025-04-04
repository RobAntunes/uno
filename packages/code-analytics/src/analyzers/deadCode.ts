import Parser, { SyntaxNode, TreeCursor } from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './types';

interface DeclarationInfo {
    node: SyntaxNode; // The identifier node of the declaration
    declarationType: string; // e.g., variable_declarator, import_specifier
    usedAtRuntime: boolean;
    usedAsType: boolean;
}

export class DeadCodeAnalyzer implements CodeAnalyzer {
    name = 'dead-code';
    description = 'Identifies unused variables, functions, and imports';

    async analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]> {
        const declarations = new Map<string, DeclarationInfo>();
        const allIdentifiers: SyntaxNode[] = [];

        // Pass 1: Collect declarations and all identifier nodes
        this.collectDeclarationsAndIdentifiers(tree.walk(), declarations, allIdentifiers);

        // Pass 2: Process identifiers to mark declaration usage (runtime vs type)
        this.markDeclarationUsage(declarations, allIdentifiers);

        // Pass 3: Generate results
        return this.generateResults(declarations);
    }

    // --- Helper to find Identifier for various Declaration Types ---
    private _findDeclarationIdentifier(cursor: TreeCursor, nodeType: string): { identifierNode: SyntaxNode | null, identifierText: string | null } {
        let identifierNode: SyntaxNode | null = null;
        let identifierText: string | null = null;

        if (cursor.gotoFirstChild()) {
            do {
                const fieldName = cursor.currentFieldName;
                // General check for 'name' or 'alias' fields
                if (cursor.nodeType === 'identifier' && (fieldName === 'name' || fieldName === 'alias')) {
                    identifierNode = cursor.currentNode;
                    identifierText = identifierNode.text;
                    if (fieldName === 'alias') break; // Prioritize alias
                }
                // Specific check for namespace import identifier (doesn't always have a field name)
                if (nodeType === 'namespace_import' && cursor.nodeType === 'identifier') {
                     identifierNode = cursor.currentNode;
                     identifierText = identifierNode.text;
                     break;
                }
                 // Add other specific checks if needed for edge cases (e.g., parameters)
                if (nodeType === 'parameter' && cursor.nodeType === 'identifier' && fieldName !== 'type') {
                     identifierNode = cursor.currentNode;
                     identifierText = identifierNode.text;
                     break;
                }

            } while (cursor.gotoNextSibling());
            cursor.gotoParent();
        }
        return { identifierNode, identifierText };
    }

    // --- Pass 1: Collect Declarations and All Identifiers (Refactored) ---
    private collectDeclarationsAndIdentifiers(
        cursor: TreeCursor,
        declarations: Map<string, DeclarationInfo>,
        allIdentifiers: SyntaxNode[]
    ) {
        const declarationNodeTypes = [
            'variable_declarator', 'function_declarator', 'class_declarator', 'method_definition', 'parameter',
            'enum_declaration', 'interface_declaration', 'type_alias_declaration',
            'import_specifier', 'namespace_import'
        ];

        do {
            const node = cursor.currentNode;
            const nodeType = node.type;
            let isTypeOnlyImport = false;

            // Check parent for `import type` syntax
            const parent = node.parent;
            const grandParent = parent?.parent;
             if ((parent && parent.type === 'import_clause' && parent.firstChild?.type === 'type') ||
                 (grandParent && grandParent.type === 'import_statement' && grandParent.firstChild?.type === 'type')) {
                 isTypeOnlyImport = true;
            }

            // --- Declaration Finding ---
            if (declarationNodeTypes.includes(nodeType))
            {
                 // Use helper to find the identifier
                 const { identifierNode, identifierText } = this._findDeclarationIdentifier(cursor, nodeType);

                 // Add to declarations map if found
                 if (identifierNode && identifierText && !declarations.has(identifierText)) {
                      const initialUsedAsType = (nodeType === 'import_specifier' || nodeType === 'namespace_import') && isTypeOnlyImport;
                      declarations.set(identifierText, {
                          node: identifierNode,
                          declarationType: nodeType,
                          usedAtRuntime: false,
                          usedAsType: initialUsedAsType
                      });
                 }
            }

            // --- Identifier Collection ---
            if (node.type === 'identifier') {
                allIdentifiers.push(node);
            }

            // --- Traversal ---
            if (cursor.gotoFirstChild()) {
                this.collectDeclarationsAndIdentifiers(cursor, declarations, allIdentifiers);
                cursor.gotoParent();
            }
        } while (cursor.gotoNextSibling());
    }

    // --- Pass 2: Mark Declaration Usage --- 
    private markDeclarationUsage(
         declarations: Map<string, DeclarationInfo>,
         allIdentifiers: SyntaxNode[]
    ) {
        for (const idNode of allIdentifiers) {
             const name = idNode.text;
             const declarationInfo = declarations.get(name);
             
             if (declarationInfo && !(idNode.startIndex === declarationInfo.node.startIndex && idNode.endIndex === declarationInfo.node.endIndex)) { 
                 // Check for type usage
                 if (this.isTypeUsageContext(idNode)) {
                     declarationInfo.usedAsType = true;
                 }
                 
                 // Check for runtime usage (independent of type usage)
                 if (this.isRuntimeUsageContext(idNode)) {
                     declarationInfo.usedAtRuntime = true;
                 }
             }
         }
    }

    // Helper to check if identifier is used only in a type context
    private isTypeUsageContext(identifierNode: SyntaxNode): boolean {
        // Removed logging
        // Check if the node itself is classified as a type identifier
        if (identifierNode.type === 'type_identifier') {
             return true;
        }

        let current: SyntaxNode | null = identifierNode;
         while (current) {
             const parent: SyntaxNode | null = current.parent;
             if (!parent) break;
             const parentType = parent.type;
             // Removed logging

             // Check specific type-related parent nodes
             if ([
                 'type_annotation', 'heritage_clause', 
                 'type_arguments', 'type_parameter', 'predefined_type',
                 'type_identifier', // Also check if parent is type_identifier
                 'generic_type', 'union_type', 'intersection_type',
                 'type_predicate', 'readonly_type',
                 'typeof_expression'
                 ].includes(parentType)) {
                 // Removed logging
                 return true; 
             }
             
             // Check if identifier is part of a type alias, interface, enum declaration body
             if (['type_alias_declaration', 'interface_declaration', 'enum_declaration'].includes(parentType)) {
                const nameNode = parent.firstNamedChild;
                if (!nameNode || !(nameNode.startIndex === identifierNode.startIndex && nameNode.endIndex === identifierNode.endIndex)) {
                    // Removed logging
                    return true; 
                }
             }

             // Check for Traversal Stop Boundary SECOND
             if (['statement_block', 'class_body', 'object', 'function_declaration', 'variable_declarator', 'lexical_declaration', 'import_statement'].includes(parentType)) {
                 // Removed logging
                 break;
             }
             
             current = parent;
         }
         // Removed logging
         return false;
    }

    // Helper to check if identifier is the *name* part of a declaration statement (variable, function, class, import etc.)
    private isDeclarationNameContext(identifierNode: SyntaxNode): boolean {
        const parent = identifierNode.parent;
        if (!parent) return false;
        const parentType = parent.type;

        const nodesMatch = (nodeA: SyntaxNode | null | undefined, nodeB: SyntaxNode | null | undefined): boolean => {
             if (!nodeA || !nodeB) return false;
             return nodeA.startIndex === nodeB.startIndex && nodeA.endIndex === nodeB.endIndex;
         };

         if ([
             'variable_declarator', 'function_declarator', 'class_declarator',
             'method_definition', 'parameter', 'import_specifier', 'namespace_import',
             'enum_declaration', 'interface_declaration', 'type_alias_declaration'
         ].includes(parentType)) {
             if (nodesMatch(parent.firstNamedChild, identifierNode) || 
                 (parentType === 'import_specifier' && nodesMatch(parent.namedChild(1), identifierNode))) { 
                 return true;
             }
         }
          if (parentType === 'pair' || parentType === 'public_field_definition') {
             if (nodesMatch(parent.firstNamedChild, identifierNode)) {
                 return true;
             }
          }
         return false;
    }

    // NEW Helper: Check if identifier is used in a context implying runtime value usage
    private isRuntimeUsageContext(identifierNode: SyntaxNode): boolean {
        const parent = identifierNode.parent;
        if (!parent) return false; 

        // NOT runtime usage if it's the name part of its own declaration
        if (this.isDeclarationNameContext(identifierNode)) {
            return false;
        }

        // NOT runtime usage if it's purely within a type context (check ancestor nodes)
        if (this.isTypeUsageContext(identifierNode)) {
            return false;
        }
        
        // Specific check: property identifiers used as KEYS are not runtime value usages
        if (identifierNode.type === 'property_identifier') {
             const grandParent = parent.parent;
             if (grandParent && (grandParent.type === 'pair' || grandParent.type === 'public_field_definition')) {
                  // Check if it's the key node
                  const keyNode = grandParent.firstNamedChild; 
                  if (keyNode && keyNode.startIndex === identifierNode.startIndex && keyNode.endIndex === identifierNode.endIndex) {
                       return false; 
                  }
             }
        }
        
        // Add checks for contexts that are definitely NOT runtime usage, e.g. import statements
        if (parent.type === 'import_specifier' || parent.type === 'namespace_import' || parent.type === 'import_clause' || parent.type === 'import_statement') {
            return false;
        }
        
        // If none of the excluding conditions are met, assume it's potentially a runtime usage.
        // This includes being part of an expression, function call, RHS of assignment etc.
        return true;
    }

    // --- Pass 3: Generate results for unused declarations ---
    private generateResults(declarations: Map<string, DeclarationInfo>): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        for (const [name, { node, usedAtRuntime, usedAsType, declarationType }] of declarations.entries()) {
             // Removed logging

            // Report only if not used at runtime AND not used as type
            if (!usedAtRuntime && !usedAsType && !name.startsWith('_')) {
                 // Removed logging
                 const nodeTypeClean = declarationType.replace(/_declarator|_declaration|_definition|_specifier|_import/g, '') || 'symbol';
                 results.push({
                    analyzer: this.name,
                    line: node.startPosition.row + 1,
                    type: 'warning',
                    message: `Unused ${nodeTypeClean}: '${name}'`,
                    diagnostic: { 
                        identifier: name,
                        declarationType: declarationType 
                    }
                });
            }
        }
        return results;
    }
} 