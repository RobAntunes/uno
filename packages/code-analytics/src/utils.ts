import fs from 'fs/promises';
import path from 'path';

const MARKER_DIRNAME = '.uno';
const PKG_JSON_FILENAME = 'package.json';

/**
 * Searches upwards from a starting directory to find the project root.
 * The project root is identified by the presence of a specific marker directory 
 * (`.uno/`) or, failing that, a `package.json` file.
 * 
 * @param startPath The absolute path to start searching from (e.g., a file's directory).
 * @returns The absolute path to the found project root, or null if neither marker nor package.json is found.
 */
export async function findProjectRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath); // Ensure absolute path

    // If startPath is a file, begin search from its directory
    try {
        const stats = await fs.stat(currentPath);
        if (stats.isFile()) {
            currentPath = path.dirname(currentPath);
        }
    } catch {
        // If stat fails, maybe the path doesn't exist yet or permissions issue. 
        // Try starting from dirname anyway if it looks like a file path.
        if (path.basename(currentPath).includes('.')) {
             currentPath = path.dirname(currentPath);
        }
        // If it's already a directory or doesn't exist, continue from currentPath
    }


    while (true) {
        const markerDirPath = path.join(currentPath, MARKER_DIRNAME);
        const pkgJsonPath = path.join(currentPath, PKG_JSON_FILENAME);

        try {
            // Prioritize the marker directory
            const stats = await fs.stat(markerDirPath);
            if (stats.isDirectory()) {
                console.log(`[findProjectRoot] Found marker directory at: ${markerDirPath}`);
                return currentPath; // Found marker directory
            }
        } catch {
            // Marker directory not found or error stating, try package.json
            try {
                await fs.access(pkgJsonPath); // Check existence of package.json
                console.log(`[findProjectRoot] Found package.json at: ${pkgJsonPath}`);
                return currentPath; // Found package.json
            } catch {
                // Neither found in this directory
            }
        }

        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
            // Reached the filesystem root
            console.log(`[findProjectRoot] Reached filesystem root without finding marker directory or package.json.`);
            return null; 
        }
        currentPath = parentPath;
    }
} 