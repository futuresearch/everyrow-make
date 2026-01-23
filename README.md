# EveryRow Make.com Integration

A custom Make.com app for [EveryRow](https://everyrow.io) - AI-powered data operations for your workflows.

## Features

EveryRow provides intelligent data processing operations:

- **Rank** - Score and sort rows by AI-evaluated criteria
- **Dedupe** - Remove duplicate rows using AI matching
- **Screen** - Filter rows based on complex AI criteria
- **Merge** - Join two tables using AI-powered matching
- **Agent Map** - Run web research on each row

## Installation

### Option 1: Automated Deploy (Recommended)

Use the deploy script to automatically upload all components to Make.com:

```bash
# 1. Create an empty app in Make.com first
#    Go to Make.com → Apps → Create a new App → name it "everyrow"

# 2. Get your Make.com API key
#    Go to Make.com → Profile → API → Create token (with apps:write scope)

# 3. Install dependencies
npm install

# 4. Deploy to Make.com (US region)
MAKE_API_KEY=your-make-api-key MAKE_APP_ID=everyrow npm run deploy

# For EU region:
MAKE_API_KEY=your-make-api-key MAKE_APP_ID=everyrow npm run deploy:eu1
```

### Option 2: Manual Import

1. Go to Make.com → Apps → Create a new App
2. Copy-paste each file from the `app/` directory into the appropriate tab:
   - `base.imljson` → Base tab
   - `common.imljson` → Common Data tab
   - Create Connection → paste from `connections/everyrow-api.imljson`
   - Create each Module → paste from `modules/*.imljson`

### Option 3: Install from Make.com (Coming Soon)

Search for "EveryRow" in the Make.com app directory.

## Getting Your API Key

1. Sign up at [everyrow.io](https://everyrow.io)
2. Go to Settings → API Keys
3. Create a new API key
4. Use this key when creating a connection in Make.com

## Usage

### Basic Workflow Pattern

Since EveryRow operations are asynchronous, workflows follow this pattern:

```
[Trigger] → [Start Task] → [Sleep 5s] → [Get Status] → [Router]
                                              ↓
                              [completed] → [Get Results]
                              [pending/running] → [Loop back to Sleep]
```

### Example: Rank Products

1. Add **EveryRow - Start Rank Task** module
2. Configure:
   - Input Data: Your array of products
   - Task: "Rank by value for money considering price and features"
   - Field Name: "value_score"
   - Field Type: Float
3. Add **Sleep** module (5 seconds)
4. Add **EveryRow - Get Task Status** module
5. Add **Router** to check if status is "completed"
6. Add **EveryRow - Get Task Results** for completed tasks

## Modules Reference

### Start Rank Task

Scores and sorts items based on AI evaluation.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | Array of objects to rank |
| Task | Yes | Description of ranking criteria |
| Field Name | Yes | Output field name for the score |
| Field Type | Yes | float, int, str, or bool |
| Ascending Order | No | Sort lowest to highest (default: false) |

### Start Dedupe Task

Removes duplicate rows using AI-powered matching.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | Array of objects to deduplicate |
| Equivalence Relation | Yes | Natural language description of what makes rows duplicates |

### Start Screen Task

Filters rows based on complex criteria.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | Array of objects to filter |
| Task | Yes | Description of filtering criteria |
| Response Schema | No | JSON schema for additional output fields |
| Batch Size | No | Number of rows to process in parallel |

### Start Merge Task

Joins two tables using AI-powered matching.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Left Table | Yes | Primary array of objects |
| Right Table | Yes | Secondary array to join |
| Task | Yes | Description of how to match rows |
| Left Key | Yes | Field name in left table for matching |
| Right Key | Yes | Field name in right table for matching |
| Model | No | LLM model to use |

### Start Agent Map Task

Runs web research on each row.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | Array of objects to research |
| Task | Yes | Description of research to perform |
| Effort Level | No | low, medium, or high |
| Response Schema | No | JSON schema for output structure |
| Model | No | LLM model to use |

### Get Task Status

Checks the status of a running task.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Task ID | Yes | ID returned from Start Task module |

Returns: `status` (pending, running, completed, failed), `artifactId`, `error`

### Get Task Results

Retrieves results from a completed task.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Artifact ID | Yes | ID from Get Task Status (when completed) |

Returns: Array of result objects

## Development

### Deploy Script

The `scripts/deploy.ts` script automates uploading to Make.com:

```bash
# Set environment variables
export MAKE_API_KEY=your-api-key
export MAKE_APP_ID=everyrow
export MAKE_APP_VERSION=1  # optional, defaults to 1

# Deploy to different regions
npm run deploy        # US1 (default)
npm run deploy:us1    # US1 explicitly
npm run deploy:us2    # US2
npm run deploy:eu1    # EU1
npm run deploy:eu2    # EU2
```

### Local Development with VS Code (Alternative)

1. Install the [Make Apps extension](https://marketplace.visualstudio.com/items?itemName=Make.make-apps)
2. Add your Make.com environment
3. Open this project folder
4. Edit files in `app/` directory
5. Changes sync automatically on save

### File Structure

```
app/
├── base.imljson           # Base URL, headers, error handling
├── common.imljson         # Shared constants
├── connections/
│   └── everyrow-api.imljson   # API key connection
├── modules/
│   ├── startRankTask.imljson
│   ├── startDedupeTask.imljson
│   ├── startScreenTask.imljson
│   ├── startMergeTask.imljson
│   ├── startAgentMapTask.imljson
│   ├── getTaskStatus.imljson
│   └── getTaskResults.imljson
└── rpcs/
    └── getModels.imljson      # Dynamic LLM model list
```

## API Reference

EveryRow API base URL: `https://engine.futuresearch.ai`

See [EveryRow Documentation](https://everyrow.io/docs) for full API details.

## Support

- [EveryRow Documentation](https://everyrow.io/docs)
- [Make.com Community](https://community.make.com)
- [GitHub Issues](https://github.com/futuresearch/make-app-everyrow/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.
