import React from "react";

export const formatJSONWithHighlighting = (json) => {
    const jsonString = JSON.stringify(json, null, 2);
    return jsonString.replace(
      /("(\w+)":)|(\{|\}|\[|\]|,)/g,
      (match, key, keyName, symbol) => {
        if (key) {
          return `<span class="json-key">${keyName}</span>:`;
        } else if (symbol) {
          return `<span class="json-symbol">${symbol}</span>`;
        }
        return match;
      }
    );
  };