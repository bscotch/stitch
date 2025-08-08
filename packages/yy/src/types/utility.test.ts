import { expect } from 'chai';
import { GameMakerVersionString } from './GameMakerVersionString.js';
import { FixedNumber, joinPaths, parsePath, toPosixPath } from './utility.js';

describe('Utilities', function () {
  it('can join path parts', function () {
    expect(joinPaths('/hello/', '/world/')).to.equal('/hello/world/');
    expect(joinPaths('hello', 'world', '/and', '/another/', '/thing')).to.equal(
      'hello/world/and/another/thing',
    );
  });

  it('can ensure posix path separators', function () {
    expect(toPosixPath('hello\\world\\and\\another\\thing')).to.equal(
      'hello/world/and/another/thing',
    );
    expect(toPosixPath('C:\\Okay\\Now/We Have\\/Got_IT\\')).to.equal(
      'C:/Okay/Now/We Have//Got_IT/',
    );
  });

  it('can parse path parts', function () {
    expect(parsePath('hello\\world/file.png')).to.eql({
      filename: 'file.png',
      fullpath: 'hello/world/file.png',
      parent: 'hello/world/',
      ext: '.png',
    });
  });

  it('can parse and compare GameMaker version strings', function () {
    const versions = GameMakerVersionString.from([
      '2023.3.1.401',
      '2023.4.1.401',
      '2022.3.1.401',
      '2023.3.1.402',
    ]);
    GameMakerVersionString.sort(versions);
    expect(versions.map((v) => v.version)).to.deep.equal([
      '2022.3.1.401',
      '2023.3.1.401',
      '2023.3.1.402',
      '2023.4.1.401',
    ]);
    expect(versions[0].parsed).to.deep.equal([2022, 3, 1, 401]);

    expect(GameMakerVersionString.gt('2023.3.1.401', '2023.3.1.400')).to.be
      .true;
    expect(GameMakerVersionString.gt('2023.3.1.401', '2023.3.1.401')).to.be
      .false;
    expect(GameMakerVersionString.gte('2023.3.1.401', '2023.3.1.401')).to.be
      .true;
    expect(GameMakerVersionString.gte('2023.3.1.401', '2023.3.1.400')).to.be
      .true;
    expect(GameMakerVersionString.eq('2023.3.1.401', '2023.3.1.401')).to.be
      .true;
    expect(GameMakerVersionString.eq('2023.3.1.401', '2023.3.1.400')).to.be
      .false;
  });

  it('can use FixedNumber instances in place of number primitives', function () {
    expect(new FixedNumber(1)).to.be.an.instanceof(FixedNumber);
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(1) == 1).to.be.true;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(1) == 2).to.be.false;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(32) + 2 == 34).to.be.true;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(32) + 2 == 3).to.be.false;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.11) == 10.11).to.be.true;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.11) === 10.11).to.be.false;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.11) > 10).to.be.true;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.11) < 12).to.be.true;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.11) < 10).to.be.false;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.11) > 12).to.be.false;
    expect(`${new FixedNumber(10.123, 2)}`).to.equal('10.12');
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.123, 2) == '10.12').to.be.false;
    // @ts-expect-error Types are compatible despite not looking like it
    expect(new FixedNumber(10.123, 2) == '10.123').to.be.true;
  });
});
