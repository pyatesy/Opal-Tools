# Monday.com Integration OCP Tool

Opal tool for creating and managing Monday.com content from Opal research data.

## Overview

This OCP application provides Opal tools to interact with Monday.com's GraphQL API, enabling you to:
- Create items from Opal research (experiments, audits, etc.)
- List and query Monday.com boards
- Update item column values
- Batch create multiple items

## Features

### Core Tools

1. **list_boards** - List all accessible Monday.com boards
2. **get_board** - Get detailed board information including columns and items
3. **create_item** - Create a new item on a board
4. **update_item_column** - Update a specific column value for an item
5. **get_item** - Get detailed information about an item
6. **create_items_batch** - Create multiple items in a single operation
7. **create_research_item** - Create items from Opal research data with automatic column mapping

## Setup

### Prerequisites

- OCP development account
- Monday.com account with API access
- Node.js 22+

### Installation

1. **Get Monday.com API Token**
   - Log in to Monday.com
   - Go to Profile → Admin → API
   - Generate a new API token
   - Copy the token

2. **Install Dependencies**
   ```bash
   yarn install
   ```

3. **Build the Application**
   ```bash
   yarn build
   ```

4. **Validate the Application**
   ```bash
   yarn validate
   ```

5. **Deploy to OCP**
   - Use OCP CLI to deploy the application
   - Configure the Monday.com API token in the app settings

### Configuration

After installation, configure the Monday.com API token:

1. Go to the app settings in OCP
2. Navigate to "Monday.com Authentication" section
3. Paste your API token
4. Click "Validate & Save Token"

## Usage

### Creating Items from Opal Research

The `create_research_item` tool automatically transforms Opal research data into Monday.com column values:

```json
{
  "boardId": "1234567890",
  "itemName": "Experiment: Add to Bag Push",
  "researchType": "experiment_plan",
  "researchData": {
    "status": "Planning",
    "hypothesis": "Adding a push notification will increase conversions",
    "sample_size": 10000,
    "variants": 2
  }
}
```

### Supported Research Types

- **experiment_plan** / **experiment** - Maps experiment planning data
- **experiment_results** / **results** - Maps experiment results data
- **audit_report** / **audit** - Maps audit/validation report data

### Column Mapping

The tool automatically maps research data fields to Monday.com columns by:
1. Matching column titles (case-insensitive)
2. Matching column IDs directly
3. Using common field names (status, hypothesis, outcome, etc.)

## API Reference

### Monday.com GraphQL API

This tool uses Monday.com's GraphQL API v2:
- Base URL: `https://api.monday.com/v2`
- Authentication: API token in Authorization header
- API Version: 2024-01

### Tool Endpoints

All tools are available via the Opal discovery endpoint:
- Discovery: `{function_url}/discovery`
- Tools: `{function_url}/{tool_endpoint}`

## Development

### Project Structure

```
Monday-Integration-OCP/
├── app.yml                    # OCP app manifest
├── package.json               # Dependencies
├── src/
│   ├── functions/
│   │   └── OpalToolFunction.ts    # Main tool class
│   ├── clients/
│   │   └── MondayClient.ts        # Monday.com API client
│   ├── lifecycle/
│   │   └── Lifecycle.ts            # OCP lifecycle hooks
│   └── index.ts                   # Entry point
├── forms/
│   └── settings.yml           # OCP settings form
└── README.md                  # This file
```

### Building

```bash
# Install dependencies
yarn install

# Build TypeScript
yarn build

# Run linter
yarn lint

# Run tests
yarn test

# Validate OCP app
yarn validate
```

## Security

- API tokens are stored securely in OCP's encrypted settings store
- All API requests use HTTPS
- Token validation is performed on save
- Permissions are inherited from your Monday.com account

## Troubleshooting

### "API token not configured" error
- Ensure you've added your Monday.com API token in the app settings
- Verify the token is valid by checking Monday.com's API page

### "Board not found" error
- Verify the board ID is correct
- Ensure your API token has access to the board
- Check that the board hasn't been archived

### Column mapping issues
- Use `get_board` to see available columns and their IDs
- Column titles are matched case-insensitively
- Use column IDs directly for more reliable mapping

## Resources

- [Monday.com API Documentation](https://developer.monday.com/api-reference/docs)
- [Monday.com GraphQL Guide](https://developer.monday.com/api-reference/docs/graphql)
- [OCP Documentation](https://docs.developers.optimizely.com/optimizely-connect-platform/docs)

## License

UNLICENSED

