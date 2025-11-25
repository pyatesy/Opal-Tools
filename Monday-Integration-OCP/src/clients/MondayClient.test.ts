import { MondayClient } from './MondayClient';
import fetch from 'node-fetch';

// Mock dependencies
jest.mock('node-fetch');
jest.mock('form-data', () => {
  const mockFormData = {
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' })
  };
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockFormData)
  };
});
jest.mock('@zaiusinc/app-sdk', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('MondayClient', () => {
  let client: MondayClient;
  const mockApiToken = 'test-api-token-123';

  beforeEach(() => {
    client = new MondayClient(mockApiToken);
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create client with API token', () => {
      expect(() => new MondayClient(mockApiToken)).not.toThrow();
    });

    it('should throw error if API token is empty', () => {
      expect(() => new MondayClient('')).toThrow('Monday.com API token is required');
      expect(() => new MondayClient('   ')).toThrow('Monday.com API token is required');
    });
  });

  describe('listBoards', () => {
    it('should list boards successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            boards: [
              { id: '123', name: 'Test Board 1' },
              { id: '456', name: 'Test Board 2' }
            ]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.listBoards();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Test Board 1');
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': mockApiToken
          })
        })
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid token')
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.listBoards()).rejects.toThrow();
    });

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          errors: [{ message: 'Invalid query' }]
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.listBoards()).rejects.toThrow('Monday.com GraphQL errors');
    });
  });

  describe('getBoard', () => {
    it('should get board details successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            boards: [{
              id: '123',
              name: 'Test Board',
              columns: [
                { id: 'text_1', type: 'text', title: 'Name' },
                { id: 'numeric_1', type: 'numbers', title: 'Count' }
              ],
              groups: [{ id: 'group1', title: 'Group 1' }]
            }]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getBoard('123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('123');
      expect(result.data.name).toBe('Test Board');
      expect(result.data.columns).toHaveLength(2);
    });

    it('should throw error if board not found', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            boards: []
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.getBoard('999')).rejects.toThrow('Board with ID 999 not found');
    });
  });

  describe('createItem', () => {
    it('should create item with column values', async () => {
      // Mock getBoard call (for column type detection)
      const mockBoardResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            boards: [{
              id: '123',
              columns: [
                { id: 'text_1', type: 'text', title: 'Name' },
                { id: 'numeric_1', type: 'numbers', title: 'Count' }
              ]
            }]
          }
        })
      };

      // Mock createItem mutation response
      const mockCreateResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            create_item: {
              id: 'item123',
              name: 'Test Item',
              board: { id: '123', name: 'Test Board' }
            }
          }
        })
      };

      mockedFetch
        .mockResolvedValueOnce(mockBoardResponse as any)
        .mockResolvedValueOnce(mockCreateResponse as any);

      const result = await client.createItem(
        '123',
        'Test Item',
        undefined,
        {
          'text_1': 'Test Value',
          'numeric_1': 42
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('item123');
      expect(mockedFetch).toHaveBeenCalledTimes(2); // getBoard + createItem
    });

    it('should create item without column values', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            create_item: {
              id: 'item123',
              name: 'Test Item'
            }
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.createItem('123', 'Test Item');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('item123');
    });
  });

  describe('formatColumnValue', () => {
    // Note: formatColumnValue is private, so we test it indirectly through createItem
    it('should format numeric column values correctly', async () => {
      const mockBoardResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            boards: [{
              id: '123',
              columns: [
                { id: 'numeric_1', type: 'numbers', title: 'Count' }
              ]
            }]
          }
        })
      };

      const mockCreateResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            create_item: { id: 'item123', name: 'Test' }
          }
        })
      };

      mockedFetch
        .mockResolvedValueOnce(mockBoardResponse as any)
        .mockResolvedValueOnce(mockCreateResponse as any);

      // Numeric value should be formatted as plain number
      await client.createItem('123', 'Test', undefined, {
        'numeric_1': 42
      });

      const createCall = mockedFetch.mock.calls[1];
      const requestBody = JSON.parse(createCall[1]?.body as string);
      const columnValues = JSON.parse(requestBody.variables.columnValues);

      // Numeric columns should be plain numbers (not wrapped in objects)
      expect(typeof columnValues.numeric_1).toBe('number');
      expect(columnValues.numeric_1).toBe(42);
    });

    it('should format text column values correctly', async () => {
      const mockBoardResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            boards: [{
              id: '123',
              columns: [
                { id: 'text_1', type: 'text', title: 'Name' }
              ]
            }]
          }
        })
      };

      const mockCreateResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            create_item: { id: 'item123', name: 'Test' }
          }
        })
      };

      mockedFetch
        .mockResolvedValueOnce(mockBoardResponse as any)
        .mockResolvedValueOnce(mockCreateResponse as any);

      await client.createItem('123', 'Test', undefined, {
        'text_1': 'Test Value'
      });

      const createCall = mockedFetch.mock.calls[1];
      const requestBody = JSON.parse(createCall[1]?.body as string);
      const columnValues = JSON.parse(requestBody.variables.columnValues);

      expect(columnValues.text_1).toBe('Test Value');
    });

    it('should format tags column values correctly', async () => {
      const mockBoardResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            boards: [{
              id: '123',
              columns: [
                { id: 'tags_1', type: 'tags', title: 'Tags' }
              ]
            }]
          }
        })
      };

      const mockCreateResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            create_item: { id: 'item123', name: 'Test' }
          }
        })
      };

      mockedFetch
        .mockResolvedValueOnce(mockBoardResponse as any)
        .mockResolvedValueOnce(mockCreateResponse as any);

      await client.createItem('123', 'Test', undefined, {
        'tags_1': ['tag1', 'tag2']
      });

      const createCall = mockedFetch.mock.calls[1];
      const requestBody = JSON.parse(createCall[1]?.body as string);
      const columnValues = JSON.parse(requestBody.variables.columnValues);

      expect(columnValues.tags_1).toEqual({ tag_ids: ['tag1', 'tag2'] });
    });
  });

  describe('updateItemColumnValue', () => {
    it('should update item column value successfully', async () => {
      const mockBoardResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            boards: [{
              id: '123',
              columns: [
                { id: 'text_1', type: 'text', title: 'Name' }
              ]
            }]
          }
        })
      };

      const mockUpdateResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce({
          data: {
            change_column_value: {
              id: 'item123'
            }
          }
        })
      };

      mockedFetch
        .mockResolvedValueOnce(mockBoardResponse as any)
        .mockResolvedValueOnce(mockUpdateResponse as any);

      const result = await client.updateItemColumnValue('123', 'item123', 'text_1', 'New Value');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('item123');
    });
  });

  describe('getItem', () => {
    it('should get item details successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            items: [{
              id: 'item123',
              name: 'Test Item',
              board: { id: '123', name: 'Test Board' },
              column_values: [
                { id: 'text_1', type: 'text', text: 'Value', value: '"Value"' }
              ]
            }]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getItem('item123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('item123');
      expect(result.data.name).toBe('Test Item');
    });

    it('should throw error if item not found', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            items: []
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      await expect(client.getItem('999')).rejects.toThrow('Item with ID 999 not found');
    });
  });

  describe('createOrGetTag', () => {
    it('should create or get tag successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            create_or_get_tag: {
              id: 'tag123',
              name: 'High Priority',
              color: 'red'
            }
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.createOrGetTag('123', 'High Priority', 'red');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('tag123');
      expect(result.data.name).toBe('High Priority');
    });
  });

  describe('getBoardTags', () => {
    it('should get board tags successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            boards: [{
              id: '123',
              name: 'Test Board',
              tags: [
                { id: 'tag1', name: 'Tag 1', color: 'red' },
                { id: 'tag2', name: 'Tag 2', color: 'blue' }
              ]
            }]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getBoardTags('123');

      expect(result.success).toBe(true);
      expect(result.data.tags).toHaveLength(2);
      expect(result.data.tags[0].name).toBe('Tag 1');
    });
  });

  describe('getItemTags', () => {
    it('should get item tags successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            items: [{
              id: 'item123',
              name: 'Test Item',
              column_values: [
                {
                  id: 'tags_1',
                  type: 'tags',
                  text: 'Tag 1, Tag 2',
                  value: JSON.stringify({ tag_ids: ['tag1', 'tag2'] })
                }
              ]
            }]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getItemTags('item123');

      expect(result.success).toBe(true);
      expect(result.data.tagIds).toContain('tag1');
      expect(result.data.tagIds).toContain('tag2');
    });
  });

  describe('getItemsByTag', () => {
    it('should get items by tag successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            items_page_by_column_values: {
              items: [
                { id: 'item1', name: 'Item 1' },
                { id: 'item2', name: 'Item 2' }
              ]
            }
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getItemsByTag('123', 'tag1');

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
    });
  });

  describe('addFileToColumn', () => {
    it('should add file to column successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            add_file_to_column: {
              id: 'file123'
            }
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const fileBuffer = Buffer.from('test file content');
      const result = await client.addFileToColumn('item123', 'files_1', fileBuffer, 'test.txt');

      expect(result.success).toBe(true);
      expect(result.data.add_file_to_column.id).toBe('file123');
      // Verify the request was made to the file endpoint
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2/file',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': mockApiToken
          })
        })
      );
    });
  });

  describe('getFile', () => {
    it('should get file metadata successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            assets: [{
              id: 'file123',
              name: 'test.pdf',
              url: 'https://monday.com/files/test.pdf',
              file_extension: 'pdf',
              file_size: 1024
            }]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getFile('file123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('file123');
      expect(result.data.name).toBe('test.pdf');
    });
  });

  describe('getItemFiles', () => {
    it('should get item files successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          data: {
            items: [{
              id: 'item123',
              name: 'Test Item',
              assets: [
                { id: 'file1', name: 'file1.pdf', url: 'https://...', file_size: 1024 },
                { id: 'file2', name: 'file2.jpg', url: 'https://...', file_size: 2048 }
              ]
            }]
          }
        })
      };

      mockedFetch.mockResolvedValue(mockResponse as any);

      const result = await client.getItemFiles('item123');

      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(2);
      expect(result.data.files[0].name).toBe('file1.pdf');
    });
  });
});

