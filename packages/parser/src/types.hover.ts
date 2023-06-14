import type { Type } from './types.js';
import { assert } from './util.js';

export function typeToHoverText(type: Type) {
  let code = '';
  if (type.isFunction) {
    code = `function ${type.name || ''}(`;
    const params = type._params || [];
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      assert(param, 'Param is undefined');
      if (i > 0) {
        code += ', ';
      }
      code += param.name;
      if (param.optional) {
        code += '?';
      }
      if (param.type.kind !== 'Unknown') {
        code += ': ' + param.type.toFeatherString();
      }
    }
    code += ')';
    if (type.kind === 'Constructor') {
      code += ` constructor`;
    }
    if (type.constructs && type.constructs.kind !== 'Undefined') {
      code += ': ' + (type.constructs.toFeatherString() || 'Unknown');
    } else if (type.returns && type.returns.kind !== 'Undefined') {
      code += ': ' + (type.returns?.toFeatherString() || 'Unknown');
    }
  } else {
    if (type.name) {
      code = `${type.name}: `;
    }
    code += type.toFeatherString();
  }
  return code;
}
