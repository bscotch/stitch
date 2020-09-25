import { Gms2Project } from '../../lib/Gms2Project';
import fs from '../../lib/files';
import { assert } from '../../lib/errors';

export default function(source_asset_path:string, target_project_path?:string){
  assert(fs.existsSync(source_asset_path), `Source path does not exists at: ${source_asset_path}`);
  let targetModules: string[];
  if (!Array.isArray(extensions)){
    targetModules = [extensions] as string[];
  }
  else{
    targetModules = extensions;
  }
  targetModules.forEach((module)=>{
    assert((typeof module) == "string", `Target modules are not entered as strings: ${module}`);
  });

  const targetProject = new Gms2Project(target_project_path || process.cwd());
  targetProject.importModules(source_asset_path,targetModules);
  return targetProject;
}

const project = getResetProject();
expect(()=>project.addSound(audioSample+'-fake.mp3'),
  'should not be able to upsert non-existing audio assets'
).to.throw;
project.addSound(audioSample);
// Questions:
//   Is the sound in the yyp?
const audio = project.resources
  .findByField('name',paths.parse(audioSample).name,Gms2Sound);
expect(audio,'New audio should be upserted').to.exist;
if(!audio){ throwNever(); }
//   Does the sound .yy exist?
expect(fs.existsSync(audio.yyPathAbsolute),'.yy file should exist').to.be.true;
//   Does the audio file exist?
expect(fs.existsSync(audio.audioFilePathAbsolute),'audio file should exist').to.be.true;