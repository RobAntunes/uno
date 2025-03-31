import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

export class CodeParser {
    private parser: Parser;
    
    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(TypeScript.typescript);
    }

    /**
     * Parse source code into an AST
     * @param sourceCode The source code to parse
     * @returns The root node of the AST
     */
    parse(sourceCode: string): Parser.Tree {
        return this.parser.parse(sourceCode);
    }

    /**
     * Parse a source file into an AST
     * @param filePath Path to the source file
     * @returns The root node of the AST
     */
    async parseFile(filePath: string): Promise<Parser.Tree> {
        const fs = await import('fs/promises');
        const sourceCode = await fs.readFile(filePath, 'utf8');
        return this.parse(sourceCode);
    }
} 