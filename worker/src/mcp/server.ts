import type { Env } from '../types';
import { MCP_TOOLS, handleToolCall } from './tools';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

interface MCPErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type MCPJsonRpcResponse = MCPSuccessResponse | MCPErrorResponse;

function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };
}

/**
 * Handle MCP requests (standard HTTP transport for /mcp endpoint)
 */
export async function handleMCPRequest(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders() });
  }

  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      name: 'marketing-mcp-server',
      version: '1.0.0',
      description: 'SillySanta marketing data — ad spend, revenue, ROAS across 8 markets',
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    });
  }

  if (request.method !== 'POST') {
    return createMethodNotAllowedResponse();
  }

  try {
    const body = await request.json() as MCPRequest;
    const response = await processRequest(body, env);
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    });
  } catch (error) {
    return createParseErrorResponse(error);
  }
}

/**
 * Handle MCP Streamable HTTP endpoint for Claude.ai connectors
 */
export async function handleMCPSSE(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders() });
  }

  const acceptHeader = request.headers.get('Accept') || '';
  const wantsSSE = acceptHeader.includes('text/event-stream');

  // GET — Server-initiated SSE stream
  if (request.method === 'GET') {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const serverInfo = {
          jsonrpc: '2.0',
          method: 'notifications/message',
          params: {
            level: 'info',
            data: {
              message: 'Connected to marketing-mcp-server',
              capabilities: { tools: true },
            },
          },
        };

        const postEndpoint = new URL(request.url).origin + '/sse';
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${postEndpoint}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(serverInfo)}\n\n`));
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...getCorsHeaders(),
      },
    });
  }

  // POST — Client sends JSON-RPC, server responds
  if (request.method === 'POST') {
    try {
      const body = await request.json() as MCPRequest;
      const response = await processRequest(body, env);

      if (wantsSSE) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            ...getCorsHeaders(),
          },
        });
      }

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
      });
    } catch (error) {
      return createParseErrorResponse(error);
    }
  }

  // DELETE — Session termination
  if (request.method === 'DELETE') {
    return new Response(JSON.stringify({ status: 'session terminated' }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    });
  }

  return createMethodNotAllowedResponse();
}

async function processRequest(
  request: MCPRequest,
  env: Env
): Promise<MCPJsonRpcResponse> {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'marketing-mcp-server',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };

    case 'notifications/initialized':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      };

    case 'tools/call': {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};

      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Invalid params: missing tool name' },
        };
      }

      const tool = MCP_TOOLS.find(t => t.name === toolName);
      if (!tool) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        };
      }

      try {
        const result = await handleToolCall(toolName, toolArgs, env);
        return { jsonrpc: '2.0', id, result };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Tool execution failed',
          },
        };
      }
    }

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

function createParseErrorResponse(error: unknown): Response {
  const errorResponse: MCPErrorResponse = {
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32700,
      message: 'Parse error',
      data: error instanceof Error ? error.message : undefined,
    },
  };
  return new Response(JSON.stringify(errorResponse), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
  });
}

function createMethodNotAllowedResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Method not allowed. Use POST for JSON-RPC requests.' },
    }),
    {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    }
  );
}
