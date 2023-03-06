import { Pathy } from '@bscotch/pathy';
import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import { parseGitHubString } from '../cli/lib/parseGitHubString.js';
import {
  findOuterFunctions,
  findTokenReferences,
  stripCommentsAndStringsFromGml,
} from '../lib/parser/codeParser.js';
import { GmlToken } from '../lib/parser/GmlToken.js';
import { GmlTokenLocation } from '../lib/parser/GmlTokenLocation.js';
import { loadEnvironmentVariables } from '../utility/env.js';
import { get, unzipRemote } from '../utility/http.js';
import paths from '../utility/paths.js';
import { readTestData } from './lib/util.js';

describe('Unit Tests', function () {
  xit('can parse env files', function () {
    // Requires creating local environment variables to test,
    // since we want to keep those out of the git log. Unblock
    // the test whenever work is being done on the parser.
    const varNames = ['HELLO', 'GITHUB_PERSONAL_ACCESS_TOKEN'] as const;
    const { HELLO, GITHUB_PERSONAL_ACCESS_TOKEN } =
      loadEnvironmentVariables(varNames);
    expect(HELLO).to.equal('world');
    expect(GITHUB_PERSONAL_ACCESS_TOKEN).to.have.length.greaterThan(0);
  });

  it('can strip single-line comments from GML', function () {
    const gml = readTestData(`jsdoc-comments-and-strings.gml`);
    const expected = readTestData(`jsdoc-comments-and-strings-stripped.gml`);
    const stripped = stripCommentsAndStringsFromGml(gml);
    expect(gml.length).to.equal(stripped.stripped.length);
    expect(stripped.stripped).to.equal(expected);
  });

  it('can strip single-line comments from GML', function () {
    const gml = readTestData(`single-line-comments.gml`);
    const expected = readTestData(`single-line-comments-stripped.gml`);
    const stripped = stripCommentsAndStringsFromGml(gml);
    expect(gml.length).to.equal(stripped.stripped.length);
    expect(stripped.stripped).to.equal(expected);
  });

  it('can strip multi-line comments from GML', function () {
    const gml = readTestData(`multi-line-comments.gml`);
    const expected = readTestData(`multi-line-comments-stripped.gml`);
    const stripped = stripCommentsAndStringsFromGml(gml);
    expect(gml.length).to.equal(stripped.stripped.length);
    expect(stripped.stripped).to.equal(expected);
  });

  it('can pull strings and comments from GML even when intermixed', function () {
    const gml = readTestData(`comments-and-strings.gml`);
    const expected = readTestData(`comments-and-strings-stripped.gml`);
    const stripped = stripCommentsAndStringsFromGml(gml);
    expect(gml.length).to.equal(stripped.stripped.length);
    expect(stripped.stripped).to.equal(expected);
  });

  it('can parse functions from GML', function () {
    const sampleScriptGml = undent`
      function firstOuter(world){
        echo("in outer");
        function inner(f){
          echo("in inner");
        }
      }

        function anotherOuter(hi,hello,third){}

      var this = "that";

      var localAnonFunc = function(){};

      lessLocalAnonFunc = function(here,are,args){
        echo ("weirdly scoped");
      }; function badFormatting(arg1){
        echo("etc");
      }
    `;
    // TODO: Add equality-checking mechanisms to the instances themselves
    // to make this more robust.
    const expectedResult = [
      new GmlToken('firstOuter', new GmlTokenLocation(9, 0, 9)),
      new GmlToken('anotherOuter', new GmlTokenLocation(109, 7, 11)),
      new GmlToken('badFormatting', new GmlTokenLocation(280, 15, 12)),
    ];
    const outerFunctions = findOuterFunctions(sampleScriptGml);
    for (const index in outerFunctions) {
      expect(outerFunctions[index].name).to.equal(expectedResult[index].name);
      expect(
        outerFunctions[index].location.isSamePosition(
          expectedResult[index].location,
        ),
      ).to.be.true;
    }

    // A reference search of the same file should uncover the tokens at the same locations
    const refs = findTokenReferences(sampleScriptGml, 'badFormatting');
    expect(refs).to.have.length(1);
    expect(refs[0].location.isSamePosition(expectedResult[2].location));
  });

  it('can find function references in gml', function () {
    const funcName = 'myFunc';
    const secondFuncSuffix = `_v2`;
    const secondFuncFullName = `${funcName}${secondFuncSuffix}`;
    const sampleGml = undent`
      var someOutput = ${funcName} (someInput);

      var moreOutput = ${secondFuncFullName}( someInput ) ;
    `;
    let refs = findTokenReferences(sampleGml, funcName, {
      suffixPattern: '(_v\\d+)?',
    });
    expect(refs.length).to.equal(2);
    expect(refs[0].name).to.equal(funcName);
    expect(refs[1].name).to.equal(secondFuncFullName);
    expect(!!refs[0].isCorrectVersion).to.be.true;
    expect(refs[1].isCorrectVersion).to.be.false;
    expect(refs[0].location.line).to.equal(0);
    expect(refs[1].location.line).to.equal(2);
    for (const ref of refs) {
      expect(ref.location.column).to.equal(17);
      expect(ref.expectedName).to.equal(funcName);
    }
    // Try it again with the suffix
    refs = findTokenReferences(sampleGml, secondFuncFullName, {
      suffixPattern: '(_v\\d+)?',
    });
    expect(refs.length).to.equal(2);
  });

  it('can parse Github source strings', function () {
    expect(parseGitHubString('gm-core/gdash')).to.eql({
      repoOwner: 'gm-core',
      repoName: 'gdash',
      revision: undefined,
      tagPattern: undefined,
      revisionType: undefined,
    });
    expect(parseGitHubString('gm-core/gdash?^(\\d+\\.){2}\\d+')).to.eql({
      repoOwner: 'gm-core',
      repoName: 'gdash',
      tagPattern: '^(\\d+\\.){2}\\d+',
      revision: undefined,
      revisionType: '?',
    });
    expect(parseGitHubString('gm-core/gdash?')).to.eql({
      repoOwner: 'gm-core',
      repoName: 'gdash',
      revisionType: '?',
      revision: undefined,
      tagPattern: undefined,
    });
    expect(parseGitHubString('gm-core/gdash@4.4.0')).to.eql({
      repoOwner: 'gm-core',
      repoName: 'gdash',
      revision: '4.4.0',
      tagPattern: undefined,
      revisionType: '@',
    });
  });

  it('can fetch a text URL', async function () {
    const page = await get(
      'https://beta.bscotch.net/api/dummy/content-type/text',
    );
    expect(page.contentType.startsWith('text/plain')).to.be.true;
    expect(page.data).to.equal('Hello World');
  });

  it('can fetch a binary URL', async function () {
    const page = await get(
      'https://beta.bscotch.net/api/dummy/content-type/binary',
    );
    expect(page.contentType.startsWith('application/octet-stream')).to.be.true;
    expect(Buffer.isBuffer(page.data)).to.be.true;
    expect(page.data.toString()).to.equal('Hello World');
  });

  it('can fetch a JSON URL', async function () {
    const page = await get(
      'https://beta.bscotch.net/api/dummy/content-type/json',
    );
    expect(page.contentType.startsWith('application/json')).to.be.true;
    expect(page.data.Hello).to.equal('World');
  });

  it('can download and unzip an archive', async function () {
    const dir = new Pathy('zip-download');
    const urls = [
      'https://github.com/bscotch/rumpus-ce/archive/56e4b73bb14f887fccc860668eca31a18fc5922a.zip?ignore=this',
    ];
    //github.com/bscotch/tools/archive/refs/heads/develop.zip
    for (const url of urls) {
      await dir.delete({ force: true, recursive: true });
      await dir.ensureDirectory();
      const downloadedTo = await unzipRemote(url, dir.relative);
      console.log(downloadedTo);
      expect((await dir.listChildren()).length).to.be.greaterThan(0);
    }
  });

  it('can sort paths by specificity', function () {
    const pathList = [
      'hello/world',
      'hello',
      'h/another',
      'hello/world/goodbye',
    ];
    const expectedOrder = [
      'hello',
      'h/another',
      'hello/world',
      'hello/world/goodbye',
    ];
    pathList.sort(paths.pathSpecificitySort);
    expect(pathList).to.eql(expectedOrder);
  });
});
