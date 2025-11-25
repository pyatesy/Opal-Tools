import { logger } from '@zaiusinc/app-sdk';
import { ToolFunction, tool, ParameterType, OptiIdAuthData } from '@optimizely-opal/opal-tool-ocp-sdk';
import { storage } from '@zaiusinc/app-sdk';
import { MondayClient } from '../clients/MondayClient';

// Define interfaces for parameters
interface ListBoardsParameters {
  limit?: number;
}

interface GetBoardParameters {
  boardId: string;
}

interface CreateItemParameters {
  boardId: string;
  itemName: string;
  groupId?: string;
  columnValues?: Record<string, any>;
}

interface UpdateItemColumnParameters {
  boardId: string;
  itemId: string;
  columnId: string;
  value: any;
}

interface GetItemParameters {
  itemId: string;
}

interface CreateItemsBatchParameters {
  boardId: string;
  items: Array<{
    name: string;
    groupId?: string;
    columnValues?: Record<string, any>;
  }>;
}

interface CreateResearchItemParameters {
  boardId: string;
  itemName: string;
  researchType: string;
  researchData: Record<string, any>;
  groupId?: string;
}

interface UploadFileParameters {
  fileData: string; // Base64 encoded file data
  fileName: string;
  fileType?: string; // Optional MIME type
}

interface AddFileToItemParameters {
  itemId: string;
  columnId: string;
  fileData: string; // Base64 encoded file data
  fileName: string;
}

interface GetFileParameters {
  fileId: string;
}

interface GetItemFilesParameters {
  itemId: string;
}

interface CreateTagParameters {
  boardId: string;
  tagName: string;
  color?: string;
}

interface GetBoardTagsParameters {
  boardId: string;
}

interface GetItemTagsParameters {
  itemId: string;
  columnId?: string;
}

interface GetItemsByTagParameters {
  boardId: string;
  tagId: string;
}

/**
 * Class that implements the Opal tool functions for Monday.com integration.
 * Requirements:
 * - Must extend the ToolFunction class from the SDK
 * - Name must match the value of entry_point property from app.yml manifest
 * - Name must match the file name
 */
export class OpalToolFunction extends ToolFunction {

  /**
   * Get Monday.com API token from settings
   */
  private async getApiToken(): Promise<string> {
    try {
      const settings = await storage.settings.get('monday_auth');
      const apiToken = settings?.api_token as string;

      if (!apiToken || apiToken.trim() === '') {
        throw new Error('Monday.com API token not configured. Please add your API token in the app settings.');
      }

      return apiToken;
    } catch (error: any) {
      logger.error('Failed to get Monday.com API token:', error);
      throw new Error('Monday.com API token not configured. Please configure it in the app settings.');
    }
  }

  /**
   * Optional: Override the ready() method to check if the function is ready to process requests
   */
  protected async ready(): Promise<boolean> {
    try {
      // Check if API token is configured
      await this.getApiToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all boards accessible to the user
   */
  @tool({
    name: 'monday_list_boards',
    description: 'List all Monday.com boards accessible to the authenticated user',
    parameters: [
      {
        name: 'limit',
        type: ParameterType.Integer,
        description: 'Maximum number of boards to return (default: 50)',
        required: false
      }
    ],
    endpoint: '/monday_list_boards'
  })
  public async mondayListBoards(params: ListBoardsParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('List boards tool called');

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const limit = params.limit || 50;
      const result = await client.listBoards(limit);

      return result;
    } catch (error: any) {
      logger.error('Error listing boards:', error);
      return {
        success: false,
        message: `Error listing boards: ${error.message}`
      };
    }
  }

  /**
   * Get board details including columns and items
   */
  @tool({
    name: 'monday_get_board',
    description: 'Get detailed information about a Monday.com board including columns, groups, and items',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board to retrieve',
        required: true
      }
    ],
    endpoint: '/monday_get_board'
  })
  public async mondayGetBoard(params: GetBoardParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get board tool called', { boardId: params.boardId });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getBoard(params.boardId);

      return result;
    } catch (error: any) {
      logger.error('Error getting board:', error);
      return {
        success: false,
        message: `Error getting board: ${error.message}`
      };
    }
  }

  /**
   * Create a new item on a board
   */
  @tool({
    name: 'monday_create_item',
    description: 'Create a new item on a Monday.com board',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board where the item will be created',
        required: true
      },
      {
        name: 'itemName',
        type: ParameterType.String,
        description: 'The name/title of the item to create',
        required: true
      },
      {
        name: 'groupId',
        type: ParameterType.String,
        description: 'The ID of the group where the item will be created (optional)',
        required: false
      },
      {
        name: 'columnValues',
        type: ParameterType.Dictionary,
        description: 'Column values as key-value pairs where keys are column IDs (optional)',
        required: false
      }
    ],
    endpoint: '/monday_create_item'
  })
  public async mondayCreateItem(params: CreateItemParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Create item tool called', { boardId: params.boardId, itemName: params.itemName });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.createItem(
        params.boardId,
        params.itemName,
        params.groupId,
        params.columnValues
      );

      return result;
    } catch (error: any) {
      logger.error('Error creating item:', error);
      return {
        success: false,
        message: `Error creating item: ${error.message}`
      };
    }
  }

  /**
   * Update an item's column value
   */
  @tool({
    name: 'monday_update_item_column',
    description: 'Update a specific column value for a Monday.com item',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board containing the item',
        required: true
      },
      {
        name: 'itemId',
        type: ParameterType.String,
        description: 'The ID of the item to update',
        required: true
      },
      {
        name: 'columnId',
        type: ParameterType.String,
        description: 'The ID of the column to update',
        required: true
      },
      {
        name: 'value',
        type: ParameterType.String,
        description: 'The new value for the column',
        required: true
      }
    ],
    endpoint: '/monday_update_item_column'
  })
  public async mondayUpdateItemColumn(params: UpdateItemColumnParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Update item column tool called', {
        boardId: params.boardId,
        itemId: params.itemId,
        columnId: params.columnId
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.updateItemColumnValue(
        params.boardId,
        params.itemId,
        params.columnId,
        params.value
      );

      return result;
    } catch (error: any) {
      logger.error('Error updating item column:', error);
      return {
        success: false,
        message: `Error updating item column: ${error.message}`
      };
    }
  }

  /**
   * Get item details
   */
  @tool({
    name: 'monday_get_item',
    description: 'Get detailed information about a Monday.com item',
    parameters: [
      {
        name: 'itemId',
        type: ParameterType.String,
        description: 'The ID of the item to retrieve',
        required: true
      }
    ],
    endpoint: '/monday_get_item'
  })
  public async mondayGetItem(params: GetItemParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get item tool called', { itemId: params.itemId });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getItem(params.itemId);

      return result;
    } catch (error: any) {
      logger.error('Error getting item:', error);
      return {
        success: false,
        message: `Error getting item: ${error.message}`
      };
    }
  }

  /**
   * Create multiple items in a batch
   */
  @tool({
    name: 'monday_create_items_batch',
    description: 'Create multiple items on a Monday.com board in a single operation',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board where items will be created',
        required: true
      },
      {
        name: 'items',
        type: ParameterType.List,
        description: 'Array of items to create, each with name, optional groupId, and optional columnValues',
        required: true
      }
    ],
    endpoint: '/monday_create_items_batch'
  })
  public async mondayCreateItemsBatch(params: CreateItemsBatchParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Create items batch tool called', {
        boardId: params.boardId,
        itemCount: params.items?.length || 0
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.createItemsBatch(params.boardId, params.items);

      return result;
    } catch (error: any) {
      logger.error('Error creating items batch:', error);
      return {
        success: false,
        message: `Error creating items batch: ${error.message}`
      };
    }
  }

  /**
   * Create a research item from Opal research data
   * This is a specialized tool that transforms Opal research data into Monday.com items
   */
  @tool({
    name: 'monday_create_research_item',
    description: 'Create a Monday.com item from Opal research data (experiments, audits, etc.)',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board where the research item will be created',
        required: true
      },
      {
        name: 'itemName',
        type: ParameterType.String,
        description: 'The name/title of the research item',
        required: true
      },
      {
        name: 'researchType',
        type: ParameterType.String,
        description: 'Type of research (e.g., "experiment_plan", "experiment_results", "audit_report")',
        required: true
      },
      {
        name: 'researchData',
        type: ParameterType.Dictionary,
        description: 'The research data to transform into Monday.com column values',
        required: true
      },
      {
        name: 'groupId',
        type: ParameterType.String,
        description: 'The ID of the group where the item will be created (optional)',
        required: false
      }
    ],
    endpoint: '/monday_create_research_item'
  })
  public async mondayCreateResearchItem(
    params: CreateResearchItemParameters,
    _authData?: OptiIdAuthData
  ): Promise<any> {
    try {
      logger.info('Create research item tool called', {
        boardId: params.boardId,
        researchType: params.researchType
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      // First, get the board to understand its column structure
      const boardResult = await client.getBoard(params.boardId);
      const board = boardResult.data;

      // Transform research data into column values based on research type
      const columnValues = this.transformResearchDataToColumnValues(
        params.researchType,
        params.researchData,
        board.columns
      );

      // Create the item
      const result = await client.createItem(
        params.boardId,
        params.itemName,
        params.groupId,
        columnValues
      );

      return {
        success: true,
        data: {
          ...result.data,
          researchType: params.researchType,
          transformedColumns: Object.keys(columnValues)
        }
      };
    } catch (error: any) {
      logger.error('Error creating research item:', error);
      return {
        success: false,
        message: `Error creating research item: ${error.message}`
      };
    }
  }

  /**
   * Transform Opal research data into Monday.com column values
   * Note: Final formatting is handled by MondayClient.formatColumnValue based on column types
   */
  private transformResearchDataToColumnValues(
    researchType: string,
    researchData: Record<string, any>,
    boardColumns: Array<{ id: string; title: string; type: string }>
  ): Record<string, any> {
    const columnValues: Record<string, any> = {};

    // Create maps for column lookup
    const columnMap = new Map<string, string>(); // title -> id
    const columnTypeMap = new Map<string, string>(); // id -> type
    boardColumns.forEach((col) => {
      columnMap.set(col.title.toLowerCase(), col.id);
      columnMap.set(col.id, col.id); // Also allow direct ID lookup
      columnTypeMap.set(col.id, col.type);
    });

    // Transform based on research type
    switch (researchType.toLowerCase()) {
    case 'experiment_plan':
    case 'experiment':
      // Map experiment plan fields to common column names
      if (researchData.status && columnMap.has('status')) {
        const columnId = columnMap.get('status')!;
        // Pass as string - formatColumnValue will format based on column type
        columnValues[columnId] = researchData.status;
      }
      if (researchData.hypothesis && columnMap.has('hypothesis')) {
        const columnId = columnMap.get('hypothesis')!;
        columnValues[columnId] = researchData.hypothesis;
      }
      if (researchData.sample_size && columnMap.has('sample size')) {
        const columnId = columnMap.get('sample size')!;
        // Pass as number - formatColumnValue will format based on column type
        columnValues[columnId] = researchData.sample_size;
      }
      break;

    case 'experiment_results':
    case 'results':
      if (researchData.outcome && columnMap.has('outcome')) {
        const columnId = columnMap.get('outcome')!;
        columnValues[columnId] = researchData.outcome;
      }
      if (researchData.recommendation && columnMap.has('recommendation')) {
        const columnId = columnMap.get('recommendation')!;
        columnValues[columnId] = researchData.recommendation;
      }
      break;

    case 'audit_report':
    case 'audit':
      if (researchData.score && columnMap.has('score')) {
        const columnId = columnMap.get('score')!;
        // Pass as number - formatColumnValue will format based on column type
        columnValues[columnId] = researchData.score;
      }
      if (researchData.findings && columnMap.has('findings')) {
        const columnId = columnMap.get('findings')!;
        columnValues[columnId] = researchData.findings;
      }
      break;
    }

    // Generic mapping: try to match any research data keys to column titles
    for (const [key, value] of Object.entries(researchData)) {
      const columnId = columnMap.get(key.toLowerCase());
      if (columnId && !columnValues[columnId]) {
        // Pass value as-is - formatColumnValue in createItem will handle formatting
        // based on the actual column type from the board
        columnValues[columnId] = value;
      }
    }

    return columnValues;
  }

  /**
   * Upload a file to Monday.com
   */
  @tool({
    name: 'monday_upload_file',
    description: 'Upload a file to Monday.com and get file ID. ' +
      'Returns file metadata that can be used to attach to items.',
    parameters: [
      {
        name: 'fileData',
        type: ParameterType.String,
        description: 'Base64 encoded file data',
        required: true
      },
      {
        name: 'fileName',
        type: ParameterType.String,
        description: 'Name of the file including extension (e.g., "report.pdf")',
        required: true
      },
      {
        name: 'fileType',
        type: ParameterType.String,
        description: 'Optional MIME type (e.g., "application/pdf"). Auto-detected from file extension if not provided.',
        required: false
      }
    ],
    endpoint: '/monday_upload_file'
  })
  public async mondayUploadFile(params: UploadFileParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Upload file tool called', {
        fileName: params.fileName,
        fileSize: params.fileData.length,
        hasFileType: !!params.fileType
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      // Decode base64 file data
      const fileBuffer = Buffer.from(params.fileData, 'base64');

      const result = await client.uploadFile(fileBuffer, params.fileName);

      return result;
    } catch (error: any) {
      logger.error('Error uploading file:', error);
      return {
        success: false,
        message: `Error uploading file: ${error.message}`
      };
    }
  }

  /**
   * Add a file to an item's file column
   */
  @tool({
    name: 'monday_add_file_to_item',
    description: 'Attach a file to a specific item column in Monday.com. The column must be a file column type.',
    parameters: [
      {
        name: 'itemId',
        type: ParameterType.String,
        description: 'The ID of the item to attach the file to',
        required: true
      },
      {
        name: 'columnId',
        type: ParameterType.String,
        description: 'The ID of the file column (e.g., "files_1" or "files")',
        required: true
      },
      {
        name: 'fileData',
        type: ParameterType.String,
        description: 'Base64 encoded file data',
        required: true
      },
      {
        name: 'fileName',
        type: ParameterType.String,
        description: 'Name of the file including extension (e.g., "report.pdf")',
        required: true
      }
    ],
    endpoint: '/monday_add_file_to_item'
  })
  public async mondayAddFileToItem(params: AddFileToItemParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Add file to item tool called', {
        itemId: params.itemId,
        columnId: params.columnId,
        fileName: params.fileName
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      // Decode base64 file data
      const fileBuffer = Buffer.from(params.fileData, 'base64');

      const result = await client.addFileToColumn(
        params.itemId,
        params.columnId,
        fileBuffer,
        params.fileName
      );

      return result;
    } catch (error: any) {
      logger.error('Error adding file to item:', error);
      return {
        success: false,
        message: `Error adding file to item: ${error.message}`
      };
    }
  }

  /**
   * Get file/asset information
   */
  @tool({
    name: 'monday_get_file',
    description: 'Get metadata about a file/asset in Monday.com by its ID',
    parameters: [
      {
        name: 'fileId',
        type: ParameterType.String,
        description: 'The ID of the file/asset to retrieve',
        required: true
      }
    ],
    endpoint: '/monday_get_file'
  })
  public async mondayGetFile(params: GetFileParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get file tool called', { fileId: params.fileId });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getFile(params.fileId);

      return result;
    } catch (error: any) {
      logger.error('Error getting file:', error);
      return {
        success: false,
        message: `Error getting file: ${error.message}`
      };
    }
  }

  /**
   * Get all files/assets for an item
   */
  @tool({
    name: 'monday_get_item_files',
    description: 'Get all files/assets attached to a specific item in Monday.com',
    parameters: [
      {
        name: 'itemId',
        type: ParameterType.String,
        description: 'The ID of the item to get files for',
        required: true
      }
    ],
    endpoint: '/monday_get_item_files'
  })
  public async mondayGetItemFiles(params: GetItemFilesParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get item files tool called', { itemId: params.itemId });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getItemFiles(params.itemId);

      return result;
    } catch (error: any) {
      logger.error('Error getting item files:', error);
      return {
        success: false,
        message: `Error getting item files: ${error.message}`
      };
    }
  }

  /**
   * Create a new tag or get existing tag by name
   */
  @tool({
    name: 'monday_create_or_get_tag',
    description: 'Create a new tag on a board or get existing tag if it already exists. ' +
      'Tags are board-specific and can be used to categorize items.',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board where the tag will be created',
        required: true
      },
      {
        name: 'tagName',
        type: ParameterType.String,
        description: 'The name of the tag to create or retrieve',
        required: true
      },
      {
        name: 'color',
        type: ParameterType.String,
        description: 'Optional color for the tag (e.g., "red", "blue", "green")',
        required: false
      }
    ],
    endpoint: '/monday_create_or_get_tag'
  })
  public async mondayCreateOrGetTag(params: CreateTagParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Create or get tag tool called', {
        boardId: params.boardId,
        tagName: params.tagName
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.createOrGetTag(
        params.boardId,
        params.tagName,
        params.color
      );

      return result;
    } catch (error: any) {
      logger.error('Error creating or getting tag:', error);
      return {
        success: false,
        message: `Error creating or getting tag: ${error.message}`
      };
    }
  }

  /**
   * Get all tags for a board
   */
  @tool({
    name: 'monday_get_board_tags',
    description: 'Get all tags available on a specific board. ' +
      'Tags are board-specific and can be used to filter and organize items.',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board to get tags from',
        required: true
      }
    ],
    endpoint: '/monday_get_board_tags'
  })
  public async mondayGetBoardTags(params: GetBoardTagsParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get board tags tool called', { boardId: params.boardId });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getBoardTags(params.boardId);

      return result;
    } catch (error: any) {
      logger.error('Error getting board tags:', error);
      return {
        success: false,
        message: `Error getting board tags: ${error.message}`
      };
    }
  }

  /**
   * Get tags assigned to an item
   */
  @tool({
    name: 'monday_get_item_tags',
    description: 'Get all tags assigned to a specific item. ' +
      'Returns tag IDs that can be used to identify which tags are applied to the item.',
    parameters: [
      {
        name: 'itemId',
        type: ParameterType.String,
        description: 'The ID of the item to get tags for',
        required: true
      },
      {
        name: 'columnId',
        type: ParameterType.String,
        description: 'Optional: Specific tags column ID to query. ' +
          'If not provided, searches all tag columns on the item.',
        required: false
      }
    ],
    endpoint: '/monday_get_item_tags'
  })
  public async mondayGetItemTags(params: GetItemTagsParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get item tags tool called', {
        itemId: params.itemId,
        columnId: params.columnId || 'all'
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getItemTags(params.itemId, params.columnId);

      return result;
    } catch (error: any) {
      logger.error('Error getting item tags:', error);
      return {
        success: false,
        message: `Error getting item tags: ${error.message}`
      };
    }
  }

  /**
   * Get items by tag
   */
  @tool({
    name: 'monday_get_items_by_tag',
    description: 'Get all items on a board that have a specific tag assigned. ' +
      'Useful for filtering and finding related items.',
    parameters: [
      {
        name: 'boardId',
        type: ParameterType.String,
        description: 'The ID of the board to search for items',
        required: true
      },
      {
        name: 'tagId',
        type: ParameterType.String,
        description: 'The ID of the tag to filter by',
        required: true
      }
    ],
    endpoint: '/monday_get_items_by_tag'
  })
  public async mondayGetItemsByTag(params: GetItemsByTagParameters, _authData?: OptiIdAuthData): Promise<any> {
    try {
      logger.info('Get items by tag tool called', {
        boardId: params.boardId,
        tagId: params.tagId
      });

      const apiToken = await this.getApiToken();
      const client = new MondayClient(apiToken);

      const result = await client.getItemsByTag(params.boardId, params.tagId);

      return result;
    } catch (error: any) {
      logger.error('Error getting items by tag:', error);
      return {
        success: false,
        message: `Error getting items by tag: ${error.message}`
      };
    }
  }
}

