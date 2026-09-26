// Public API bridge for environments where the reserved `/mcp` route is intercepted
// by the hosting platform before the application router is reached.
//
// ChatGPT custom apps may connect to any remote HTTPS MCP endpoint, so this route
// reuses the same authenticated MCP implementation without depending on Sites'
// reserved MCP capability.
export { GET, POST } from "@/app/mcp/route";
