import Parser from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import ignore, { Ignore } from 'ignore';

// Basic regex patterns for potential secrets
// NOTE: These are simplified and may have false positives/negatives.
// More sophisticated detection often involves entropy analysis, specific formats, and context.
const SECRET_PATTERNS: { name: string; pattern: RegExp; type: 'warning' | 'error' }[] = [
    {
        name: 'Generic API Key Assignment',
        // Looks for common key variable names assigned a string literal 
        // with likely key characteristics (alphanumeric, punctuation, length > 20)
        pattern: /(api_key|apikey|api_secret|secret_key|secret|token|password)\s*[:=]\s*['"`]([a-zA-Z0-9/+\-_=]{20,})['"`]/gi,
        type: 'warning'
    },
    {
        name: 'AWS Access Key ID',
        // Matches the format AKIA followed by 16 uppercase letters or digits
        pattern: /['"`](AKIA[0-9A-Z]{16})['"`]/g,
        type: 'error'
    },
    {
        name: 'AWS Secret Access Key',
        // Matches 40 character base64 string often assigned to AWS secret vars
        pattern: /(aws_secret_access_key|aws_secret_key)\s*[:=]\s*['"`]([a-zA-Z0-9/+]{40})['"`]/gi,
        type: 'error'
    },
    {
        name: 'Possible Private Key Block',
        // Looks for the common header/footer of PEM private keys
        pattern: /-----BEGIN ((RSA|EC|DSA|OPENSSH) )?PRIVATE KEY-----/g,
        type: 'error'
    }
    // Add more patterns as needed (e.g., Google API keys, Stripe keys, etc.)
];

export class SecretsAnalyzer implements CodeAnalyzer {
    name = 'secrets-detector';
    description = 'Scans code for potential hardcoded secrets and keys, respecting .gitignore.';

    private ig: Ignore | null = null;
    private gitignoreReadAttempted = false;

    private async initializeGitignore(projectRoot: string | undefined): Promise<void> {
        if (this.gitignoreReadAttempted || !projectRoot) {
            return;
        }
        this.gitignoreReadAttempted = true;
        const gitignorePath = path.join(projectRoot, '.gitignore');
        try {
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
            this.ig = ignore().add(gitignoreContent);
            console.log(`[.gitignore] Loaded rules from ${gitignorePath}`);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                 console.log(`[.gitignore] No .gitignore file found at ${gitignorePath}`);
            } else {
                console.error(`[.gitignore] Error reading ${gitignorePath}:`, err);
            }
            this.ig = null;
        }
    }

    async analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        if (!context?.filePath) {
            return [];
        }

        await this.initializeGitignore(context.projectRoot);

        let isFileIgnored = false;
        if (this.ig && context.projectRoot) {
            const relativePath = path.relative(context.projectRoot, context.filePath);
            isFileIgnored = this.ig.ignores(relativePath);
             if (isFileIgnored) {
                 console.log(`[SecretsAnalyzer] Skipping ignored file: ${relativePath}`);
                 return [];
             }
        }

        const sourceCode = tree.rootNode.text;
        const lines = sourceCode.split('\n');

        for (const { name, pattern, type } of SECRET_PATTERNS) {
            let match;
            pattern.lastIndex = 0;

            while ((match = pattern.exec(sourceCode)) !== null) {
                const matchStartIndex = match.index;
                let currentLength = 0;
                let lineNumber = 0;
                for (let i = 0; i < lines.length; i++) {
                    currentLength += lines[i].length + 1;
                    if (currentLength > matchStartIndex) {
                        lineNumber = i + 1;
                        break;
                    }
                }
                
                results.push({
                    analyzer: this.name,
                    line: lineNumber,
                    type: type,
                    message: `Potential hardcoded secret detected: ${name}. Please verify and remove credentials from source code.`,
                    diagnostic: {
                        matchedString: match[0],
                        patternName: name
                    }
                });
            }
        }

        return results;
    }
}