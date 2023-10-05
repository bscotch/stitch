export interface WorldDataCountry {
  /** Country Name */
  "placeName": string,
  /** Language summary */
  "formatted": string,
  "place": {
    "region": string;
  }
}

export interface WorldData {
  "path": "/field/languages/",
  "result": {
    "data": {
      "fieldLabel": {
        "name": "Languages",
        "definition": string
      },
      "fields": {
        "nodes": WorldDataCountry[]
      }
    }
  }
}