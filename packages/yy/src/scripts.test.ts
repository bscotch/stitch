import { expect } from 'chai';
import { addScript, listYyFiles } from './scripts.js';
import { joinPaths } from './types/utility.js';

const projectPath = '../../../crashlands-2/Crashlands2';
const scriptsPath = joinPaths(projectPath, 'scripts');
const yypPath = joinPaths(projectPath, 'Crashlands2.yyp');

describe.skip('Scripts', function () {
  it('can list all scripts in a project', async () => {
    console.dir(await listYyFiles(scriptsPath));
  });

  it('can create a new script and update it', async () => {
    // Create a new script by sticking a random integer after a prefix
    const scriptName = `test_script_${Math.floor(Math.random() * 1000)}`;
    expect(
      (await addScript(yypPath, scriptName, 'var first=true;')).result,
    ).to.equal('created');
    expect((await addScript(yypPath, scriptName)).result).to.equal('noop');
    expect(
      (await addScript(yypPath, scriptName, 'var second=true;')).result,
    ).to.equal('updated');
  });
});
