# EveryRow Make.com Integration

A Make.com app for [EveryRow](https://everyrow.io) - AI-powered data operations for your workflows.

## Features

EveryRow provides intelligent data processing operations:

- **Rank** - Score and sort rows by AI-evaluated criteria
- **Dedupe** - Remove duplicate rows using AI matching
- **Screen** - Filter rows based on complex AI criteria
- **Merge** - Join two tables using AI-powered matching
- **Agent Map** - Run web research on each row

## Installation

### Step 1: Install the EveryRow App

Click the link below to add EveryRow to your Make.com account:

**[Install EveryRow App](https://www.make.com/en/hq/app-invitation/758568f633c72592e573a83e38a8a290)**

### Step 2: Get Your EveryRow API Key

1. Go to [everyrow.io](https://everyrow.io) and sign up (or log in)
2. Navigate to [everyrow.io/settings/api-keys](https://everyrow.io/settings/api-keys)

New accounts get **$20 free credit** to get started.

### Step 3: Create a Connection in Make.com

1. In Make.com, create a new scenario
2. Add any EveryRow module (e.g., "Start Rank Task")
3. Click **Create a connection**
4. Paste your EveryRow API key
5. Click **Save**

## Quick Start

The easiest way to get started is to import one of our ready-made templates.

### Import a Template

1. Go to the `templates/` folder in this repo
2. Copy the contents of a template JSON file (e.g., `everyrow-rank.json`)
3. In Make.com: **Create scenario** → **⋯** menu → **Import Blueprint**
4. Paste the JSON and click **Save**
5. Add your EveryRow connection to each module
6. Click **Run once** to test

### Available Templates

| Template | Description |
|----------|-------------|
| `everyrow-rank.json` | Score and sort items by criteria |
| `everyrow-screen.json` | Filter rows based on AI criteria |
| `everyrow-dedupe.json` | Remove duplicates with fuzzy matching |
| `everyrow-merge.json` | Join two tables with AI matching |
| `everyrow-agent-map.json` | Web research on each row |

## Usage

### Workflow Pattern

EveryRow operations are asynchronous. The recommended pattern is:

```
[Start Task] → [Get Status] → [Sleep 2min] → [Get Status] → [Get Results]
```

For longer tasks (like Agent Map with web research), increase the sleep duration.

### Example: Rank Products

1. Add **EveryRow → Start Rank Task**
   - Input Data: Your JSON array of products
   - Task: "Rank by value for money considering price and features"
   - Field Name: "score"

2. Add **EveryRow → Get Task Status**
   - Task ID: `{{previous.taskId}}`

3. Add **Tools → Sleep** (120 seconds)

4. Add **EveryRow → Get Task Status** again

5. Add **EveryRow → Get Task Results**
   - Task ID: `{{startRankTask.taskId}}`

## Modules Reference

### Start Rank Task

Scores and sorts items based on AI evaluation.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | JSON array of objects to rank |
| Task | Yes | Description of ranking criteria |
| Field Name | Yes | Output field name for the score (default: "score") |
| Ascending Order | No | Sort lowest to highest (default: false) |

### Start Screen Task

Filters rows based on complex criteria.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | JSON array of objects to filter |
| Task | Yes | Description of filtering criteria |

### Start Dedupe Task

Removes duplicate rows using AI-powered matching.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | JSON array of objects to deduplicate |
| Equivalence Relation | Yes | Natural language description of what makes rows duplicates |

### Start Merge Task

Joins two tables using AI-powered matching.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Left Table | Yes | Primary JSON array of objects |
| Right Table | Yes | Secondary JSON array to join |
| Task | Yes | Description of how to match rows |
| Left Key | No | Optional column name to match on from left table |
| Right Key | No | Optional column name to match on from right table |

### Start Agent Map Task

Runs web research on each row.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Input Data | Yes | JSON array of objects to research |
| Task | Yes | Description of research to perform |
| Effort Level | No | low, medium, or high (default: low) |

### Get Task Status

Checks the status of a running task.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Task ID | Yes | ID returned from Start Task module |

**Returns:** `taskId`, `status` (pending, running, completed, failed), `artifactId`, `error`

### Get Task Results

Retrieves results from a completed task.

| Parameter | Required | Description |
|-----------|----------|-------------|
| Task ID | Yes | ID from Start Task module |

**Returns:** Array of result objects (each row as a separate bundle)

## Tips

### Input Data Format

Input data should be a JSON array of objects:

```json
[
  {"name": "Product A", "price": 100, "rating": 4.5},
  {"name": "Product B", "price": 150, "rating": 4.8}
]
```

Use `{{toString(yourArray)}}` to convert data from other Make.com modules to JSON.

### Handling Large Datasets

For datasets with many rows:
- Increase the Sleep duration (3-5 minutes)
- Consider using a polling loop with a Repeater module
- Agent Map tasks take longer due to web research

### Error Handling

Check the `status` field from Get Task Status:
- `completed` - Task finished successfully, get results
- `failed` - Check the `error` field for details
- `pending` / `running` - Task still processing, wait longer

## Support

- [EveryRow Documentation](https://everyrow.io/docs)
- [Make.com Community](https://community.make.com)
- [GitHub Issues](https://github.com/futuresearch/everyrow-make/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.
