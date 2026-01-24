# EveryRow Make.com Templates

Example scenario blueprints for using EveryRow with Make.com. These templates use standard HTTP Request modules, so they work without installing the custom app.

## Prerequisites

1. **EveryRow API Key** - Get one at [everyrow.io/settings/api-keys](https://everyrow.io/settings/api-keys)

## How to Import a Blueprint

1. In Make.com, go to **Scenarios** → **Create a new scenario**
2. Click the **...** menu (three dots) in the bottom toolbar
3. Select **Import Blueprint**
4. Paste the contents of one of the blueprint JSON files
5. Click **Save**

## After Import

1. Click on the first module (**Set Variables**)
2. Replace `YOUR_EVERYROW_API_KEY` with your actual API key
3. Click **OK** to save
4. Click **Run once** to test the scenario

## Available Templates

### everyrow-rank-blueprint.json

**Rank Companies by AI Relevance**

Scores and sorts a list of companies based on their relevance to AI infrastructure.

- Sample data: 8 tech companies (OpenAI, Stripe, Anthropic, etc.)
- Expected output: Companies sorted by AI relevance score (0-100) with reasoning

---

### everyrow-dedupe-blueprint.json

**Deduplicate Company List**

Removes duplicate entries using AI-powered matching that understands variations like "OpenAI" vs "Open AI" or "Stripe" vs "Stripe Inc".

- Sample data: 8 company entries with intentional duplicates
- Expected output: ~4 unique companies

---

### everyrow-screen-blueprint.json

**Filter AI-Focused Companies**

Filters a list to only include companies primarily focused on AI/ML technology.

- Sample data: 8 tech companies with mixed focus areas
- Expected output: Only AI-focused companies (OpenAI, Anthropic, Scale AI, Databricks)

---

### everyrow-merge-blueprint.json

**Merge Company Tables**

Joins two tables using AI-powered name matching.

- Sample data:
  - Left table: Companies with products (OpenAI→ChatGPT, etc.)
  - Right table: Companies with CEO and HQ info
- Expected output: Merged table with product, CEO, and HQ fields

---

### everyrow-agent-map-blueprint.json

**Research Company Funding**

Runs web research on each company to find their latest funding information.

- Sample data: 3 AI companies (OpenAI, Anthropic, Mistral AI)
- Expected output: Each company enriched with funding amount, date, round type, and lead investors

**Note:** Agent Map tasks take longer (30-120 seconds) as they perform actual web research.

---

## Workflow Pattern

All templates follow the EveryRow async pattern:

```
[Set Variables] → [Create Session] → [Create Artifact] → [Wait] → [Poll Status]
                                                                        ↓
                        [Submit Task] → [Wait] → [Poll Status] → [Fetch Results]
```

Since EveryRow operations are AI-powered and may take time, the workflow:
1. Creates a session to group related operations
2. Creates an input artifact from your data
3. Submits the AI task (rank, dedupe, screen, merge, or agent)
4. Polls for completion
5. Fetches the results

## Customizing Templates

### Using Your Own Data

In the **Set Variables** module, replace the sample JSON with your data:

```json
[
  {"field1": "value1", "field2": "value2"},
  {"field1": "value3", "field2": "value4"}
]
```

### Connecting to Other Modules

Replace the Set Variables module with data from:
- **Google Sheets** - Read rows from a spreadsheet
- **Airtable** - Query records from a base
- **HTTP** - Fetch data from an API
- **Webhooks** - Receive data from external triggers

Then update the `{{1.inputData}}` references to point to your data source.

### Adjusting Wait Times

The Sleep modules have default wait times based on typical operation duration:
- Artifact creation: 3 seconds
- Rank/Dedupe/Screen: 10 seconds
- Merge: 15 seconds
- Agent Map: 30 seconds

For larger datasets, increase these values.

### Adding Polling Loops

The templates use fixed waits for simplicity. For production use, add a Router after status polling to:
- Continue if `status = completed`
- Loop back to wait if `status = running`
- Handle errors if `status = failed`

## Troubleshooting

### "Unauthorized" error
Check that your API key is correct in the Set Variables module.

### Task status is "running" at the end
The task needs more time. Increase the Sleep timeout or add a polling loop.

### Empty results / "artifact_id is undefined"
The task may have failed. Check the Poll Status output for error details.

### JSON parsing errors
Make sure your input data is valid JSON. Use a JSON validator if needed.

## Using the Custom App Instead

If you prefer using the EveryRow custom app modules (friendlier UI, connection management), the app needs to be deployed to your Make.com account first. See the main README for deployment instructions.

The custom app provides dedicated modules like "Start Rank Task" and "Get Task Results" that handle the API details for you.

## Support

- [EveryRow Documentation](https://everyrow.io/docs)
- [Make.com Community](https://community.make.com)
- [GitHub Issues](https://github.com/futuresearch/make-app-everyrow/issues)
