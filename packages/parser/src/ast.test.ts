import { GmlCstGenerator } from './ast.js';
import { parser } from './parser.js';

const sample = `
enum my_enum {
  a,
  b,
  hello = 10
}
`;

describe.only('GML AST', function () {
  it('can create an AST', function () {
    const parsed = parser.parse(sample);
    const generator = new GmlCstGenerator();
    const ast = generator.visit(parsed.cst);
    console.dir(ast);
  });
});
