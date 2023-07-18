import type { Signifier } from './signifiers.js';
import type { Type } from './types.js';
import { assert } from './util.js';

export function typeMemberToHoverText(member: Signifier) {
  let code = member.name;
  if (member.optional) {
    code += '?';
  }
  code += ': ' + member.type.toFeatherString();
  return code;
}

export function typeToHoverDetails(type: Type) {
  let code = '';
  if (type.isFunction) {
    if (type.context) {
      code += `\n\n*@self* ${type.context.toFeatherString()}`;
    }
    for (const param of type.listParameters()) {
      if (param.def && param.description) {
        code += `\n\n*@param* \`${param.name}\` - ${param.description}`;
      }
    }
  } else if (type.kind === 'Struct') {
    const members = type
      .listMembers()
      .filter((x) => x.name !== 'self' && x.def)
      .sort((a, b) =>
        a.name
          ?.toLocaleLowerCase?.()
          .localeCompare(b.name?.toLocaleLowerCase?.()),
      );
    if (!members.length) {
      return '';
    }
    code = '```ts\n{\n';
    let i = 0;
    for (const member of members) {
      code += `  ${member.name}: ${member.type.toFeatherString()},\n`;
      i++;
      if (i > 19) {
        code += '  // ... and more!\n';
        break;
      }
    }
    code += '}\n```';
  } else if (type.kind === 'Enum') {
    const members = type
      .listMembers()
      .filter((x) => x.name !== 'self' && x.def);
    if (!members.length) {
      return '';
    }
    code = '```ts\n{\n';
    let i = 0;
    for (const member of members) {
      code += `  ${member.name},\n`;
      i++;
      if (i > 19) {
        code += '  // ... and more!\n';
        break;
      }
    }
  }
  return code;
}

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
      code += typeMemberToHoverText(param);
    }
    code += ')';
    if (type.isConstructor) {
      code += ` constructor`;
    }
    code += `: ${
      type.constructs
        ? type.constructs.toFeatherString()
        : type.returns?.type.length
        ? type.returns.toFeatherString()
        : 'Undefined'
    }`;
  } else {
    code += type.toFeatherString();
  }
  return code;
}
