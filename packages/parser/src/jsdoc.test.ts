import { undent } from '@bscotch/utility';
import { parseJsdocString } from './jsdoc.js';

describe.only('JSDocs', function () {
  it('can parse GML-style Function JSDocs', function () {
    const jsdoc = undent`
      /// @desc This is a multiline
      ///       description.
      /// @param {String} first This is the first parameter
      /// @param {Real} second This is the second parameter,
      ///        which spans multiple lines.
      /// @param {Struct} [third] This parameter is optional
      /// @param {Struct} [fourth = "bleh" ] This is optional and has a default value
      /// @param {Bool} [...] And so is this one, but there can be as many as you want!
      /// @returns {Struct} And here is a multiline
      ///  description of the return type.
      /// @self Struct.AnotherConstructor
      /// @deprecated
    `;
    const parsed = parseJsdocString(jsdoc);
    console.log(parsed);
  });
});
