# Technical Debt

This file tracks known areas for improvement and refactoring in the Uno project.

## Core Features

-   **Language Server Protocol (LSP) Integration:** Implement LSP support to provide features like code completion, diagnostics, go-to-definition, etc., for various programming languages.
-   **Syntax Highlighting:** Implement robust syntax highlighting for a wide range of programming languages within the editor/viewer components.

## Performance & Stability

-   **File Watcher/Explorer Exclusions:** Systematically identify and exclude large, language-specific dependency directories (e.g., Python's `venv`/`.venv`, Go's `pkg`, Rust's `target`, Java's `target`/`build`, etc.) and metadata folders (e.g., `.git`, `.svn`, `.hg`) from file watching and directory reading operations to prevent performance issues and potential `EMFILE` errors. Ensure these exclusions are configurable or automatically detected based on project type.

- Find way for file explorer to show node_modules and other large or . files without hitting the max file open limit.

- Remove small gap between analysis header and background content

- embed n8n bundled or through docker, ask if docker is better because we can bundle a bunch of self hosted stuff and provide it for free to our users.

- add codebase indexing