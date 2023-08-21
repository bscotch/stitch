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
    if (type.self) {
      code += `\n\n*@self* ${type.self.toFeatherString()}`;
    }
    for (const param of type.listParameters()) {
      if (param?.def && param.description) {
        code += `\n\n*@param* \`${param.name}\` - ${param.description}`;
      }
    }
  } else if (type.kind === 'Struct') {
    const members = type
      .listMembers()
      .filter((x) => x.name !== 'self' && x.def)
      .sort((a, b) => {
        // underscore-prefixed should be sorted last
        const a_prefix_count = a.name?.match(/^_+/)?.[0]?.length || 0;
        const b_prefix_count = b.name?.match(/^_+/)?.[0]?.length || 0;
        if (a_prefix_count !== b_prefix_count) {
          return a_prefix_count - b_prefix_count;
        }
        return a.name
          ?.toLocaleLowerCase?.()
          .localeCompare(b.name?.toLocaleLowerCase?.());
      });
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
    const params = type.listParameters();
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
      type.isConstructor
        ? type.self!.toFeatherString()
        : type.returns?.type.length
        ? type.returns.toFeatherString()
        : 'Undefined'
    }`;
  } else {
    code += type.toFeatherString();
  }
  return code;
}
