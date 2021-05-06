import { expect } from 'chai';
import fs from '../lib/files';
import paths from '../lib/paths';
import { parseGithubSourceString } from '../cli/lib/merge';
import { jsonify as stringify } from '../lib/jsonify';
import { undent } from '@bscotch/utility';
import { NumberFixed } from '../lib/NumberFixed';
import { get, unzipRemote } from '../lib/http';
import { loadEnvironmentVariables } from '../lib/env';
import {
  findTokenReferences,
  findOuterFunctions,
  GmlTokenLocation,
  GmlToken,
} from '../lib/codeParser';

describe('Unit Tests', function () {
  xit('can parse env files', function () {
    // Requires creating local environment variables to test,
    // since we want to keep those out of the git log. Unblock
    // the test whenever work is being done on the parser.
    const varNames = ['HELLO', 'GITHUB_PERSONAL_ACCESS_TOKEN'] as const;
    const { HELLO, GITHUB_PERSONAL_ACCESS_TOKEN } = loadEnvironmentVariables(
      varNames,
    );
    expect(HELLO).to.equal('world');
    expect(GITHUB_PERSONAL_ACCESS_TOKEN).to.have.length.greaterThan(0);
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
        outerFunctions[index].location.hasSamePosition(
          expectedResult[index].location,
        ),
      ).to.be.true;
    }

    // A reference search of the same file should uncover the tokens at the same locations
    const refs = findTokenReferences(sampleScriptGml, 'badFormatting');
    expect(refs).to.have.length(1);
    expect(refs[0].location.hasSamePosition(expectedResult[2].location));
  });

  it('can find function references in gml', function () {
    const funcName = 'myFunc';
    const secondFuncSuffix = `_v2`;
    const secondFuncFullName = `${funcName}${secondFuncSuffix}`;
    const sampleGml = undent`
      var someOutput = ${funcName} (someInput);

      var moreOutput = ${secondFuncFullName}( someInput ) ;
    `;
    let refs = findTokenReferences(sampleGml, funcName, undefined, '(_v\\d+)?');
    expect(refs.length).to.equal(2);
    expect(refs[0].name).to.equal(funcName);
    expect(refs[1].name).to.equal(secondFuncFullName);
    expect(!!refs[0].isCorrectVersion).to.be.true;
    expect(refs[1].isCorrectVersion).to.be.false;
    expect(refs[0].location.line).to.equal(0);
    expect(refs[1].location.line).to.equal(2);
    for (const ref of refs) {
      expect(ref.location.column).to.equal(17);
      expect(ref.name).to.equal(funcName);
    }

    // Try it again with the suffix
    refs = findTokenReferences(
      sampleGml,
      secondFuncFullName,
      undefined,
      '(_v\\d+)?',
    );
    expect(refs.length).to.equal(2);
  });

  it('can parse Github source strings', function () {
    expect(parseGithubSourceString('gm-core/gdash')).to.eql({
      owner: 'gm-core',
      name: 'gdash',
      revision: undefined,
      tagPattern: undefined,
      revisionType: undefined,
    });
    expect(parseGithubSourceString('gm-core/gdash?^(\\d+\\.){2}\\d+')).to.eql({
      owner: 'gm-core',
      name: 'gdash',
      tagPattern: '^(\\d+\\.){2}\\d+',
      revision: undefined,
      revisionType: '?',
    });
    expect(parseGithubSourceString('gm-core/gdash?')).to.eql({
      owner: 'gm-core',
      name: 'gdash',
      revisionType: '?',
      revision: undefined,
      tagPattern: undefined,
    });
    expect(parseGithubSourceString('gm-core/gdash@4.4.0')).to.eql({
      owner: 'gm-core',
      name: 'gdash',
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
    const dir = 'zip-download';
    const smallRepo =
      'https://github.com/bscotch/node-util/archive/d1264e78319521c9667206330a9aaa36fa82e1a5.zip?ignore=this';
    const downloadedTo = await unzipRemote(smallRepo, dir);
    expect(downloadedTo).to.match(
      /node-util-d1264e78319521c9667206330a9aaa36fa82e1a5/,
    );
    fs.emptyDirSync(dir);
    fs.removeSync(dir);
  });

  it('can create fixed-decimal numbers', function () {
    expect(`${Number(15.1234134)}`).to.equal('15.1234134');
    expect(`${new NumberFixed(15.1234134, 1)}`).to.equal('15.1');
    expect(`${new NumberFixed(15.1234134, 3)}`).to.equal('15.123');
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

  it('can create GMS2-style JSON', function () {
    expect(
      stringify({
        hello: 'world',
        parent: { child: ['10', '20'] },
        array: [{ name: 'child1', field: true }, { name: 'child2' }],
      }),
    ).to.equal(
      undent`
      {
        "hello": "world",
        "parent": {
          "child": [
            "10",
            "20",
          ],
        },
        "array": [
          {"name":"child1","field":true,},
          {"name":"child2",},
        ],
      }
    `.replace(/\r?\n/gm, '\r\n'),
    );
  });
});
