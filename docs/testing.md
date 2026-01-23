# Testing the EveryRow Make.com Integration

## Test API Key

For development and testing, use this API key:
```
***REMOVED***
```

**Note:** This is a test key with limited credits. Do not use for production.

## Setting Up in Make.com

### 1. Create a Custom App

1. Log in to Make.com
2. Go to **Apps** → **Create a new App**
3. Name it "EveryRow (Dev)"
4. Set the app to "Private" for testing

### 2. Import Components

Import each file from the `app/` directory:

1. **Base**: Copy contents of `app/base.imljson` into the Base tab
2. **Common**: Copy contents of `app/common.imljson` into the Common Data tab
3. **Connection**: Create a new connection, paste from `app/connections/everyrow-api.imljson`
4. **Modules**: Create each module type and paste corresponding JSON

### 3. Test the Connection

1. Create a new scenario
2. Add any EveryRow module
3. Click "Create a connection"
4. Enter the test API key
5. Click "Save" - should show your email if successful

## Test Scenarios

### Test 1: Rank Operation

**Input Data:**
```json
[
  {"name": "Apple", "category": "tech", "revenue": 394000},
  {"name": "Microsoft", "category": "tech", "revenue": 211000},
  {"name": "Amazon", "category": "retail", "revenue": 514000},
  {"name": "Tesla", "category": "auto", "revenue": 81000}
]
```

**Configuration:**
- Task: "Rank by innovation and market impact"
- Field Name: "innovation_score"
- Field Type: Float
- Ascending Order: false

**Expected Flow:**
1. Start Rank Task → Returns taskId
2. Sleep (5 seconds)
3. Get Task Status → Check if completed
4. If pending, loop back to Sleep
5. If completed, Get Task Results

### Test 2: Dedupe Operation

**Input Data:**
```json
[
  {"name": "John Smith", "email": "john@example.com"},
  {"name": "J. Smith", "email": "jsmith@example.com"},
  {"name": "Jane Doe", "email": "jane@example.com"},
  {"name": "John Smith Jr", "email": "john.smith@example.com"}
]
```

**Configuration:**
- Equivalence Relation: "Two rows are duplicates if they refer to the same person, considering name variations like initials, suffixes (Jr, Sr), and different email addresses"

### Test 3: Screen Operation

**Input Data:**
```json
[
  {"company": "Google", "industry": "Technology", "employees": 150000},
  {"company": "Local Bakery", "industry": "Food", "employees": 5},
  {"company": "Salesforce", "industry": "Technology", "employees": 70000},
  {"company": "Mom's Diner", "industry": "Food", "employees": 12}
]
```

**Configuration:**
- Task: "Keep only technology companies with more than 50,000 employees"

### Test 4: Merge Operation

**Left Table:**
```json
[
  {"company": "Apple Inc", "ticker": "AAPL"},
  {"company": "Microsoft Corporation", "ticker": "MSFT"},
  {"company": "Alphabet", "ticker": "GOOGL"}
]
```

**Right Table:**
```json
[
  {"name": "Apple", "ceo": "Tim Cook"},
  {"name": "Microsoft", "ceo": "Satya Nadella"},
  {"name": "Google", "ceo": "Sundar Pichai"}
]
```

**Configuration:**
- Task: "Match companies by name, accounting for variations like 'Inc', 'Corporation', and parent/subsidiary relationships"
- Left Key: "company"
- Right Key: "name"

### Test 5: Agent Map Operation

**Input Data:**
```json
[
  {"company": "Stripe"},
  {"company": "Figma"}
]
```

**Configuration:**
- Task: "Find the company's founding year, headquarters location, and main product"
- Effort Level: Medium
- Response Schema:
```json
{
  "founding_year": {"type": "int", "description": "Year the company was founded"},
  "headquarters": {"type": "str", "description": "City and country of HQ"},
  "main_product": {"type": "str", "description": "Primary product or service"}
}
```

## Debugging

### Common Issues

1. **Connection fails with "Invalid API key"**
   - Check the API key is correctly entered
   - Ensure no extra spaces before/after the key

2. **Task stays in "pending" forever**
   - Check EveryRow dashboard for errors
   - Ensure input data is valid JSON

3. **"Insufficient balance" error**
   - The test API key may have run out of credits
   - Contact EveryRow support for more test credits

### Viewing Logs

1. In Make.com scenario editor, click the module
2. Check "Input" and "Output" tabs
3. For API errors, check the full response body

### EveryRow Dashboard

View your sessions and tasks at: https://everyrow.io/dashboard

## Polling Pattern Blueprint

Here's a reusable polling pattern for Make.com:

```
┌─────────────────┐
│  Start Task     │
│  (any module)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sleep          │
│  (5 seconds)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Get Status     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Router         │
│  ┌───────────┐  │
│  │ completed │──┼──► Get Results
│  ├───────────┤  │
│  │ failed    │──┼──► Error Handler
│  ├───────────┤  │
│  │ otherwise │──┼──► Loop to Sleep (use Repeater)
│  └───────────┘  │
└─────────────────┘
```

## Performance Notes

- **Rank/Dedupe/Screen**: Usually complete in 5-30 seconds
- **Merge**: 10-60 seconds depending on table sizes
- **Agent Map**: 30 seconds to several minutes per row depending on effort level

Set your polling interval accordingly to avoid unnecessary API calls.
