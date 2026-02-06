#!/usr/bin/env npx ts-node
/**
 * Test Make.com Parameter Validation
 *
 * This script simulates how Make.com validates module parameters before
 * making API calls. It helps catch "Validation error: [Collection]" type
 * issues before deploying.
 *
 * Usage:
 *   npx ts-node scripts/test-makecom-validation.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const APP_DIR = path.join(__dirname, '..', 'app');

interface Parameter {
  name: string;
  type: string;
  required?: boolean;
  default?: any;
  spec?: any;
}

interface Module {
  label: string;
  type: string;
  parameters?: Parameter[];
  communication?: any[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Sample test inputs that simulate what Make.com would pass
const TEST_INPUTS = {
  // Collection from another Make.com module (e.g., Set Variable, Iterator)
  collection: [
    { name: "OpenAI", description: "AI company" },
    { name: "Stripe", description: "Payments" },
  ],
  // JSON string (if user uses toString())
  jsonString: '[{"name":"OpenAI","description":"AI company"},{"name":"Stripe","description":"Payments"}]',
  // Simple string
  text: "some text value",
  // Boolean
  boolean: true,
  // Number
  number: 42,
};

/**
 * Simulate Make.com's parameter validation
 */
function validateMakecomParameter(
  param: Parameter,
  value: any
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check required
  if (param.required && (value === undefined || value === null)) {
    result.valid = false;
    result.errors.push(`Required parameter "${param.name}" is missing`);
    return result;
  }

  // Type-specific validation
  switch (param.type) {
    case 'text':
      // Make.com rejects collections/arrays for text type with "Validation error: [Collection]"
      if (Array.isArray(value)) {
        result.valid = false;
        result.errors.push(
          `Parameter "${param.name}" is type "text" but received array/collection. ` +
          `User must use {{toString(variable)}} to convert to JSON string.`
        );
      } else if (typeof value === 'object' && value !== null) {
        result.valid = false;
        result.errors.push(
          `Parameter "${param.name}" is type "text" but received object. ` +
          `User must use {{toString(variable)}} to convert to JSON string.`
        );
      }
      break;

    case 'array':
      // For array type, validate the input is actually an array
      if (!Array.isArray(value)) {
        result.valid = false;
        result.errors.push(
          `Parameter "${param.name}" expects array but got ${typeof value}`
        );
      } else {
        // Check spec if provided
        if (param.spec && Array.isArray(param.spec) && param.spec.length > 0) {
          // Make.com expects items to match the spec structure
          result.warnings.push(
            `Parameter "${param.name}" has array spec - Make.com will validate each item`
          );
        } else if (param.spec && typeof param.spec === 'object' && !Array.isArray(param.spec)) {
          // Object spec like { type: "collection", spec: [] }
          const specType = param.spec.type;
          if (specType === 'collection') {
            // Each item should be an object
            for (let i = 0; i < value.length; i++) {
              if (typeof value[i] !== 'object' || Array.isArray(value[i])) {
                result.warnings.push(
                  `Array item ${i} in "${param.name}" should be an object (collection)`
                );
              }
            }
          }
        }
        // Empty spec [] means "accept any array" - should work
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        result.warnings.push(
          `Parameter "${param.name}" expects boolean but got ${typeof value}`
        );
      }
      break;

    case 'select':
      // Select type should have a value from the options
      break;

    default:
      // Unknown type
      result.warnings.push(
        `Unknown parameter type "${param.type}" for "${param.name}"`
      );
  }

  return result;
}

/**
 * Test a module's parameters against various input types
 */
function testModuleValidation(modulePath: string): void {
  const fileName = path.basename(modulePath, '.imljson');
  console.log(`\n=== Testing: ${fileName} ===\n`);

  const content = fs.readFileSync(modulePath, 'utf-8');
  const module: Module = JSON.parse(content);

  if (!module.parameters || module.parameters.length === 0) {
    console.log('  (no parameters to validate)');
    return;
  }

  // Find array/collection parameters (most likely to cause issues)
  const dataParams = module.parameters.filter(p =>
    p.name.toLowerCase().includes('data') ||
    p.name.toLowerCase().includes('table') ||
    p.name.toLowerCase().includes('input')
  );

  for (const param of dataParams) {
    console.log(`  Parameter: ${param.name} (type: ${param.type})`);
    console.log(`  Spec: ${JSON.stringify(param.spec)}`);

    // Test with collection input (simulating mapping from another module)
    console.log('\n  Testing with collection input:');
    const collectionResult = validateMakecomParameter(param, TEST_INPUTS.collection);
    if (collectionResult.valid) {
      console.log('    ✓ Collection input accepted');
    } else {
      console.log('    ✗ Collection input rejected:');
      collectionResult.errors.forEach(e => console.log(`      - ${e}`));
    }
    collectionResult.warnings.forEach(w => console.log(`    ⚠ ${w}`));

    // Test with JSON string input
    console.log('\n  Testing with JSON string input:');
    const stringResult = validateMakecomParameter(param, TEST_INPUTS.jsonString);
    if (stringResult.valid) {
      console.log('    ✓ JSON string input accepted');
    } else {
      console.log('    ✗ JSON string input rejected:');
      stringResult.errors.forEach(e => console.log(`      - ${e}`));
    }
    stringResult.warnings.forEach(w => console.log(`    ⚠ ${w}`));

    console.log('');
  }
}

// Main
function main() {
  console.log('=== Make.com Parameter Validation Tests ===');
  console.log('This tests how Make.com would validate our module parameters.\n');

  const modulesDir = path.join(APP_DIR, 'modules');
  const startModules = fs.readdirSync(modulesDir)
    .filter(f => f.startsWith('start') && f.endsWith('.imljson'));

  for (const file of startModules) {
    testModuleValidation(path.join(modulesDir, file));
  }

  console.log('\n=== Recommendations ===\n');
  console.log('If Make.com rejects collection input with "Validation error: [Collection]":');
  console.log('');
  console.log('Option 1: Use type "array" with spec: []');
  console.log('  This tells Make.com to accept any array without validating structure.');
  console.log('');
  console.log('Option 2: Use type "text" and have users convert with toString()');
  console.log('  In mapping: {{toString(1.dataSet)}}');
  console.log('  In module communication: {{parseJSON(parameters.inputData)}}');
  console.log('');
  console.log('Option 3: Use explicit collection spec');
  console.log('  Define the exact structure of objects the module accepts.');
}

main();
