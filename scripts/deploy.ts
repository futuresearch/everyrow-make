#!/usr/bin/env npx ts-node
/**
 * Make.com Custom App Deploy Script
 *
 * Deploys the EveryRow app to Make.com using their SDK API.
 *
 * Usage:
 *   MAKE_API_KEY=xxx MAKE_APP_ID=xxx npx ts-node scripts/deploy.ts
 *
 * Environment variables:
 *   MAKE_API_KEY     - Your Make.com API key (from Settings > API)
 *   MAKE_APP_ID      - The app ID (name) in Make.com
 *   MAKE_APP_VERSION - App version (default: 1)
 *   MAKE_BASE_URL    - Make.com API base URL (default: https://us1.make.com/api)
 */

import * as fs from 'fs';
import * as path from 'path';

const MAKE_API_KEY = process.env.MAKE_API_KEY;
const MAKE_APP_ID = process.env.MAKE_APP_ID;
const MAKE_APP_VERSION = process.env.MAKE_APP_VERSION || '1';
const MAKE_BASE_URL = process.env.MAKE_BASE_URL || 'https://us1.make.com/api';

if (!MAKE_API_KEY) {
  console.error('Error: MAKE_API_KEY environment variable is required');
  console.error('Get your API key from Make.com > Settings > API');
  process.exit(1);
}

if (!MAKE_APP_ID) {
  console.error('Error: MAKE_APP_ID environment variable is required');
  console.error('This is the app name/ID you created in Make.com');
  process.exit(1);
}

const APP_DIR = path.join(__dirname, '..', 'app');
const API_BASE = `${MAKE_BASE_URL}/v2/sdk/apps`;

interface DeployResult {
  success: boolean;
  component: string;
  error?: string;
}

async function makeRequest(
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  data?: string | object,
  contentType: string = 'application/json'
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Token ${MAKE_API_KEY}`,
    'Content-Type': contentType,
  };

  const body = typeof data === 'string' ? data : (data ? JSON.stringify(data) : undefined);

  console.log(`  ${method} ${endpoint}`);

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readJsonFile(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

async function deployBase(): Promise<DeployResult> {
  try {
    const base = readJsonFile(path.join(APP_DIR, 'base.imljson'));
    await makeRequest('PUT', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/base`, JSON.stringify(base), 'application/jsonc');
    return { success: true, component: 'base' };
  } catch (error: any) {
    return { success: false, component: 'base', error: error.message };
  }
}

async function deployCommon(): Promise<DeployResult> {
  try {
    const common = readJsonFile(path.join(APP_DIR, 'common.imljson'));
    await makeRequest('PUT', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/common`, JSON.stringify(common), 'application/json');
    return { success: true, component: 'common' };
  } catch (error: any) {
    return { success: false, component: 'common', error: error.message };
  }
}

async function getExistingConnections(): Promise<Map<string, string>> {
  const response = await makeRequest('GET', `/${MAKE_APP_ID}/connections`);
  const map = new Map<string, string>();
  for (const conn of response.appConnections || []) {
    map.set(conn.label, conn.name);
  }
  return map;
}

async function deployConnection(localName: string, config: any): Promise<DeployResult> {
  const label = config.label || localName;

  try {
    // Check if connection already exists
    const existingConnections = await getExistingConnections();
    let remoteName = existingConnections.get(label);

    if (!remoteName) {
      // Create the connection
      console.log(`    Creating connection: ${label}`);
      const response = await makeRequest('POST', `/${MAKE_APP_ID}/connections`, {
        label: label,
        type: config.type || 'basic',
      });
      remoteName = response.appConnection.name;
      console.log(`    Created connection with name: ${remoteName}`);
    } else {
      console.log(`    Connection exists: ${remoteName}`);
    }

    // Note: Connection code (api/parameters) deployment via API appears not to work
    // The connection form parameters need to be configured manually in Make.com UI
    // or the communication is handled by base configuration
    console.log(`    Skipping connection code deployment (must be configured in Make.com UI)`);

    return { success: true, component: `connection:${label}` };
  } catch (error: any) {
    return { success: false, component: `connection:${label}`, error: error.message };
  }
}

async function getExistingModules(): Promise<Map<string, string>> {
  const response = await makeRequest('GET', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules`);
  const map = new Map<string, string>();
  for (const mod of response.appModules || []) {
    map.set(mod.name, mod.name);
  }
  return map;
}

async function deployModule(localName: string, config: any, connMap: Map<string, string>): Promise<DeployResult> {
  try {
    // Check if module already exists
    const existingModules = await getExistingModules();
    let moduleName = localName;

    // Resolve connection reference to actual Make.com connection name
    let connectionName: string | null = null;
    if (config.connection) {
      // Try to find by label first (our connection labels)
      const label = config.connection === 'everyrow-api' ? 'EveryRow API' : config.connection;
      connectionName = connMap.get(label) || null;
      if (!connectionName) {
        // Maybe it's already a Make.com name
        for (const [, name] of connMap) {
          if (name === config.connection) {
            connectionName = name;
            break;
          }
        }
      }
      console.log(`    Connection reference: ${config.connection} -> ${connectionName || 'null'}`);
    }

    if (!existingModules.has(moduleName)) {
      // Determine module type from config
      let moduleType = 'action';
      if (config.type === 'search') moduleType = 'search';
      if (config.type === 'trigger') moduleType = 'trigger';

      // Create the module
      console.log(`    Creating module: ${moduleName} (type: ${moduleType})`);
      await makeRequest('POST', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules`, {
        name: moduleName,
        label: config.label || moduleName,
        description: config.description || '',
        typeId: getModuleTypeId(moduleType),
        connection: connectionName,
      });
      console.log(`    Created module: ${moduleName}`);
    } else {
      console.log(`    Module exists: ${moduleName}`);
    }

    // Deploy communication (api)
    if (config.communication) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${moduleName}/api`,
        JSON.stringify(config.communication),
        'application/jsonc'
      );
    }

    // Deploy mappable parameters (expect)
    if (config.parameters) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${moduleName}/expect`,
        JSON.stringify(config.parameters),
        'application/jsonc'
      );
    }

    // Deploy interface (output)
    if (config.interface) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${moduleName}/interface`,
        JSON.stringify(config.interface),
        'application/jsonc'
      );
    }

    // Deploy samples
    if (config.samples) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${moduleName}/samples`,
        JSON.stringify(config.samples),
        'application/jsonc'
      );
    }

    return { success: true, component: `module:${moduleName}` };
  } catch (error: any) {
    return { success: false, component: `module:${localName}`, error: error.message };
  }
}

function getModuleTypeId(type: string): number {
  // Make.com module type IDs
  const types: Record<string, number> = {
    'action': 4,
    'search': 9,
    'trigger': 1,
    'instant_trigger': 5,
    'responder': 11,
    'universal': 12,
  };
  return types[type] || 4;
}

async function getExistingRpcs(): Promise<Map<string, string>> {
  const response = await makeRequest('GET', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs`);
  const map = new Map<string, string>();
  for (const rpc of response.appRpcs || []) {
    map.set(rpc.name, rpc.name);
  }
  return map;
}

async function deployRpc(localName: string, config: any, connMap: Map<string, string>): Promise<DeployResult> {
  try {
    // Check if RPC already exists
    const existingRpcs = await getExistingRpcs();
    let rpcName = localName;

    // Resolve connection reference to actual Make.com connection name
    let connectionName: string | null = null;
    if (config.connection) {
      const label = config.connection === 'everyrow-api' ? 'EveryRow API' : config.connection;
      connectionName = connMap.get(label) || null;
      console.log(`    RPC connection reference: ${config.connection} -> ${connectionName || 'null'}`);
    }

    if (!existingRpcs.has(rpcName)) {
      // Create the RPC
      console.log(`    Creating RPC: ${rpcName}`);
      await makeRequest('POST', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs`, {
        name: rpcName,
        label: config.label || rpcName,
        connection: connectionName,
      });
      console.log(`    Created RPC: ${rpcName}`);
    } else {
      console.log(`    RPC exists: ${rpcName}`);
    }

    // Deploy communication (api)
    if (config.communication) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs/${rpcName}/api`,
        JSON.stringify(config.communication),
        'application/jsonc'
      );
    }

    // Deploy parameters
    if (config.parameters) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs/${rpcName}/parameters`,
        JSON.stringify(config.parameters),
        'application/jsonc'
      );
    }

    return { success: true, component: `rpc:${rpcName}` };
  } catch (error: any) {
    return { success: false, component: `rpc:${localName}`, error: error.message };
  }
}

// Global map of connection labels to Make.com connection names
let connectionNameMap: Map<string, string> = new Map();

async function main() {
  console.log('=== Make.com Custom App Deploy ===');
  console.log(`App: ${MAKE_APP_ID} v${MAKE_APP_VERSION}`);
  console.log(`API: ${MAKE_BASE_URL}`);
  console.log('');

  const results: DeployResult[] = [];

  // Deploy base
  console.log('Deploying base...');
  results.push(await deployBase());

  // Deploy common
  console.log('Deploying common...');
  results.push(await deployCommon());

  // Deploy connections first and build the name mapping
  const connectionsDir = path.join(APP_DIR, 'connections');
  if (fs.existsSync(connectionsDir)) {
    console.log('Deploying connections...');
    const connectionFiles = fs.readdirSync(connectionsDir).filter(f => f.endsWith('.imljson'));
    for (const file of connectionFiles) {
      const localName = file.replace('.imljson', '').replace(/-/g, '_');
      const config = readJsonFile(path.join(connectionsDir, file));
      const result = await deployConnection(localName, config);
      results.push(result);
    }
  }

  // Refresh connection name map after deploying connections
  connectionNameMap = await getExistingConnections();
  console.log('  Connection mapping:', Object.fromEntries(connectionNameMap));

  // Deploy modules
  const modulesDir = path.join(APP_DIR, 'modules');
  if (fs.existsSync(modulesDir)) {
    console.log('Deploying modules...');
    const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.imljson'));
    for (const file of moduleFiles) {
      // Convert filename to valid Make.com module name (alphanumeric + underscore)
      const name = file.replace('.imljson', '').replace(/-/g, '_');
      const config = readJsonFile(path.join(modulesDir, file));
      results.push(await deployModule(name, config, connectionNameMap));
    }
  }

  // Deploy RPCs
  const rpcsDir = path.join(APP_DIR, 'rpcs');
  if (fs.existsSync(rpcsDir)) {
    console.log('Deploying RPCs...');
    const rpcFiles = fs.readdirSync(rpcsDir).filter(f => f.endsWith('.imljson'));
    for (const file of rpcFiles) {
      const name = file.replace('.imljson', '').replace(/-/g, '_');
      const config = readJsonFile(path.join(rpcsDir, file));
      results.push(await deployRpc(name, config, connectionNameMap));
    }
  }

  // Summary
  console.log('');
  console.log('=== Deploy Summary ===');
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Succeeded: ${succeeded.length}`);
  for (const r of succeeded) {
    console.log(`  ✓ ${r.component}`);
  }

  if (failed.length > 0) {
    console.log(`Failed: ${failed.length}`);
    for (const r of failed) {
      console.log(`  ✗ ${r.component}: ${r.error}`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('Deploy complete!');
}

main().catch(err => {
  console.error('Deploy failed:', err);
  process.exit(1);
});
