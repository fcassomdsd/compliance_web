import { apiEntityCRUD } from './apiServices.js';

export async function getMultivalueList(listName, criteria = null) {

    try {
      const apiData = (criteria) ? criteria : {'deleted': false};
      apiData["extensibleEnumName"] = listName;
      const { data: queryResults } = await apiEntityCRUD("query", "ExtensibleEnumExtensibleEnumOption", null, apiData);
      if (!('list' in queryResults) || queryResults.list.length === 0) {
        throw new Error('getMultivalueList: API query failed for multivalue attributes for : ' + listName + "/" + JSON.stringify(criteria));
      }
      const attributes = [];
        for (const entity of queryResults.list) {
          attributes.push({
            id: entity.extensibleEnumOptionId,
            name: entity.extensibleEnumOptionName,
          });
        }
      return attributes;
    } catch (error) {
      console.log(error);
      throw new Error("getMultivalueList: " + error.message);
    }
  }