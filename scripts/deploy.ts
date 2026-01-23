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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const text = await response.text();
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
    await makeRequest('PUT', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/base`, JSON.stringify(base), 'text/plain');
    return { success: true, component: 'base' };
  } catch (error: any) {
    return { success: false, component: 'base', error: error.message };
  }
}

async function deployCommon(): Promise<DeployResult> {
  try {
    const common = readJsonFile(path.join(APP_DIR, 'common.imljson'));
    await makeRequest('PUT', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/common`, JSON.stringify(common), 'text/plain');
    return { success: true, component: 'common' };
  } catch (error: any) {
    return { success: false, component: 'common', error: error.message };
  }
}

async function deployConnection(name: string, config: any): Promise<DeployResult> {
  try {
    // First, try to create the connection
    try {
      await makeRequest('POST', `/${MAKE_APP_ID}/connections`, {
        name: name,
        label: config.label || name,
        type: config.type || 'basic',
      });
      console.log(`    Created connection: ${name}`);
    } catch (e: any) {
      // Connection might already exist, continue with update
      if (!e.message.includes('already exists')) {
        console.log(`    Connection may already exist, updating...`);
      }
    }

    // Deploy communication (api)
    if (config.communication) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/connections/${name}/api`,
        JSON.stringify(config.communication),
        'text/plain'
      );
    }

    // Deploy parameters
    if (config.parameters) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/connections/${name}/parameters`,
        JSON.stringify(config.parameters),
        'text/plain'
      );
    }

    return { success: true, component: `connection:${name}` };
  } catch (error: any) {
    return { success: false, component: `connection:${name}`, error: error.message };
  }
}

async function deployModule(name: string, config: any): Promise<DeployResult> {
  try {
    // Determine module type from config
    let moduleType = 'action';
    if (config.type === 'search') moduleType = 'search';
    if (config.type === 'trigger') moduleType = 'trigger';

    // First, try to create the module
    try {
      await makeRequest('POST', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules`, {
        name: name,
        label: config.label || name,
        description: config.description || '',
        type_id: getModuleTypeId(moduleType),
        connection: config.connection || null,
        moduleInitMode: 'blank',
      });
      console.log(`    Created module: ${name}`);
    } catch (e: any) {
      console.log(`    Module may already exist, updating...`);
    }

    // Deploy communication (api)
    if (config.communication) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${name}/api`,
        JSON.stringify(config.communication),
        'text/plain'
      );
    }

    // Deploy mappable parameters (expect)
    if (config.parameters) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${name}/expect`,
        JSON.stringify(config.parameters),
        'text/plain'
      );
    }

    // Deploy interface (output)
    if (config.interface) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${name}/interface`,
        JSON.stringify(config.interface),
        'text/plain'
      );
    }

    // Deploy samples
    if (config.samples) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/modules/${name}/samples`,
        JSON.stringify(config.samples),
        'text/plain'
      );
    }

    return { success: true, component: `module:${name}` };
  } catch (error: any) {
    return { success: false, component: `module:${name}`, error: error.message };
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

async function deployRpc(name: string, config: any): Promise<DeployResult> {
  try {
    // First, try to create the RPC
    try {
      await makeRequest('POST', `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs`, {
        name: name,
        label: config.label || name,
        connection: config.connection || null,
      });
      console.log(`    Created RPC: ${name}`);
    } catch (e: any) {
      console.log(`    RPC may already exist, updating...`);
    }

    // Deploy communication (api)
    if (config.communication) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs/${name}/api`,
        JSON.stringify(config.communication),
        'text/plain'
      );
    }

    // Deploy parameters
    if (config.parameters) {
      await makeRequest(
        'PUT',
        `/${MAKE_APP_ID}/${MAKE_APP_VERSION}/rpcs/${name}/parameters`,
        JSON.stringify(config.parameters),
        'text/plain'
      );
    }

    return { success: true, component: `rpc:${name}` };
  } catch (error: any) {
    return { success: false, component: `rpc:${name}`, error: error.message };
  }
}

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

  // Deploy connections
  const connectionsDir = path.join(APP_DIR, 'connections');
  if (fs.existsSync(connectionsDir)) {
    console.log('Deploying connections...');
    const connectionFiles = fs.readdirSync(connectionsDir).filter(f => f.endsWith('.imljson'));
    for (const file of connectionFiles) {
      const name = file.replace('.imljson', '').replace(/-/g, '_');
      const config = readJsonFile(path.join(connectionsDir, file));
      results.push(await deployConnection(name, config));
    }
  }

  // Deploy modules
  const modulesDir = path.join(APP_DIR, 'modules');
  if (fs.existsSync(modulesDir)) {
    console.log('Deploying modules...');
    const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.imljson'));
    for (const file of moduleFiles) {
      // Convert filename to valid Make.com module name (alphanumeric + underscore)
      const name = file.replace('.imljson', '').replace(/-/g, '_');
      const config = readJsonFile(path.join(modulesDir, file));
      results.push(await deployModule(name, config));
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
      results.push(await deployRpc(name, config));
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
