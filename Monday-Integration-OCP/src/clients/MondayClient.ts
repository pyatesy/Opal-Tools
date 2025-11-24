import { logger } from '@zaiusinc/app-sdk';
import fetch from 'node-fetch';

/**
 * Monday.com GraphQL API Client
 * Handles all interactions with Monday.com's GraphQL API
 */
export class MondayClient {
  private apiToken: string;
  private baseUrl: string = 'https://api.monday.com/v2';

  public constructor(apiToken: string) {
    if (!apiToken || apiToken.trim() === '') {
      throw new Error('Monday.com API token is required');
    }
    this.apiToken = apiToken;
  }

  /**
   * Execute a GraphQL query or mutation
   */
  private async executeGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
    const startTime = Date.now();
    const operationType = query.trim().startsWith('mutation') ? 'mutation' : 'query';
    const operationName = this.extractOperationName(query);

    logger.info(`[Monday API] Starting ${operationType}: ${operationName}`);
    logger.debug('[Monday API] Request URL:', this.baseUrl);
    logger.debug('[Monday API] GraphQL Query:', query);
    logger.debug('[Monday API] Variables:', JSON.stringify(variables || {}, null, 2));

    try {
      const requestBody = {
        query,
        variables: variables || {}
      };

      logger.debug('[Monday API] Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json',
          'API-Version': '2024-01'
        },
        body: JSON.stringify(requestBody)
      });

      const responseTime = Date.now() - startTime;
      const statusMsg = `[Monday API] Response received in ${responseTime}ms - ` +
        `Status: ${response.status} ${response.statusText}`;
      logger.info(statusMsg);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Monday API] HTTP Error ${response.status}:`, errorText);
        logger.error('[Monday API] Failed request details:', {
          url: this.baseUrl,
          method: 'POST',
          status: response.status,
          responseBody: errorText,
          statusText: response.statusText,
          query: operationName,
          variables: variables || {}
        });
        throw new Error(`Monday.com API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as { data?: any; errors?: Array<{ message?: string }> };

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((e: { message?: string; locations?: any; path?: any }) => {
          const msg = e.message || 'Unknown error';
          // Include more context if available
          if (e.locations || e.path) {
            return `${msg} (locations: ${JSON.stringify(e.locations)}, path: ${JSON.stringify(e.path)})`;
          }
          return msg;
        }).join(', ');

        // Log the full error response for debugging
        logger.error(`[Monday API] GraphQL errors in ${operationName}:`, JSON.stringify(result.errors, null, 2));
        logger.error('[Monday API] Request that caused error:', {
          operation: operationName,
          query,
          variables: JSON.stringify(variables || {}, null, 2)
        });
        logger.error(`[Monday API] Response time: ${responseTime}ms`);

        throw new Error(`Monday.com GraphQL errors: ${errorMessages}`);
      }

      const successMsg = `[Monday API] ${operationType} ${operationName} completed successfully in ${responseTime}ms`;
      logger.info(successMsg);
      logger.debug('[Monday API] Response data:', JSON.stringify(result.data, null, 2));

      return result.data;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      logger.error(`[Monday API] Request failed after ${responseTime}ms:`, {
        operation: operationName,
        error: error.message,
        stack: error.stack,
        query: operationName,
        variables: variables || {}
      });
      throw error;
    }
  }

  /**
   * Extract operation name from GraphQL query/mutation
   */
  private extractOperationName(query: string): string {
    // Try to extract operation name from query
    const mutationMatch = query.match(/mutation\s+(\w+)?/);
    const queryMatch = query.match(/query\s+(\w+)?/);

    if (mutationMatch && mutationMatch[1]) {
      return mutationMatch[1];
    }
    if (queryMatch && queryMatch[1]) {
      return queryMatch[1];
    }

    // Try to extract from first field name
    const fieldMatch = query.match(/(\w+)\s*\(/);
    if (fieldMatch) {
      return fieldMatch[1];
    }

    return 'unknown_operation';
  }

  /**
   * List all boards accessible to the user
   */
  public async listBoards(limit: number = 50): Promise<any> {
    logger.info(`[Monday API] listBoards called with limit: ${limit}`);

    const query = `
      query ($limit: Int!) {
        boards(limit: $limit, order_by: created_at) {
          id
          name
          description
          board_kind
          state
          workspace {
            id
            name
          }
        }
      }
    `;

    const data = await this.executeGraphQL(query, { limit });
    const boardCount = data.boards?.length || 0;

    logger.info(`[Monday API] listBoards completed - found ${boardCount} boards`);
    const boardIds = (data.boards as Array<{ id: string }>)?.map((b) => b.id) || [];
    logger.debug('[Monday API] Board IDs:', boardIds);
    return {
      success: true,
      data: data.boards || []
    };
  }

  /**
   * Get board details including columns and items
   */
  public async getBoard(boardId: string | number): Promise<any> {
    logger.info(`[Monday API] getBoard called for boardId: ${boardId}`);

    const query = `
      query ($boardId: [ID!]!) {
        boards(ids: $boardId) {
          id
          name
          description
          board_kind
          state
          workspace {
            id
            name
          }
          groups {
            id
            title
            position
          }
          columns {
            id
            title
            description
            type
            settings_str
          }
          items_page(limit: 50) {
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      }
    `;

    const data = await this.executeGraphQL(query, { boardId: [String(boardId)] });
    const board = data.boards?.[0];

    if (!board) {
      logger.error(`[Monday API] Board with ID ${boardId} not found`);
      throw new Error(`Board with ID ${boardId} not found`);
    }

    const columnCount = board.columns?.length || 0;
    const groupCount = board.groups?.length || 0;
    const itemCount = board.items_page?.items?.length || 0;

    logger.info(`[Monday API] getBoard completed for board "${board.name}" (${board.id})`);
    logger.debug('[Monday API] Board details:', {
      boardId: board.id,
      boardName: board.name,
      columnCount,
      groupCount,
      itemCount,
      boardKind: board.board_kind,
      state: board.state
    });
    const columnTypes = (board.columns as Array<{ id: string; type: string; title?: string }>)?.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title
    })) || [];
    logger.debug('[Monday API] Column types:', columnTypes);

    return {
      success: true,
      data: board
    };
  }

  /**
   * Create a new item on a board
   */
  public async createItem(
    boardId: string | number,
    itemName: string,
    groupId?: string,
    columnValues?: Record<string, any>
  ): Promise<any> {
    logger.info('[Monday API] createItem called:', {
      boardId: String(boardId),
      itemName,
      groupId: groupId || 'none',
      columnValueCount: columnValues ? Object.keys(columnValues).length : 0
    });

    // Convert column values to Monday.com's JSON format
    let columnValuesJson = '{}';
    if (columnValues && Object.keys(columnValues).length > 0) {
      logger.debug(`[Monday API] Processing ${Object.keys(columnValues).length} column values`);
      logger.debug('[Monday API] Raw column values:', JSON.stringify(columnValues, null, 2));

      // Fetch board columns to get column type information
      logger.debug('[Monday API] Fetching board columns for type detection');
      const boardResult = await this.getBoard(boardId);
      const columnTypes = new Map<string, string>();
      if (boardResult.data?.columns && Array.isArray(boardResult.data.columns)) {
        (boardResult.data.columns as Array<{ id: string; type: string; title?: string }>).forEach((col) => {
          columnTypes.set(col.id, col.type);
          // Log column info for debugging
          const colTitle = col.title || 'N/A';
          logger.debug(`[Monday API] Column detected: ${col.id}, Type: ${col.type}, Title: ${colTitle}`);
        });
        logger.info(`[Monday API] Loaded ${columnTypes.size} column types from board`);
      } else {
        logger.warn('[Monday API] No columns found in board data, column type detection will rely on ID inference');
      }

      const formattedValues: Record<string, any> = {};

      for (const [columnId, value] of Object.entries(columnValues)) {
        logger.debug(`[Monday API] Formatting column ${columnId} with value:`, value);
        // Format value based on column type
        const columnType = columnTypes.get(columnId);
        if (!columnType) {
          // If column type not found, try to infer from column ID pattern
          // Monday.com column IDs often include the type prefix (e.g., "numeric_", "text_", "status_")
          const inferredType = this.inferColumnTypeFromId(columnId);
          logger.warn(`[Monday API] Column type not found for column ${columnId}, inferred type: ${inferredType}`);
          formattedValues[columnId] = this.formatColumnValue(value, inferredType);
        } else {
          logger.debug(`[Monday API] Using detected column type "${columnType}" for column ${columnId}`);
          formattedValues[columnId] = this.formatColumnValue(value, columnType);
        }
        logger.debug(`[Monday API] Formatted value for ${columnId}:`, JSON.stringify(formattedValues[columnId]));
      }

      // Log the formatted values for debugging
      logger.info('[Monday API] Formatted column values:', JSON.stringify(formattedValues, null, 2));
      columnValuesJson = JSON.stringify(formattedValues);
      logger.debug('[Monday API] Column values JSON string:', columnValuesJson);
    } else {
      logger.debug('[Monday API] No column values provided, creating item with name only');
    }

    const mutation = `
      mutation ($boardId: ID!, $itemName: String!, $groupId: String, $columnValues: JSON) {
        create_item(
          board_id: $boardId
          item_name: $itemName
          group_id: $groupId
          column_values: $columnValues
        ) {
          id
          name
          board {
            id
            name
          }
          group {
            id
            title
          }
        }
      }
    `;

    const variables: any = {
      boardId: String(boardId),
      itemName,
      columnValues: columnValuesJson
    };

    if (groupId) {
      variables.groupId = groupId;
    }

    logger.debug('[Monday API] createItem mutation variables:', JSON.stringify(variables, null, 2));

    const data = await this.executeGraphQL(mutation, variables);

    logger.info('[Monday API] createItem completed successfully:', {
      itemId: data.create_item?.id,
      itemName: data.create_item?.name,
      boardId: data.create_item?.board?.id,
      groupId: data.create_item?.group?.id
    });

    return {
      success: true,
      data: data.create_item
    };
  }

  /**
   * Update an item's column values
   */
  public async updateItemColumnValue(
    boardId: string | number,
    itemId: string | number,
    columnId: string,
    value: any
  ): Promise<any> {
    logger.info('[Monday API] updateItemColumnValue called:', {
      boardId: String(boardId),
      itemId: String(itemId),
      columnId,
      rawValue: value
    });

    // Fetch board columns to get column type information
    logger.debug('[Monday API] Fetching board columns for type detection');
    const boardResult = await this.getBoard(boardId);
    const columnTypes = new Map<string, string>();
    if (boardResult.data?.columns && Array.isArray(boardResult.data.columns)) {
      (boardResult.data.columns as Array<{ id: string; type: string; title?: string }>).forEach((col) => {
        columnTypes.set(col.id, col.type);
        const colTitle = col.title || 'N/A';
        logger.debug(`[Monday API] Column detected: ${col.id}, Type: ${col.type}, Title: ${colTitle}`);
      });
      logger.info(`[Monday API] Loaded ${columnTypes.size} column types from board`);
    } else {
      logger.warn('[Monday API] No columns found in board data, column type detection will rely on ID inference');
    }

    // Get column type, with fallback to inference
    let columnType = columnTypes.get(columnId);
    if (!columnType) {
      // If column type not found, try to infer from column ID pattern
      columnType = this.inferColumnTypeFromId(columnId);
      logger.warn(`[Monday API] Column type not found for column ${columnId}, inferred type: ${columnType}`);
    } else {
      logger.debug(`[Monday API] Using detected column type "${columnType}" for column ${columnId}`);
    }

    logger.debug(`[Monday API] Formatting value for column ${columnId} (type: ${columnType}):`, value);
    const formattedValue = this.formatColumnValue(value, columnType);
    logger.info(`[Monday API] Formatted column value for ${columnId}:`, JSON.stringify(formattedValue));
    const valueJson = JSON.stringify(formattedValue);
    logger.debug('[Monday API] Formatted value JSON string:', valueJson);

    const mutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
        change_column_value(
          board_id: $boardId
          item_id: $itemId
          column_id: $columnId
          value: $value
        ) {
          id
          name
        }
      }
    `;

    const variables = {
      boardId: String(boardId),
      itemId: String(itemId),
      columnId,
      value: valueJson
    };

    logger.debug('[Monday API] updateItemColumnValue mutation variables:', JSON.stringify(variables, null, 2));

    const data = await this.executeGraphQL(mutation, variables);

    logger.info('[Monday API] updateItemColumnValue completed successfully:', {
      itemId: data.change_column_value?.id,
      itemName: data.change_column_value?.name
    });

    return {
      success: true,
      data: data.change_column_value
    };
  }

  /**
   * Get item details
   */
  public async getItem(itemId: string | number): Promise<any> {
    logger.info(`[Monday API] getItem called for itemId: ${itemId}`);

    const query = `
      query ($itemId: [ID!]!) {
        items(ids: $itemId) {
          id
          name
          board {
            id
            name
          }
          group {
            id
            title
          }
          column_values {
            id
            text
            value
            type
            column {
              id
              title
              description
              type
            }
          }
          created_at
          updated_at
        }
      }
    `;

    const data = await this.executeGraphQL(query, { itemId: [String(itemId)] });
    const item = data.items?.[0];

    if (!item) {
      logger.error(`[Monday API] Item with ID ${itemId} not found`);
      throw new Error(`Item with ID ${itemId} not found`);
    }

    logger.info(`[Monday API] getItem completed for item "${item.name}" (${item.id})`);
    logger.debug('[Monday API] Item details:', {
      itemId: item.id,
      itemName: item.name,
      boardId: item.board?.id,
      groupId: item.group?.id,
      columnValueCount: item.column_values?.length || 0
    });

    return {
      success: true,
      data: item
    };
  }

  /**
   * Create multiple items in a batch
   */
  public async createItemsBatch(
    boardId: string | number,
    items: Array<{ name: string; groupId?: string; columnValues?: Record<string, any> }>
  ): Promise<any> {
    logger.info('[Monday API] createItemsBatch called:', {
      boardId: String(boardId),
      itemCount: items.length
    });

    // Monday.com doesn't have a native batch create, so we'll create items sequentially
    const results: Array<{ success: boolean; data?: any; error?: string; itemName?: string }> = [];
    const startTime = Date.now();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      logger.info(`[Monday API] Creating item ${i + 1}/${items.length}: "${item.name}"`);

      try {
        const result = await this.createItem(
          boardId,
          item.name,
          item.groupId,
          item.columnValues
        );
        results.push(result);
        logger.info(`[Monday API] Successfully created item ${i + 1}/${items.length}: "${item.name}"`);
      } catch (error: any) {
        const itemNum = i + 1;
        const errorMsg = `[Monday API] Failed to create item ${itemNum}/${items.length} "${item.name}"`;
        logger.error(errorMsg, {
          error: error.message,
          stack: error.stack
        });
        results.push({
          success: false,
          error: error.message,
          itemName: item.name
        });
      }
    }

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    const avgTime = Math.round(totalTime / items.length);
    logger.info(`[Monday API] createItemsBatch completed in ${totalTime}ms:`, {
      total: items.length,
      successful: successCount,
      failed: failureCount,
      averageTimePerItem: `${avgTime}ms`
    });

    if (failureCount > 0) {
      const failures = results.filter((r) => !r.success).map((r) => ({
        name: r.itemName,
        error: r.error
      }));
      logger.warn(`[Monday API] Batch creation had ${failureCount} failures:`, failures);
    }

    return {
      success: true,
      data: {
        created: results.filter((r) => r.success),
        failed: results.filter((r) => !r.success)
      }
    };
  }

  /**
   * Infer column type from column ID pattern
   * Monday.com column IDs often include type prefix (e.g., "numeric_", "text_", "status_")
   */
  private inferColumnTypeFromId(columnId: string): string | undefined {
    const idLower = columnId.toLowerCase();
    if (idLower.startsWith('numeric_') || idLower.startsWith('numbers_')) {
      return 'numeric';
    }
    if (idLower.startsWith('text_')) {
      return 'text';
    }
    if (idLower.startsWith('long_text_')) {
      return 'long_text';
    }
    if (idLower.startsWith('status_')) {
      return 'status';
    }
    if (idLower.startsWith('date_')) {
      return 'date';
    }
    if (idLower.startsWith('people_')) {
      return 'people';
    }
    if (idLower.startsWith('tags_')) {
      return 'tags';
    }
    if (idLower.startsWith('dropdown_')) {
      return 'dropdown';
    }
    if (idLower.startsWith('rating_')) {
      return 'rating';
    }
    if (idLower.startsWith('checkbox_')) {
      return 'checkbox';
    }
    return undefined;
  }

  /**
   * Format column value based on Monday.com's expected format
   * @param value - The value to format
   * @param columnType - The type of the column (e.g., 'status', 'date', 'people', etc.)
   * @returns Formatted value according to Monday.com API requirements
   */
  private formatColumnValue(value: any, columnType?: string): any {
    logger.debug('[Monday API] formatColumnValue called:', {
      valueType: typeof value,
      value,
      columnType: columnType || 'unknown'
    });
    // If value is already a properly formatted object, return as-is
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check if it's already in the correct format (has expected keys)
      if (
        'label' in value ||
        'date' in value ||
        'personsAndTeams' in value ||
        'tag_ids' in value ||
        'ids' in value ||
        'rating' in value ||
        'checked' in value ||
        'number' in value ||
        'from' in value ||
        'url' in value ||
        'address' in value
      ) {
        return value;
      }
    }

    // Handle based on column type
    if (columnType) {
      switch (columnType.toLowerCase()) {
      case 'status':
        // Status columns require {label: "Status Label"}
        if (typeof value === 'string') {
          // Check if it's already a JSON string with label
          if (value.startsWith('{') && value.includes('label')) {
            try {
              return JSON.parse(value);
            } catch {
              // If parsing fails, treat as label string
              return { label: value };
            }
          }
          return { label: value };
        }
        if (value && typeof value === 'object' && 'label' in value) {
          return value;
        }
        return { label: String(value) };

      case 'date':
        // Date columns require {date: "YYYY-MM-DD"}
        if (typeof value === 'string') {
          return { date: value };
        }
        if (value && typeof value === 'object' && 'date' in value) {
          return value;
        }
        // Try to extract date from Date object or timestamp
        if (value instanceof Date) {
          return { date: value.toISOString().split('T')[0] };
        }
        return { date: String(value) };

      case 'people':
        // People columns require {personsAndTeams: [{id: user_id, kind: "person"}]}
        if (Array.isArray(value)) {
          return {
            personsAndTeams: value.map((item) => {
              if (typeof item === 'object' && 'id' in item) {
                return { id: String(item.id), kind: item.kind || 'person' };
              }
              return { id: String(item), kind: 'person' };
            })
          };
        }
        if (value && typeof value === 'object' && 'personsAndTeams' in value) {
          return value;
        }
        // Single user ID
        return {
          personsAndTeams: [{ id: String(value), kind: 'person' }]
        };

      case 'tags':
        // Tags columns require {tag_ids: [id1, id2]}
        if (Array.isArray(value)) {
          return { tag_ids: value.map((id) => String(id)) };
        }
        if (value && typeof value === 'object' && 'tag_ids' in value) {
          return value;
        }
        // Single tag ID
        return { tag_ids: [String(value)] };

      case 'dropdown':
        // Dropdown columns require {ids: [id1, id2]}
        if (Array.isArray(value)) {
          return { ids: value.map((id) => String(id)) };
        }
        if (value && typeof value === 'object' && 'ids' in value) {
          return value;
        }
        // Single option ID
        return { ids: [String(value)] };

      case 'rating':
        // Rating columns require {rating: number}
        const ratingNum = typeof value === 'number' ? value : Number(value);
        if (!isNaN(ratingNum)) {
          return { rating: Math.max(0, Math.min(5, Math.round(ratingNum))) };
        }
        if (value && typeof value === 'object' && 'rating' in value) {
          return value;
        }
        return { rating: 0 };

      case 'checkbox':
        // Checkbox columns require {checked: "true"} or {checked: "false"}
        if (typeof value === 'boolean') {
          return { checked: value ? 'true' : 'false' };
        }
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
            return { checked: 'true' };
          }
          return { checked: 'false' };
        }
        if (value && typeof value === 'object' && 'checked' in value) {
          return value;
        }
        return { checked: 'false' };

      case 'numeric':
      case 'numbers':
        // Numeric columns: Monday.com API may accept the number directly
        // Based on error patterns, try sending as plain number first
        const numValue = typeof value === 'number' ? value : Number(value);
        if (!isNaN(numValue)) {
          // Try sending as plain number (not wrapped in object)
          // This will be serialized as a number in the JSON string
          return numValue;
        }
        if (value && typeof value === 'object') {
          // If already formatted, extract the numeric value
          if ('value' in value) {
            const existingNum = typeof value.value === 'number' ? value.value : Number(value.value);
            return isNaN(existingNum) ? 0 : existingNum;
          }
          if ('number' in value) {
            // Legacy format - extract number
            const existingNum = typeof value.number === 'number' ? value.number : Number(value.number);
            return isNaN(existingNum) ? 0 : existingNum;
          }
        }
        // Fallback: try to convert to number
        const fallbackNum = Number(value);
        return isNaN(fallbackNum) ? 0 : fallbackNum;

      case 'timeline':
        // Timeline columns require {from: "YYYY-MM-DD", to: "YYYY-MM-DD"}
        if (value && typeof value === 'object') {
          if ('from' in value && 'to' in value) {
            return value;
          }
          if ('start' in value && 'end' in value) {
            return { from: String(value.start), to: String(value.end) };
          }
        }
        // Default: use value as-is if it's an object, otherwise return empty
        return value && typeof value === 'object' ? value : {};

      case 'link':
        // Link columns require {url: "...", text: "..."}
        if (typeof value === 'string') {
          // If it's a URL string, use it as both URL and text
          return { url: value, text: value };
        }
        if (value && typeof value === 'object') {
          if ('url' in value) {
            return {
              url: String(value.url),
              text: value.text ? String(value.text) : String(value.url)
            };
          }
        }
        return value && typeof value === 'object' ? value : { url: '', text: '' };

      case 'location':
        // Location columns require {address: "...", lat: 0, lng: 0}
        if (typeof value === 'string') {
          return { address: value, lat: null, lng: null };
        }
        if (value && typeof value === 'object') {
          return {
            address: value.address ? String(value.address) : '',
            lat: value.lat !== undefined ? Number(value.lat) : null,
            lng: value.lng !== undefined ? Number(value.lng) : null
          };
        }
        return value && typeof value === 'object' ? value : { address: '', lat: null, lng: null };

      case 'text':
        // Text columns accept plain strings
        return String(value);

      case 'long_text':
        // Long text columns require {text: "..."} format
        // Handle case where input has malformed key like "\"text\"" instead of "text"
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Check for "text" key (normal case)
          if ('text' in value) {
            return { text: String(value.text) };
          }
          // Check for "\"text\"" key (malformed input case)
          if ('"text"' in value) {
            return { text: String(value['"text"']) };
          }
          // Check for escaped quotes in keys
          const textKey = Object.keys(value).find((key) => key.includes('text') || key === '"text"');
          if (textKey) {
            return { text: String(value[textKey]) };
          }
          // If object has a single string value, use it
          const values = Object.values(value);
          if (values.length === 1 && typeof values[0] === 'string') {
            return { text: String(values[0]) };
          }
        }
        // If it's already a string, wrap it in the text format
        if (typeof value === 'string') {
          return { text: value };
        }
        return { text: String(value) };

      case 'email':
        // Email columns accept plain strings
        return String(value);

      case 'phone':
        // Phone columns accept plain strings
        return String(value);

      case 'hour':
        // Hour columns require {hour: number, minute: number}
        if (value && typeof value === 'object' && 'hour' in value) {
          return value;
        }
        // Try to parse time string or use defaults
        return { hour: 0, minute: 0 };

      case 'week':
        // Week columns require {week: number, year: number}
        if (value && typeof value === 'object' && 'week' in value) {
          return value;
        }
        return { week: 1, year: new Date().getFullYear() };

      case 'progress_tracking':
        // Progress tracking requires {percentage: number}
        const progressNum = typeof value === 'number' ? value : Number(value);
        if (!isNaN(progressNum)) {
          return { percentage: Math.max(0, Math.min(100, Math.round(progressNum))) };
        }
        if (value && typeof value === 'object' && 'percentage' in value) {
          return value;
        }
        return { percentage: 0 };

      default:
        // For unknown types, try to handle common cases
        // If it's already an object, return as-is
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return value;
        }
        // Otherwise, convert to string
        return String(value);
      }
    }

    // Fallback: if no column type provided, use generic formatting
    if (typeof value === 'string') {
      // Check if it's a JSON string
      if (value.startsWith('{') && value.includes('label')) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (value && typeof value === 'object') {
      // If it's an array, stringify it
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      // If it's an object, return as-is (might be pre-formatted)
      return value;
    }

    return String(value);
  }

  /**
   * Get board groups
   */
  public async getBoardGroups(boardId: string | number): Promise<any> {
    logger.info(`[Monday API] getBoardGroups called for boardId: ${boardId}`);

    const query = `
      query ($boardId: [ID!]!) {
        boards(ids: $boardId) {
          id
          name
          groups {
            id
            title
            position
          }
        }
      }
    `;

    const data = await this.executeGraphQL(query, { boardId: [String(boardId)] });
    const board = data.boards?.[0];

    if (!board) {
      logger.error(`[Monday API] Board with ID ${boardId} not found`);
      throw new Error(`Board with ID ${boardId} not found`);
    }

    const groupCount = board.groups?.length || 0;
    logger.info(`[Monday API] getBoardGroups completed - found ${groupCount} groups for board "${board.name}"`);
    const groups = (board.groups as Array<{ id: string; title: string }>)?.map((g) => ({
      id: g.id,
      title: g.title
    })) || [];
    logger.debug('[Monday API] Groups:', groups);

    return {
      success: true,
      data: board.groups || []
    };
  }
}

