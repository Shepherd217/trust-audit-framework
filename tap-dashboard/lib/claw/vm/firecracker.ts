// @ts-nocheck
/**
 * Firecracker MicroVM HTTP API Client
 *
 * Communicates with Firecracker via Unix domain socket using HTTP/1.1
 * API Reference: https://github.com/firecracker-microvm/firecracker/blob/main/docs/api_requests
 */

import * as http from "http";
import * as fs from "fs";

// ============================================================================
// Types
// ============================================================================

export type VMState = "Running" | "Paused" | "Not started";

export interface VMConfig {
  vcpu_count?: number;
  mem_size_mib?: number;
  smt?: boolean;
  track_dirty_pages?: boolean;
}

export interface DriveConfig {
  drive_id: string;
  path_on_host: string;
  is_root_device: boolean;
  partuuid?: string;
  is_read_only?: boolean;
  cache_type?: "Unsafe" | "Writeback";
  io_engine?: "Sync" | "Async" | "IoUring";
}

export interface NetworkInterfaceConfig {
  iface_id: string;
  host_dev_name: string;
  guest_mac?: string;
  rx_rate_limiter?: RateLimiterConfig;
  tx_rate_limiter?: RateLimiterConfig;
}

export interface RateLimiterConfig {
  bandwidth?: TokenBucketConfig;
  ops?: TokenBucketConfig;
}

export interface TokenBucketConfig {
  size: number;
  one_time_burst?: number;
  refill_time: number;
}

export interface VsockConfig {
  guest_cid: number;
  uds_path: string;
}

export interface FullVMConfig {
  machineConfig?: VMConfig;
  drives?: DriveConfig[];
  networkInterfaces?: NetworkInterfaceConfig[];
  vsock?: VsockConfig;
}

export interface FirecrackerError {
  fault_message: string;
}

// ============================================================================
// Error Handling
// ============================================================================

export class FirecrackerAPIError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
    message: string
  ) {
    super(message);
    this.name = "FirecrackerAPIError";
  }
}

export class FirecrackerConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirecrackerConnectionError";
  }
}

// ============================================================================
// HTTP Request Helper
// ============================================================================

/**
 * Make an HTTP request to Firecracker via Unix domain socket
 */
function makeRequest(
  socketPath: string,
  options: {
    method: string;
    path: string;
    body?: object;
  }
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    // Verify socket exists
    if (!fs.existsSync(socketPath)) {
      return reject(
        new FirecrackerConnectionError(
          `Unix socket does not exist: ${socketPath}`
        )
      );
    }

    const requestBody = options.body ? JSON.stringify(options.body) : undefined;

    const requestOptions: http.RequestOptions = {
      socketPath,
      path: options.path,
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(requestBody ? { "Content-Length": Buffer.byteLength(requestBody) } : {}),
      },
    };

    const req = http.request(requestOptions, (res) => {
      let responseBody = "";

      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: responseBody,
        });
      });
    });

    req.on("error", (err) => {
      reject(
        new FirecrackerConnectionError(
          `Failed to connect to Firecker socket: ${err.message}`
        )
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(
        new FirecrackerConnectionError(
          `Request to Firecracker socket timed out: ${socketPath}`
        )
      );
    });

    if (requestBody) {
      req.write(requestBody);
    }

    req.end();
  });
}

/**
 * Parse Firecracker error response
 */
function parseErrorResponse(statusCode: number, body: string): FirecrackerError {
  try {
    return JSON.parse(body) as FirecrackerError;
  } catch {
    return { fault_message: `HTTP ${statusCode}: ${body}` };
  }
}

/**
 * Handle HTTP response and throw appropriate errors
 */
async function handleResponse<T>(
  promise: Promise<{ statusCode: number; body: string }>,
  expectedStatus: number[] = [200, 201, 204]
): Promise<T> {
  const { statusCode, body } = await promise;

  if (!expectedStatus.includes(statusCode)) {
    const error = parseErrorResponse(statusCode, body);
    throw new FirecrackerAPIError(
      statusCode,
      body,
      error.fault_message || `Unexpected status code: ${statusCode}`
    );
  }

  if (!body) {
    return undefined as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return body as T;
  }
}

// ============================================================================
// VM Lifecycle Methods
// ============================================================================

/**
 * Create a new microVM configuration
 * PUT /vm
 * @param socketPath Path to Firecracker Unix socket
 * @param config Full VM configuration
 * @returns VM instance ID
 */
export async function createVM(
  socketPath: string,
  config: FullVMConfig
): Promise<string> {
  // Firecracker PUT /vm creates the VM and returns the instance ID
  const response = await handleResponse<{ id: string }>(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/vm",
      body: config,
    }),
    [201, 200]
  );

  // Generate a VM ID if not returned (some Firecracker versions)
  return response?.id || `vm-${Date.now()}`;
}

/**
 * Start the microVM
 * PUT /actions
 * @param socketPath Path to Firecracker Unix socket
 */
export async function startVM(socketPath: string): Promise<void> {
  await handleResponse(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/actions",
      body: { action_type: "InstanceStart" },
    }),
    [204, 200]
  );
}

/**
 * Stop the microVM gracefully (Send Ctrl+Alt+Del)
 * PUT /actions
 * @param socketPath Path to Firecracker Unix socket
 */
export async function stopVM(socketPath: string): Promise<void> {
  await handleResponse(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/actions",
      body: { action_type: "SendCtrlAltDel" },
    }),
    [204, 200]
  );
}

/**
 * Get the current state of the microVM
 * GET /vm/state
 * @param socketPath Path to Firecracker Unix socket
 * @returns Current VM state
 */
export async function getVMState(socketPath: string): Promise<VMState> {
  const response = await handleResponse<{ state: VMState }>(
    makeRequest(socketPath, {
      method: "GET",
      path: "/vm/state",
    }),
    [200]
  );

  return response.state;
}

// ============================================================================
// VM Configuration Methods
// ============================================================================

/**
 * Configure the microVM
 * PUT /machine-config, PUT /drives, PUT /network-interfaces, PUT /vsock
 * @param socketPath Path to Firecracker Unix socket
 * @param config Full VM configuration
 */
export async function configureVM(
  socketPath: string,
  config: FullVMConfig
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Configure machine (vCPU, memory)
  if (config.machineConfig) {
    promises.push(
      handleResponse(
        makeRequest(socketPath, {
          method: "PUT",
          path: "/machine-config",
          body: config.machineConfig,
        }),
        [204, 200, 201]
      )
    );
  }

  // Configure drives
  if (config.drives && config.drives.length > 0) {
    for (const drive of config.drives) {
      promises.push(
        handleResponse(
          makeRequest(socketPath, {
            method: "PUT",
            path: `/drives/${encodeURIComponent(drive.drive_id)}`,
            body: drive,
          }),
          [204, 200, 201]
        )
      );
    }
  }

  // Configure network interfaces
  if (config.networkInterfaces && config.networkInterfaces.length > 0) {
    for (const iface of config.networkInterfaces) {
      promises.push(
        handleResponse(
          makeRequest(socketPath, {
            method: "PUT",
            path: `/network-interfaces/${encodeURIComponent(iface.iface_id)}`,
            body: iface,
          }),
          [204, 200, 201]
        )
      );
    }
  }

  // Configure vsock
  if (config.vsock) {
    promises.push(
      handleResponse(
        makeRequest(socketPath, {
          method: "PUT",
          path: "/vsock",
          body: config.vsock,
        }),
        [204, 200, 201]
      )
    );
  }

  await Promise.all(promises);
}

// ============================================================================
// VM State Control Methods
// ============================================================================

/**
 * Pause the microVM
 * PUT /vm-state
 * @param socketPath Path to Firecracker Unix socket
 */
export async function pauseVM(socketPath: string): Promise<void> {
  await handleResponse(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/vm-state",
      body: { state: "Paused" },
    }),
    [204, 200]
  );
}

/**
 * Resume the microVM from paused state
 * PUT /vm-state
 * @param socketPath Path to Firecracker Unix socket
 */
export async function resumeVM(socketPath: string): Promise<void> {
  await handleResponse(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/vm-state",
      body: { state: "Resumed" },
    }),
    [204, 200]
  );
}

// ============================================================================
// Snapshot Methods
// ============================================================================

/**
 * Create a snapshot of the microVM
 * PUT /snapshot/create
 * @param socketPath Path to Firecracker Unix socket
 * @param snapshotPath Path where snapshot will be saved
 */
export async function createSnapshot(
  socketPath: string,
  snapshotPath: string
): Promise<void> {
  await handleResponse(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/snapshot/create",
      body: {
        snapshot_path: snapshotPath,
        mem_file_path: `${snapshotPath}.mem`,
      },
    }),
    [204, 200]
  );
}

/**
 * Load a snapshot into the microVM
 * PUT /snapshot/load
 * @param socketPath Path to Firecracker Unix socket
 * @param snapshotPath Path to the snapshot file
 */
export async function loadSnapshot(
  socketPath: string,
  snapshotPath: string
): Promise<void> {
  await handleResponse(
    makeRequest(socketPath, {
      method: "PUT",
      path: "/snapshot/load",
      body: {
        snapshot_path: snapshotPath,
        mem_file_path: `${snapshotPath}.mem`,
      },
    }),
    [204, 200]
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  createVM,
  startVM,
  stopVM,
  getVMState,
  configureVM,
  pauseVM,
  resumeVM,
  createSnapshot,
  loadSnapshot,
};
