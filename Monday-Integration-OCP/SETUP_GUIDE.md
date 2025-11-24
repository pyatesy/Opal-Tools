# Monday.com Integration OCP - Setup Guide

## Project Structure

This OCP application follows the same structure as the Sample Size Calculator OCP project:

```
Monday-Integration-OCP/
├── app.yml                    # OCP app manifest
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── eslint.config.mjs          # ESLint configuration
├── jest.config.mjs            # Jest test configuration
├── .gitignore                # Git ignore rules
├── README.md                  # Main documentation
├── SETUP_GUIDE.md            # This file
├── src/
│   ├── index.ts              # Entry point (exports)
│   ├── functions/
│   │   └── OpalToolFunction.ts    # Main tool class with all @tool decorators
│   ├── clients/
│   │   └── MondayClient.ts       # Monday.com GraphQL API client
│   └── lifecycle/
│       └── Lifecycle.ts          # OCP lifecycle hooks (install, upgrade, etc.)
├── forms/
│   └── settings.yml          # OCP settings form configuration
└── assets/
    └── directory/
        └── overview.md       # App directory overview
```

## Key Components

### 1. MondayClient (`src/clients/MondayClient.ts`)
- Handles all Monday.com GraphQL API interactions
- Methods:
  - `listBoards()` - Get all accessible boards
  - `getBoard()` - Get board details with columns and items
  - `createItem()` - Create a new item
  - `updateItemColumnValue()` - Update column values
  - `getItem()` - Get item details
  - `createItemsBatch()` - Create multiple items
  - `getBoardGroups()` - Get board groups

### 2. OpalToolFunction (`src/functions/OpalToolFunction.ts`)
- Main tool class extending `ToolFunction`
- Implements 7 tools:
  1. `list_boards` - List Monday.com boards
  2. `get_board` - Get board details
  3. `create_item` - Create a new item
  4. `update_item_column` - Update item column value
  5. `get_item` - Get item details
  6. `create_items_batch` - Batch create items
  7. `create_research_item` - Create items from Opal research data (with auto-mapping)

### 3. Lifecycle (`src/lifecycle/Lifecycle.ts`)
- Handles OCP app lifecycle events:
  - `onInstall()` - Sets up function URLs
  - `onSettingsForm()` - Handles API token validation
  - `onUpgrade()` - Updates function URLs on upgrade

### 4. Settings Form (`forms/settings.yml`)
- Configuration UI for:
  - Opal tool discovery URL (read-only)
  - Monday.com API token (secret field)
  - Token validation button

## Next Steps

### 1. Install Dependencies
```bash
cd Tools/Monday-Integration-OCP
yarn install
```

### 2. Build the Project
```bash
yarn build
```

### 3. Validate the App
```bash
yarn validate
```

### 4. Deploy to OCP
- Use OCP CLI to deploy
- Register the app in your OCP account
- Configure Monday.com API token in settings

### 5. Add to Opal
- Copy the discovery URL from app settings
- Add it to Opal tools registry
- Start using the tools in your Opal agents!

## Differences from Sample Size Calculator

1. **External API Integration**: Uses Monday.com GraphQL API instead of internal calculations
2. **Authentication**: Uses API token stored in OCP settings (not bearer token)
3. **Multiple Tools**: 7 tools vs 1 tool in sample calculator
4. **Data Transformation**: Includes research data transformation logic
5. **Client Class**: Separate MondayClient class for API interactions

## Testing

To test the tools locally (after deployment):

1. Use the Opal discovery endpoint to see available tools
2. Call individual tool endpoints with test data
3. Verify Monday.com API responses

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `yarn install`
- Check TypeScript version matches: `tsc --version`
- Verify node-fetch is installed (used by MondayClient)

### Runtime Errors
- Verify Monday.com API token is configured
- Check API token has correct permissions
- Verify board/item IDs are correct

### Import Errors
- Ensure all paths are relative (../clients/MondayClient)
- Check that index.ts exports all required classes

## API Token Setup

1. Go to Monday.com → Profile → Admin → API
2. Click "Generate new token"
3. Copy the token
4. Paste in OCP app settings → "Monday.com Authentication"
5. Click "Validate & Save Token"

The token will be stored securely in OCP's encrypted settings store.

