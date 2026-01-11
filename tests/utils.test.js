import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMultivalueList } from '../src/utils.js';
import * as apiServices from '../src/apiServices.js';

// Mock the API services
vi.mock('../src/apiServices.js', () => ({
  apiEntityCRUD: vi.fn(),
}));

describe('utils.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMultivalueList', () => {
    describe('Successful Query', () => {
      it('returns a formatted list of attributes from API response', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
            {
              extensibleEnumOptionId: '2',
              extensibleEnumOptionName: 'Option 2',
            },
            {
              extensibleEnumOptionId: '3',
              extensibleEnumOptionName: 'Option 3',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result).toEqual([
          { id: '1', name: 'Option 1' },
          { id: '2', name: 'Option 2' },
          { id: '3', name: 'Option 3' },
        ]);
      });

      it('transforms API response with correct structure', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: 'ABC123',
              extensibleEnumOptionName: 'Premium Service',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('ServiceTypes');

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('id', 'ABC123');
        expect(result[0]).toHaveProperty('name', 'Premium Service');
      });

      it('handles empty list response', async () => {
        const mockApiResponse = { list: [] };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await expect(getMultivalueList('EmptyList')).rejects.toThrow(
          'getMultivalueList: API query failed for multivalue attributes'
        );
      });

      it('calls API with default deleted=false criteria when no criteria provided', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await getMultivalueList('TestList');

        expect(apiServices.apiEntityCRUD).toHaveBeenCalledWith(
          'query',
          'ExtensibleEnumExtensibleEnumOption',
          null,
          expect.objectContaining({
            deleted: false,
            extensibleEnumName: 'TestList',
          })
        );
      });

      it('calls API with custom criteria when provided', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const customCriteria = { status: 'active', deleted: false };
        await getMultivalueList('TestList', customCriteria);

        expect(apiServices.apiEntityCRUD).toHaveBeenCalledWith(
          'query',
          'ExtensibleEnumExtensibleEnumOption',
          null,
          expect.objectContaining({
            status: 'active',
            deleted: false,
            extensibleEnumName: 'TestList',
          })
        );
      });

      it('includes extensibleEnumName in API request', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await getMultivalueList('MyCustomList');

        const callArgs = vi.mocked(apiServices.apiEntityCRUD).mock.calls[0][3];
        expect(callArgs.extensibleEnumName).toBe('MyCustomList');
      });
    });

    describe('Error Handling', () => {
      it('throws error when API returns missing list property', async () => {
        const mockApiResponse = { data: [] };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await expect(getMultivalueList('TestList')).rejects.toThrow(
          'getMultivalueList: API query failed for multivalue attributes'
        );
      });

      it('throws error with list name and criteria in message', async () => {
        const mockApiResponse = {};

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const criteria = { status: 'active' };
        const errorPromise = getMultivalueList('TestList', criteria);

        await expect(errorPromise).rejects.toThrow();
        
        try {
          await getMultivalueList('TestList', criteria);
        } catch (error) {
          expect(error.message).toContain('TestList');
        }
      });

      it('catches and wraps API errors', async () => {
        const apiError = new Error('Network error');

        vi.mocked(apiServices.apiEntityCRUD).mockRejectedValue(apiError);

        await expect(getMultivalueList('TestList')).rejects.toThrow();
        
        try {
          await getMultivalueList('TestList');
        } catch (error) {
          expect(error.message).toContain('getMultivalueList:');
          expect(error.message).toContain('Network error');
        }
      });

      it('handles API throwing custom error messages', async () => {
        const apiError = new Error('Connection timeout');

        vi.mocked(apiServices.apiEntityCRUD).mockRejectedValue(apiError);

        await expect(getMultivalueList('TestList')).rejects.toThrow('Connection timeout');
      });

      it('logs errors to console', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const apiError = new Error('Test error');

        vi.mocked(apiServices.apiEntityCRUD).mockRejectedValue(apiError);

        try {
          await getMultivalueList('TestList');
        } catch {
          // Expected error
        }

        expect(consoleSpy).toHaveBeenCalledWith(apiError);
        consoleSpy.mockRestore();
      });
    });

    describe('API Integration', () => {
      it('uses correct API entity and method', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await getMultivalueList('TestList');

        const [method, entity] = vi.mocked(apiServices.apiEntityCRUD).mock.calls[0];
        expect(method).toBe('query');
        expect(entity).toBe('ExtensibleEnumExtensibleEnumOption');
      });

      it('passes null as third parameter to apiEntityCRUD', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await getMultivalueList('TestList');

        const thirdParam = vi.mocked(apiServices.apiEntityCRUD).mock.calls[0][2];
        expect(thirdParam).toBeNull();
      });

      it('only makes one API call', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        await getMultivalueList('TestList');

        expect(vi.mocked(apiServices.apiEntityCRUD)).toHaveBeenCalledTimes(1);
      });
    });

    describe('Data Transformation', () => {
      it('correctly maps extensibleEnumOptionId to id', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: 'unique-id-123',
              extensibleEnumOptionName: 'Option Name',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result[0].id).toBe('unique-id-123');
      });

      it('correctly maps extensibleEnumOptionName to name', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: 'id-1',
              extensibleEnumOptionName: 'Display Name',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result[0].name).toBe('Display Name');
      });

      it('preserves order of items from API', async () => {
        const mockApiResponse = {
          list: [
            { extensibleEnumOptionId: '3', extensibleEnumOptionName: 'Third' },
            { extensibleEnumOptionId: '1', extensibleEnumOptionName: 'First' },
            { extensibleEnumOptionId: '2', extensibleEnumOptionName: 'Second' },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result[0].name).toBe('Third');
        expect(result[1].name).toBe('First');
        expect(result[2].name).toBe('Second');
      });

      it('handles special characters in names', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: "Option with 'quotes' & special chars",
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result[0].name).toBe("Option with 'quotes' & special chars");
      });

      it('handles numeric values in API response', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: 123,
              extensibleEnumOptionName: 'Numeric ID',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result[0].id).toBe(123);
      });

      it('does not include extra properties from API response', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
              extraField: 'should not be included',
              anotherExtra: 'also should not be included',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result[0]).toEqual({
          id: '1',
          name: 'Option 1',
        });
        expect(result[0]).not.toHaveProperty('extraField');
        expect(result[0]).not.toHaveProperty('anotherExtra');
      });
    });

    describe('Edge Cases', () => {
      it('handles large list of items', async () => {
        const largeList = Array.from({ length: 1000 }, (_, i) => ({
          extensibleEnumOptionId: `id-${i}`,
          extensibleEnumOptionName: `Option ${i}`,
        }));

        const mockApiResponse = { list: largeList };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('LargeList');

        expect(result).toHaveLength(1000);
        expect(result[0].id).toBe('id-0');
        expect(result[999].id).toBe('id-999');
      });

      it('handles criteria with multiple properties', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const complexCriteria = {
          deleted: false,
          status: 'active',
          type: 'premium',
          region: 'north',
        };

        await getMultivalueList('TestList', complexCriteria);

        const callArgs = vi.mocked(apiServices.apiEntityCRUD).mock.calls[0][3];
        expect(callArgs).toEqual({
          deleted: false,
          status: 'active',
          type: 'premium',
          region: 'north',
          extensibleEnumName: 'TestList',
        });
      });

      it('handles single item list', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: 'only-one',
              extensibleEnumOptionName: 'Single Option',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('TestList');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('only-one');
      });

      it('handles list names with special characters', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = await getMultivalueList('List-With_Special.Chars');

        expect(result).toBeDefined();
        const callArgs = vi.mocked(apiServices.apiEntityCRUD).mock.calls[0][3];
        expect(callArgs.extensibleEnumName).toBe('List-With_Special.Chars');
      });

      it('is an async function', async () => {
        const mockApiResponse = {
          list: [
            {
              extensibleEnumOptionId: '1',
              extensibleEnumOptionName: 'Option 1',
            },
          ],
        };

        vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

        const result = getMultivalueList('TestList');

        expect(result instanceof Promise).toBe(true);
        await result;
      });
    });
  });
});
