import type { Type, TypeMember } from './types.js';
import { assert } from './util.js';

export function typeMemberToHoverText(member: TypeMember) {
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
    for (const param of type.listParameters()) {
      if (param.description || param.type.description) {
        code += `\n\n*@param* \`${param.name}\` - ${
          param.description || param.type.description
        }`;
      }
    }
  } else if (type.kind === 'Struct') {
    const members = type.listMembers().filter((x) => x.name !== 'self');
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
    if (type.kind === 'Constructor') {
      code += ` constructor`;
    }
    code += `: ${
      type.constructs
        ? type.constructs.toFeatherString()
        : type.returns?.toFeatherString() || 'Unknown'
    }`;
  } else {
    code += type.toFeatherString();
  }
  return code;
}
