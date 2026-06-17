/**
 * IPC Client - Lightweight helper communication
 *
 * Used by the OiHelper to connect to the host IpcServer
 * via Unix domain socket and send JSON requests.
 *
 * The socket path is provided by the host via CLI argument.
 * No environment variables are used.
 */

import * as net from 'node:net';

import type { IpcRequest, IpcResponse } from '../types/ipc.js';

/** Timeout for IPC connection in ms */
const IPC_CONNECT_TIMEOUT = 5000;

/**
 * Send an IPC request to the host and receive the response
 *
 * @param request - The IPC request to send
 * @param socketPath - Socket path to the host
 * @returns The IPC response
 */
export async function sendIpcRequest(
  request: IpcRequest,
  socketPath: string
): Promise<IpcResponse> {
  return new Promise(resolve => {
    const client = new net.Socket();
    let data = '';
    let timeout: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeout);
      client.destroy();
    };

    timeout = setTimeout(() => {
      cleanup();
      resolve({
        id: request.id,
        success: false,
        error: `IPC timeout: host not reachable at ${socketPath}`,
        errorCode: 'IPC_TIMEOUT',
      });
    }, IPC_CONNECT_TIMEOUT);

    client.on('data', (chunk: Buffer) => {
      data += chunk.toString();
      // Try to parse complete JSON
      try {
        const response = JSON.parse(data) as IpcResponse;
        if (response.id === request.id) {
          cleanup();
          resolve(response);
        }
      } catch {
        // Incomplete JSON, wait for more data
      }
    });

    client.on('error', (err: Error) => {
      cleanup();
      resolve({
        id: request.id,
        success: false,
        error: `IPC connection failed: ${err.message}`,
        errorCode: 'IPC_CONNECTION_ERROR',
      });
    });

    client.on('close', () => {
      if (data) {
        try {
          const response = JSON.parse(data) as IpcResponse;
          resolve(response);
          return;
        } catch {
          // fall through
        }
      }
      cleanup();
      resolve({
        id: request.id,
        success: false,
        error: 'IPC connection closed before response',
        errorCode: 'IPC_CLOSED',
      });
    });

    client.connect(socketPath, () => {
      const payload = JSON.stringify(request) + '\n';
      client.write(payload);
    });
  });
}

/**
 * Send a ping to check if the host is reachable
 */
export async function pingHost(socketPath: string): Promise<boolean> {
  const response = await sendIpcRequest(
    {
      id: `ping-${Date.now()}`,
      method: 'ping',
    },
    socketPath
  );
  return response.success;
}
