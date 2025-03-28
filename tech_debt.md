# Technical Debt

This file tracks known areas for improvement and refactoring in the Uno project.

## Core Features

-   **Language Server Protocol (LSP) Integration:** Implement LSP support to provide features like code completion, diagnostics, go-to-definition, etc., for various programming languages.
-   **Syntax Highlighting:** Implement robust syntax highlighting for a wide range of programming languages within the editor/viewer components.

## Performance & Stability

-   **File Watcher/Explorer Exclusions:** Systematically identify and exclude large, language-specific dependency directories (e.g., Python's `venv`/`.venv`, Go's `pkg`, Rust's `target`, Java's `target`/`build`, etc.) and metadata folders (e.g., `.git`, `.svn`, `.hg`) from file watching and directory reading operations to prevent performance issues and potential `EMFILE` errors. Ensure these exclusions are configurable or automatically detected based on project type. 