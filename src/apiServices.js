import { default as axios } from 'axios';

const apiServer = 'http://localhost:1880';

/*
const apiQueryOps = [
  { op : "==", apiOp : "equal"},
  { op : "!=", apiOp : "not_equal"},
  { op : "contains", apiOp : "contains"},
  { op : "!contains", apiOp : "contains"},
  { op : "<", apiOp : "less"},
  { op : "<=", apiOp : "less_or_equal"},
  { op : ">", apiOp : "greater"},
  { op : ">=", apiOp : "greater_or_equal"},
  { op : "between", apiOp : "between"},
  { op : "-xdays", apiOp : "last_x_days"},
  { op : "+xdays", apiOp : "next_x_days"},
  { op : "month", apiOp : "current_month"},
  { op : "-month", apiOp : "last_month"},
  { op : "year", apiOp : "current_year"},
  { op : "-year", apiOp : "last_year"},
  { op : "null", apiOp : "is_null"},
  { op : "!null", apiOp : "is_not_null"},
  { op : "in", apiOp : "in"},
  { op : "!in", apiOp : "not_in"},
  { op : "!=", apiOp : "not_equal"},
]
*/
const apiOp = {
  query : {
    params : ["name", "data"],
    apiMethod : "post"
  },
  add : {
    params: ["name", "data"],
    apiMethod : "post"
  },
  update : {
    params: ["name", "id", "data"],
    apiMethod : "put"
  },
  delete : {
    params: ["name", "id"],
    apiMethod : "delete"
  },
  getLinks : {
    params: ["name", "id", "link"],
    apiMethod : "get"
  },
  addLinks : {
    params: ["name", "id", "link", "data"],
    apiMethod : "post"
  },
  deleteLinks : {
    params: ["name", "id", "link", "data"],
    apiMethod : "post"
  },
}
  
export async function apiEntityCRUD(method, entityName, entityId = null, entityData = null) {

  try {
    
    const validName = () => {    
      if (apiOp[method].params.includes("name")) {
        if (typeof entityName !== 'string') {
          throw new Error("entityName should be a string for " + method);      
        }    
        if (entityName.length == 0) {
          throw new Error("entityName is empty");      
        }
        return "?entity="+entityName;
      } else {
        return null;      
      }
    };

    const validId = () => {
      if (apiOp[method].params.includes("id")) {
        if (typeof entityId !== 'string') {
          throw new Error("entityId should be a string for " + method);      
        }    
        if (entityId.length == 0) {
          throw new Error("entityId is empty");      
        }    
        return "&id="+entityId;
      } else {
        return null;      
      }
    };

    const validData = () => {
      if (apiOp[method].params.includes("data")) {
        if (!entityData) {
          throw new Error("entityData should be defined for " + method);      
        }    
        if (typeof entityData !== 'object') {
          throw new Error("entityData should be an object for " + method);      
        }    
        if (Object.keys(entityData).length == 0) {
          throw new Error("entityData is empty");      
        }
        return entityData;  
      } else {
        return null;      
      }
    };
    
    if ((!method) || !(method in apiOp)) {
      throw new Error("Invalid method : " + method?.toString());    
    }

    const apiName = validName();
    const apiId = validId();
    const apiData = validData();

    const apiConfig = {
      method : apiOp[method].apiMethod,
      url : `${apiServer}/${method}Entity${apiName}${(apiId ? apiId : "")}`
    }
    if (apiData) {
      apiConfig["data"] = apiData;    
    }    
    
    const result = await axios(apiConfig);
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error("apiEntityCRUD: " + error.message);
  }
}

export async function apiEntityLinks(method, entityName, entityId, linkName, entityData = null) {

  try {
    if ((!method) || !["getLinks","addLinks","deleteLinks"].includes(method)) {
      throw new Error("Invalid method : " + method?.toString());    
    }

    const validName = () => {    
      if (apiOp[method].params.includes("name")) {
        if (typeof entityName !== 'string') {
          throw new Error("entityName should be a string for " + method);      
        }    
        if (entityName.length == 0) {
          throw new Error("entityName is empty");      
        }
        return "?entity="+entityName;
      } else {
        return null;      
      }
    };

    const validId = () => {
      if (apiOp[method].params.includes("id")) {
        if (typeof entityId !== 'string') {
          throw new Error("entityId should be a string for " + method);      
        }    
        if (entityId.length == 0) {
          throw new Error("entityId is empty");      
        }    
        return "&id="+entityId;
      } else {
        return null;      
      }
    };

    const validLink = () => {
      if (apiOp[method].params.includes("link")) {
        if (typeof linkName !== 'string') {
          throw new Error("linkName should be a string for " + method);      
        }    
        if (linkName.length == 0) {
          throw new Error("linkName is empty");      
        }    
        return "&link="+linkName;
      } else {
        return null;      
      }
    };

    const validData = () => {
      if (apiOp[method].params.includes("data")) {
        if (!entityData) {
          throw new Error("entityData should be defined for " + method);      
        }    
        if (typeof entityData !== 'object') {
          throw new Error("entityData should be an object for " + method);      
        }    
        if (Object.keys(entityData).length == 0) {
          throw new Error("entityData is empty");      
        }
        return entityData;  
      } else {
        return null;      
      }
    };
    
    const apiName = validName();
    const apiId = validId();
    const apiLink = validLink();
    const apiData = validData();

    const apiConfig = {
      method : apiOp[method].apiMethod,
      url : `${apiServer}/${method}${apiName}${(apiId ? apiId : "")}${(apiLink ? apiLink : "")}`
    }
    if (apiData) {
      apiConfig["data"] = apiData;    
    }    

    const result = await axios(apiConfig);
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error("apiEntityLinks: " + error.message);
  }    

}

