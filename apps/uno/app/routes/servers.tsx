import React, { useCallback, useEffect, useState } from "react";

// Define types matching the preload/main process
interface McpServerConfig {
    description?: string;
    active: boolean;
    // Include all fields present in mcp.json if needed for saving
    command?: string;
    args?: string[];
    transport?: "stdio" | "sse";
    url?: string;
}

interface McpConfig {
    servers: Record<string, McpServerConfig>;
}

// --- Type for our specific methods ---
interface ElectronMcpApi {
    getMcpServers: () => Promise<McpConfig>;
    saveMcpServers: (updatedConfig: McpConfig) => Promise<void>;
}

// --- Remove Electron Window Definition ---
// Rely on runtime exposure and use casting below
/*
declare global {
  interface Window {
    electron: Window['electron'] & ElectronMcpApi;
  }
}
*/
// --- End Electron Window Definition ---

const ServersPage: React.FC = () => {
    const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch servers on component mount
    useEffect(() => {
        const fetchServers = async () => {
            try {
                setLoading(true);
                // Cast window.electron to any to bypass compile-time type checks
                const electronApi = window.electron as any;
                if (electronApi) { // Check if electron context is available
                    const config = await electronApi.getMcpServers();
                    setMcpConfig(config);
                    setError(null);
                } else {
                    setError(
                        "Electron context not available. Are you running in Electron?",
                    );
                }
            } catch (err: any) {
                console.error("Error fetching MCP servers:", err);
                setError(`Failed to load server configuration: ${err.message}`);
                setMcpConfig({ servers: {} }); // Set empty on error
            } finally {
                setLoading(false);
            }
        };

        fetchServers();
    }, []);

    // Handle checkbox toggle and save changes
    const handleToggle = useCallback(
        async (serverName: string, isActive: boolean) => {
            if (!mcpConfig) return;

            // Create a deep copy to modify
            // Using structuredClone for a more robust deep copy if available, else fallback
            const updatedConfig: McpConfig =
                typeof structuredClone === "function"
                    ? structuredClone(mcpConfig)
                    : JSON.parse(JSON.stringify(mcpConfig));

            if (updatedConfig.servers[serverName]) {
                updatedConfig.servers[serverName].active = isActive;

                try {
                    setMcpConfig(updatedConfig); // Optimistic UI update
                    // Cast window.electron to any to bypass compile-time type checks
                    const electronApi = window.electron as any;
                    if (electronApi) {
                        await electronApi.saveMcpServers(updatedConfig);
                        console.log(
                            `Saved MCP config after toggling ${serverName}`,
                        );
                    } else {
                        setError(
                            "Electron context not available. Cannot save changes.",
                        );
                        // Optionally revert optimistic update here if needed
                    }
                } catch (err: any) {
                    console.error("Error saving MCP servers:", err);
                    setError(
                        `Failed to save configuration update: ${err.message}`,
                    );
                    // Revert optimistic update on error
                    // (Refetch or restore previous state - simpler to just show error for now)
                    // Consider fetching again or restoring previous state if save fails
                }
            }
        },
        [mcpConfig],
    ); // Dependency on mcpConfig

    if (loading) {
        return <div>Loading server configuration...</div>;
    }

    if (error) {
        return <div style={{ color: "red" }}>Error: {error}</div>;
    }

    if (!mcpConfig || Object.keys(mcpConfig.servers).length === 0) {
        return <div>No MCP servers configured.</div>;
    }

    return (
        <div style={{ padding: "20px" }}>
            {/* Basic padding */}
            <h2 className="text-3xl">Manage MCP Servers</h2>
            <p className="text-sm text-muted-foreground pb-4">
                Enable or disable globally available MCP servers.
            </p>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {Object.entries(mcpConfig.servers).map(([name, config]) => (
                    <li
                        key={name}
                        style={{
                            marginBottom: "10px",
                            padding: "10px",
                            border: "1px solid #eee",
                            borderRadius: "4px",
                        }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                            }}
                        >
                            <div>
                                <strong>{name.charAt(0).toUpperCase() + name.slice(1)}</strong>
                                {config.description && (
                                    <div
                                        style={{
                                            fontSize: "0.9em",
                                            color: "#555",
                                        }}
                                    >
                                        {config.description}
                                    </div>
                                )}
                            </div>
                            <input
                                type="checkbox"
                                checked={config.active}
                                onChange={(e) =>
                                    handleToggle(name, e.target.checked)}
                                style={{ marginRight: "10px", width: "20px", height: "20px" }}
                            />
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ServersPage;
