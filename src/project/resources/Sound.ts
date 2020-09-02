import {Resource} from './Resource';
import { join } from 'path';
import { statSync, existsSync } from 'fs-extra';
import cloneDeep from 'lodash/cloneDeep';
import {soundTemplate,SoundTemplate} from './templates/sound';
import {v4 as uuidV4} from "uuid";
import {Project} from "../Project";
import path from "path";
import {RawResource} from "../types/project";
import fs from 'fs-extra';
import {assert} from "../lib/messages";
import json from "../lib/json";


export class Sound extends Resource{
  yy: SoundTemplate;

  constructor(project:Project,resource:RawResource){
    super(project,resource,'GMSound');
    this.dir = Sound.soundDirectory(this.name);
    this.yyPath = join(this.dir,`${this.name}.yy`);
    this.yy = json.readFileSync(this.absoluteYyPath);
  }

  static soundDirectory(name:string|null){
    let dir = 'sounds';
    if(name){
      dir = join(dir,name);
    }
    return dir;
  }

  static replaceSoundFile(project:Project,source:string){
    assert(existsSync(source),`${source} does not exist`);
    const name = Sound.nameFromSource(source);
    const outDir = project.getAbsolutePath(Sound.soundDirectory(name));
    fs.ensureDirSync(outDir);
    fs.copySync(source,path.join(outDir,name));
  }

  static create(project:Project,source:string){
    assert(project&&source,"Arguments missing");
    assert(existsSync(source),`Sound source does not exist: ${source}`);
    assert(statSync(source).isFile(),`Source is not a file`);
    // An audioGroupGuid is required for the YY file,
    // but currently it isn't clear how to infer that from the project files.
    // For now, require at least one existing sound so that we can use
    // its audioGroupGuid for new sounds.
    const soundsWithGuid: Sound[] = project.sounds.filter(s=>s.yy.audioGroupGuid);
    assert(soundsWithGuid.length,"At least one sound must be added inside GMS2 before adding new sounds externally");
    const name = Sound.nameFromSource(source);
    // Build the raw resource object
    const key = uuidV4();
    const yy = cloneDeep(soundTemplate);
    yy.name = name;
    yy.id = key;
    yy.audioGroupGuid = soundsWithGuid[0].yy.audioGroupGuid;
    if(/^mus_/.test(yy.name)){
      yy.kind = 1;
      yy.type = 1;
    }
    // Create the yyFile dir and file, and copy the source over
    Sound.replaceSoundFile(project,source);
    const dir = Sound.soundDirectory(name);
    const yyPath = join(dir,`${name}.yy`);
    project.writeJSONSync(yyPath,yy);
    // Make the Sound object and add it to the Project
    const sound = new Sound(
      project,
      Project.createYYPResource(key,"GMSound",`sounds\\${name}\\${name}.yy`)
    );
    const view = project.ensureViewExists('sounds/NEW');
    // Add the Sound object to the sounds/NEW view (ensure the View first). Write the View (probably already happening)
    view.addChild(sound,true);
    project.commit();
    return view;
  }
}

