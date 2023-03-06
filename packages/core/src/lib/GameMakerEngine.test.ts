import { expect } from 'chai';
import { GameMakerEngine } from './GameMakerEngine.js';

describe('GameMaker Engine', function () {
  it('can differentiate beta and stable version strings', function () {
    const betaVersions = [
      '2022.100.0.443',
      '2022.500.0.77',
      '23.1.1.238',
      '23.1.1.23',
      // Edge
      '2022.600.0.11',
      '23.1.1.29',
    ];
    const stableVersions = ['2.2.2.326', '2022.1.1.483', '2022.5.2.13'];
    for (const version of betaVersions) {
      expect(GameMakerEngine.isBetaVersion(version)).to.be.true;
    }
    for (const version of stableVersions) {
      expect(GameMakerEngine.isBetaVersion(version)).to.be.false;
    }
  });
});
