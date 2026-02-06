#!/usr/bin/env npx ts-node
/**
 * Test Make.com Module Definitions
 *
 * This script tests our module definitions by:
 * 1. Validating the JSON structure
 * 2. Simulating what Make.com would send to our API
 * 3. Running actual API calls against EveryRow
 *
 * Usage:
 *   EVERYROW_API_KEY=sk-xxx npx ts-node scripts/test-module.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const EVERYROW_API_KEY = process.env.EVERYROW_API_KEY;
const EVERYROW_BASE_URL = process.env.EVERYROW_BASE_URL || 'https://app.everyrow.com/api';

if (!EVERYROW_API_KEY) {
  console.error('Error: EVERYROW_API_KEY environment variable is required');
  process.exit(1);
}

const APP_DIR = path.join(__dirname, '..', 'app');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Sample test data
const TEST_DATA = [
  { name: "OpenAI", description: "AI research company" },
  { name: "Stripe", description: "Payment processing platform" },
  { name: "Anthropic", description: "AI safety company" }
];

async function apiRequest(
  method: string,
  endpoint: string,
  body?: object
): Promise<{ status: number; data: any }> {
  const url = `${EVERYROW_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${EVERYROW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  return { status: response.status, data };
}

// Test 1: Validate module JSON structure
async function testModuleStructure(): Promise<void> {
  console.log('\n=== Test: Module JSON Structure ===\n');

  const modulesDir = path.join(APP_DIR, 'modules');
  const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.imljson'));

  for (const file of files) {
    const filePath = path.join(modulesDir, file);
    const moduleName = file.replace('.imljson', '');

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const module = JSON.parse(content);

      // Check required fields
      const requiredFields = ['label', 'type', 'connection'];
      const missingFields = requiredFields.filter(f => !module[f]);

      if (missingFields.length > 0) {
        results.push({
          name: `structure:${moduleName}`,
          passed: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
        console.log(`  ✗ ${moduleName}: Missing fields: ${missingFields.join(', ')}`);
      } else {
        // Check communication array exists
        if (!Array.isArray(module.communication) || module.communication.length === 0) {
          results.push({
            name: `structure:${moduleName}`,
            passed: false,
            error: 'Missing or empty communication array'
          });
          console.log(`  ✗ ${moduleName}: Missing communication array`);
        } else {
          results.push({ name: `structure:${moduleName}`, passed: true });
          console.log(`  ✓ ${moduleName}: Valid structure`);
        }
      }
    } catch (e: any) {
      results.push({
        name: `structure:${moduleName}`,
        passed: false,
        error: `JSON parse error: ${e.message}`
      });
      console.log(`  ✗ ${moduleName}: ${e.message}`);
    }
  }
}

// Test 2: Simulate Make.com parameter processing
function simulateMakecomParameters(
  parameters: any[],
  inputValues: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const param of parameters) {
    const name = param.name;
    let value = inputValues[name];

    // Apply defaults if not provided
    if (value === undefined && param.default !== undefined) {
      value = param.default;
    }

    // Simulate type conversion
    switch (param.type) {
      case 'text':
        // Make.com would convert collection to string representation
        if (typeof value === 'object') {
          // This is the problematic case - Make.com rejects this with "Validation error: [Collection]"
          throw new Error(`Parameter "${name}" is type "text" but received a collection/array. Use toString() in mapping.`);
        }
        result[name] = String(value);
        break;
      case 'array':
        // For array type, the value should already be an array
        if (!Array.isArray(value)) {
          throw new Error(`Parameter "${name}" expects array but got ${typeof value}`);
        }
        result[name] = value;
        break;
      case 'boolean':
        result[name] = Boolean(value);
        break;
      case 'select':
        result[name] = value;
        break;
      default:
        result[name] = value;
    }
  }

  return result;
}

// Test 3: Simulate IML template processing
function processImlTemplate(template: string, context: Record<string, any>): any {
  // Simple IML template processor for testing
  let result = template;

  // Handle {{parameters.xxx}}
  result = result.replace(/\{\{parameters\.(\w+)\}\}/g, (_, key) => {
    const value = context.parameters?.[key];
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  });

  // Handle {{temp.xxx}}
  result = result.replace(/\{\{temp\.(\w+)\}\}/g, (_, key) => {
    return context.temp?.[key] || '';
  });

  // Handle {{body.xxx}}
  result = result.replace(/\{\{body\.(\w+)\}\}/g, (_, key) => {
    return context.body?.[key] || '';
  });

  // Handle parseJSON() - for when input is a JSON string
  result = result.replace(/\{\{parseJSON\(([^)]+)\)\}\}/g, (_, expr) => {
    // Extract the value from the expression
    const match = expr.match(/parameters\.(\w+)/);
    if (match) {
      const value = context.parameters?.[match[1]];
      if (typeof value === 'string') {
        return JSON.stringify(JSON.parse(value));
      }
      // If already an object/array, just stringify it
      return JSON.stringify(value);
    }
    return '';
  });

  return result;
}

// Test 4: Full API flow test for startRankTask
async function testStartRankTaskFlow(): Promise<void> {
  console.log('\n=== Test: Start Rank Task API Flow ===\n');

  const modulePath = path.join(APP_DIR, 'modules', 'startRankTask.imljson');
  const module = JSON.parse(fs.readFileSync(modulePath, 'utf-8'));

  // Test input - simulating what Make.com would send
  const testInput = {
    sessionName: 'Test Rank Session',
    inputData: TEST_DATA,  // This is an array/collection
    task: 'Rank by relevance to AI',
    fieldName: 'rank_score',
    fieldType: 'float',
    ascendingOrder: false
  };

  try {
    // Step 1: Check parameter types
    console.log('  1. Checking parameter types...');
    const inputDataParam = module.parameters.find((p: any) => p.name === 'inputData');
    console.log(`     inputData type: ${inputDataParam?.type}`);

    if (inputDataParam?.type === 'text') {
      console.log('     ⚠ inputData is "text" type - will fail if user maps a collection directly');
      console.log('     → User must use {{toString(...)}} to convert collection to JSON string');
    } else if (inputDataParam?.type === 'array') {
      console.log('     ✓ inputData is "array" type - should accept collections');
    }

    // Step 2: Create session
    console.log('  2. Creating session...');
    const sessionRes = await apiRequest('POST', '/sessions/create', {
      name: testInput.sessionName
    });

    if (sessionRes.status !== 200 && sessionRes.status !== 201) {
      throw new Error(`Failed to create session: ${JSON.stringify(sessionRes.data)}`);
    }

    const sessionId = sessionRes.data.session_id;
    console.log(`     Session ID: ${sessionId}`);

    // Step 3: Create artifact
    console.log('  3. Creating artifact...');
    const artifactRes = await apiRequest('POST', '/tasks', {
      session_id: sessionId,
      payload: {
        task_type: 'create_group',
        query: {
          data_to_create: testInput.inputData  // Direct array, not JSON string
        }
      }
    });

    if (artifactRes.status !== 200 && artifactRes.status !== 201) {
      throw new Error(`Failed to create artifact: ${JSON.stringify(artifactRes.data)}`);
    }

    const artifactTaskId = artifactRes.data.task_id;
    console.log(`     Artifact task ID: ${artifactTaskId}`);

    // Step 4: Wait for artifact
    console.log('  4. Waiting for artifact...');
    let artifactId: string | null = null;
    for (let i = 0; i < 30; i++) {
      const statusRes = await apiRequest('GET', `/tasks/${artifactTaskId}/status`);
      if (statusRes.data.artifact_id) {
        artifactId = statusRes.data.artifact_id;
        break;
      }
      if (statusRes.data.status === 'failed') {
        throw new Error(`Artifact creation failed: ${JSON.stringify(statusRes.data)}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!artifactId) {
      throw new Error('Timeout waiting for artifact');
    }
    console.log(`     Artifact ID: ${artifactId}`);

    // Step 5: Create rank task
    console.log('  5. Creating rank task...');
    const rankRes = await apiRequest('POST', '/tasks', {
      session_id: sessionId,
      payload: {
        task_type: 'deep_rank',
        query: {
          task: testInput.task,
          field_to_sort_by: testInput.fieldName,
          ascending_order: testInput.ascendingOrder,
          response_schema: {
            _model_name: 'RankResponse',
            [testInput.fieldName]: {
              type: testInput.fieldType,
              optional: false
            }
          }
        },
        input_artifacts: [artifactId],
        context_artifacts: []
      }
    });

    if (rankRes.status !== 200 && rankRes.status !== 201) {
      throw new Error(`Failed to create rank task: ${JSON.stringify(rankRes.data)}`);
    }

    const rankTaskId = rankRes.data.task_id;
    console.log(`     Rank task ID: ${rankTaskId}`);

    results.push({
      name: 'api:startRankTask',
      passed: true,
      details: { sessionId, artifactId, rankTaskId }
    });
    console.log('\n  ✓ API flow test passed');

  } catch (e: any) {
    results.push({
      name: 'api:startRankTask',
      passed: false,
      error: e.message
    });
    console.log(`\n  ✗ API flow test failed: ${e.message}`);
  }
}

// Test 5: Test that parseJSON works with string input
async function testParseJsonFlow(): Promise<void> {
  console.log('\n=== Test: parseJSON with String Input ===\n');

  // Simulate what happens when user uses toString() to convert collection to string
  const jsonString = JSON.stringify(TEST_DATA);
  console.log(`  Input (as JSON string): ${jsonString.substring(0, 50)}...`);

  try {
    // Create session
    const sessionRes = await apiRequest('POST', '/sessions/create', {
      name: 'Test parseJSON Flow'
    });
    const sessionId = sessionRes.data.session_id;
    console.log(`  Session ID: ${sessionId}`);

    // Create artifact with parsed JSON
    const artifactRes = await apiRequest('POST', '/tasks', {
      session_id: sessionId,
      payload: {
        task_type: 'create_group',
        query: {
          data_to_create: JSON.parse(jsonString)  // This simulates parseJSON()
        }
      }
    });

    if (artifactRes.status !== 200 && artifactRes.status !== 201) {
      throw new Error(`Failed: ${JSON.stringify(artifactRes.data)}`);
    }

    console.log(`  ✓ parseJSON flow works - artifact task: ${artifactRes.data.task_id}`);
    results.push({ name: 'api:parseJsonFlow', passed: true });

  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.message}`);
    results.push({ name: 'api:parseJsonFlow', passed: false, error: e.message });
  }
}

// Main
async function main() {
  console.log('=== Make.com Module Tests ===');
  console.log(`API: ${EVERYROW_BASE_URL}`);

  await testModuleStructure();
  await testStartRankTaskFlow();
  await testParseJsonFlow();

  // Summary
  console.log('\n=== Test Summary ===\n');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
