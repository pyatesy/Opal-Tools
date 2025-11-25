// Mock dependencies BEFORE imports
jest.mock('../clients/MondayClient');
jest.mock('@zaiusinc/app-sdk', () => {
  const mockSettingsGet = jest.fn();
  const mockSettingsPut = jest.fn();
  return {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    },
    storage: {
      settings: {
        get: mockSettingsGet,
        put: mockSettingsPut
      }
    },
    Request: jest.fn()
  };
});
jest.mock('@optimizely-opal/opal-tool-ocp-sdk', () => ({
  ToolFunction: class MockToolFunction {
    public constructor(_request: any) {
      // Mock constructor - no implementation needed
    }
  },
  tool: jest.fn((_options: any) => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => descriptor),
  ParameterType: {
    String: 'string',
    Integer: 'integer',
    Dictionary: 'dictionary',
    Array: 'array'
  },
  OptiIdAuthData: {}
}));

import { OpalToolFunction } from './OpalToolFunction';
import { MondayClient } from '../clients/MondayClient';
import { storage, Request } from '@zaiusinc/app-sdk';

const MockedMondayClient = MondayClient as jest.MockedClass<typeof MondayClient>;

describe('OpalToolFunction', () => {
  let toolFunction: OpalToolFunction;
  let mockClient: jest.Mocked<MondayClient>;
  const mockApiToken = 'test-api-token-123';
  const mockRequest = {} as Request;

  beforeEach(() => {
    // Mock storage to return API token
    (storage.settings.get as jest.Mock).mockResolvedValue({
      api_token: mockApiToken
    });

    // Create mock client instance
    mockClient = {
      listBoards: jest.fn(),
      getBoard: jest.fn(),
      createItem: jest.fn(),
      updateItemColumnValue: jest.fn(),
      getItem: jest.fn(),
      createItemsBatch: jest.fn(),
      createOrGetTag: jest.fn(),
      getBoardTags: jest.fn(),
      getItemTags: jest.fn(),
      getItemsByTag: jest.fn(),
      uploadFile: jest.fn(),
      addFileToColumn: jest.fn(),
      getFile: jest.fn(),
      getItemFiles: jest.fn()
    } as any;

    MockedMondayClient.mockImplementation(() => mockClient);

    toolFunction = new OpalToolFunction(mockRequest);
    jest.clearAllMocks();
  });

  describe('getApiToken', () => {
    it('should retrieve API token from storage', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      const token = await (toolFunction as any).getApiToken();
      expect(token).toBe(mockApiToken);
      expect(storage.settings.get).toHaveBeenCalledWith('monday_auth');
    });

    it('should throw error if API token not configured', async () => {
      (storage.settings.get as jest.Mock).mockResolvedValue({});
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      await expect((toolFunction as any).getApiToken()).rejects.toThrow('Monday.com API token not configured');
    });
  });

  describe('mondayListBoards', () => {
    it('should list boards successfully', async () => {
      mockClient.listBoards.mockResolvedValue({
        success: true,
        data: [
          { id: '123', name: 'Board 1' },
          { id: '456', name: 'Board 2' }
        ]
      });

      const result = await toolFunction.mondayListBoards({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockClient.listBoards).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockClient.listBoards.mockRejectedValue(new Error('API Error'));

      const result = await toolFunction.mondayListBoards({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error listing boards');
    });
  });

  describe('mondayGetBoard', () => {
    it('should get board successfully', async () => {
      mockClient.getBoard.mockResolvedValue({
        success: true,
        data: {
          id: '123',
          name: 'Test Board',
          columns: []
        }
      });

      const result = await toolFunction.mondayGetBoard({ boardId: '123' });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('123');
      expect(mockClient.getBoard).toHaveBeenCalledWith('123');
    });
  });

  describe('mondayCreateItem', () => {
    it('should create item successfully', async () => {
      mockClient.createItem.mockResolvedValue({
        success: true,
        data: {
          id: 'item123',
          name: 'Test Item'
        }
      });

      const result = await toolFunction.mondayCreateItem({
        boardId: '123',
        itemName: 'Test Item',
        columnValues: {
          'text_1': 'Value'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('item123');
      expect(mockClient.createItem).toHaveBeenCalledWith(
        '123',
        'Test Item',
        undefined,
        { 'text_1': 'Value' }
      );
    });

    it('should create item with groupId', async () => {
      mockClient.createItem.mockResolvedValue({
        success: true,
        data: { id: 'item123', name: 'Test Item' }
      });

      await toolFunction.mondayCreateItem({
        boardId: '123',
        itemName: 'Test Item',
        groupId: 'group1'
      });

      expect(mockClient.createItem).toHaveBeenCalledWith(
        '123',
        'Test Item',
        'group1',
        undefined
      );
    });
  });

  describe('mondayUpdateItemColumn', () => {
    it('should update item column successfully', async () => {
      mockClient.updateItemColumnValue.mockResolvedValue({
        success: true,
        data: { id: 'item123' }
      });

      const result = await toolFunction.mondayUpdateItemColumn({
        boardId: '123',
        itemId: 'item123',
        columnId: 'text_1',
        value: 'New Value'
      });

      expect(result.success).toBe(true);
      expect(mockClient.updateItemColumnValue).toHaveBeenCalledWith(
        '123',
        'item123',
        'text_1',
        'New Value'
      );
    });
  });

  describe('mondayGetItem', () => {
    it('should get item successfully', async () => {
      mockClient.getItem.mockResolvedValue({
        success: true,
        data: {
          id: 'item123',
          name: 'Test Item'
        }
      });

      const result = await toolFunction.mondayGetItem({ itemId: 'item123' });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('item123');
    });
  });

  describe('mondayCreateItemsBatch', () => {
    it('should create multiple items successfully', async () => {
      mockClient.createItemsBatch.mockResolvedValue({
        success: true,
        data: [
          { id: 'item1', name: 'Item 1' },
          { id: 'item2', name: 'Item 2' }
        ]
      });

      const result = await toolFunction.mondayCreateItemsBatch({
        boardId: '123',
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('mondayCreateOrGetTag', () => {
    it('should create or get tag successfully', async () => {
      mockClient.createOrGetTag.mockResolvedValue({
        success: true,
        data: {
          id: 'tag123',
          name: 'High Priority',
          color: 'red'
        }
      });

      const result = await toolFunction.mondayCreateOrGetTag({
        boardId: '123',
        tagName: 'High Priority',
        color: 'red'
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('High Priority');
      expect(mockClient.createOrGetTag).toHaveBeenCalledWith('123', 'High Priority', 'red');
    });

    it('should create tag without color', async () => {
      mockClient.createOrGetTag.mockResolvedValue({
        success: true,
        data: { id: 'tag123', name: 'Tag' }
      });

      await toolFunction.mondayCreateOrGetTag({
        boardId: '123',
        tagName: 'Tag'
      });

      expect(mockClient.createOrGetTag).toHaveBeenCalledWith('123', 'Tag', undefined);
    });
  });

  describe('mondayGetBoardTags', () => {
    it('should get board tags successfully', async () => {
      mockClient.getBoardTags.mockResolvedValue({
        success: true,
        data: {
          boardId: '123',
          tags: [
            { id: 'tag1', name: 'Tag 1' },
            { id: 'tag2', name: 'Tag 2' }
          ]
        }
      });

      const result = await toolFunction.mondayGetBoardTags({ boardId: '123' });

      expect(result.success).toBe(true);
      expect(result.data.tags).toHaveLength(2);
    });
  });

  describe('mondayGetItemTags', () => {
    it('should get item tags successfully', async () => {
      mockClient.getItemTags.mockResolvedValue({
        success: true,
        data: {
          itemId: 'item123',
          tagIds: ['tag1', 'tag2']
        }
      });

      const result = await toolFunction.mondayGetItemTags({ itemId: 'item123' });

      expect(result.success).toBe(true);
      expect(result.data.tagIds).toContain('tag1');
    });

    it('should get item tags for specific column', async () => {
      mockClient.getItemTags.mockResolvedValue({
        success: true,
        data: { itemId: 'item123', tagIds: ['tag1'] }
      });

      await toolFunction.mondayGetItemTags({
        itemId: 'item123',
        columnId: 'tags_1'
      });

      expect(mockClient.getItemTags).toHaveBeenCalledWith('item123', 'tags_1');
    });
  });

  describe('mondayGetItemsByTag', () => {
    it('should get items by tag successfully', async () => {
      mockClient.getItemsByTag.mockResolvedValue({
        success: true,
        data: {
          boardId: '123',
          tagId: 'tag1',
          items: [
            { id: 'item1', name: 'Item 1' },
            { id: 'item2', name: 'Item 2' }
          ]
        }
      });

      const result = await toolFunction.mondayGetItemsByTag({
        boardId: '123',
        tagId: 'tag1'
      });

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
    });
  });

  describe('mondayUploadFile', () => {
    it('should upload file successfully', async () => {
      mockClient.uploadFile.mockResolvedValue({
        success: true,
        data: { id: 'file123' }
      });

      const fileData = Buffer.from('test content').toString('base64');
      const result = await toolFunction.mondayUploadFile({
        fileData,
        fileName: 'test.txt'
      });

      expect(result.success).toBe(true);
      expect(mockClient.uploadFile).toHaveBeenCalled();
    });
  });

  describe('mondayAddFileToItem', () => {
    it('should add file to item successfully', async () => {
      mockClient.addFileToColumn.mockResolvedValue({
        success: true,
        data: { id: 'file123' }
      });

      const fileData = Buffer.from('test content').toString('base64');
      const result = await toolFunction.mondayAddFileToItem({
        itemId: 'item123',
        columnId: 'files_1',
        fileData,
        fileName: 'test.txt'
      });

      expect(result.success).toBe(true);
      expect(mockClient.addFileToColumn).toHaveBeenCalled();
    });
  });

  describe('mondayGetFile', () => {
    it('should get file metadata successfully', async () => {
      mockClient.getFile.mockResolvedValue({
        success: true,
        data: {
          id: 'file123',
          name: 'test.pdf',
          url: 'https://...',
          file_size: 1024
        }
      });

      const result = await toolFunction.mondayGetFile({ fileId: 'file123' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('test.pdf');
    });
  });

  describe('mondayGetItemFiles', () => {
    it('should get item files successfully', async () => {
      mockClient.getItemFiles.mockResolvedValue({
        success: true,
        data: {
          itemId: 'item123',
          files: [
            { id: 'file1', name: 'file1.pdf' },
            { id: 'file2', name: 'file2.jpg' }
          ]
        }
      });

      const result = await toolFunction.mondayGetItemFiles({ itemId: 'item123' });

      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(2);
    });
  });

  describe('mondayCreateResearchItem', () => {
    it('should create research item with transformed columns', async () => {
      mockClient.getBoard.mockResolvedValue({
        success: true,
        data: {
          columns: [
            { id: 'status', title: 'Status', type: 'status' },
            { id: 'hypothesis', title: 'Hypothesis', type: 'long_text' },
            { id: 'sample_size', title: 'Sample Size', type: 'numbers' }
          ]
        }
      });

      mockClient.createItem.mockResolvedValue({
        success: true,
        data: {
          id: 'item123',
          name: 'Test Research Item'
        }
      });

      const result = await toolFunction.mondayCreateResearchItem({
        boardId: '123',
        itemName: 'Test Research Item',
        researchType: 'experiment_plan',
        researchData: {
          status: 'Not Started',
          hypothesis: 'Test hypothesis',
          sample_size: 1000
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.researchType).toBe('experiment_plan');
      expect(mockClient.getBoard).toHaveBeenCalled();
      expect(mockClient.createItem).toHaveBeenCalled();
    });
  });
});

