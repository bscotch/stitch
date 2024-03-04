import type { IgorWebviewExtensionPostRun, IgorWebviewLog } from '@local-vscode/shared';

export const running: IgorWebviewExtensionPostRun = {
	kind: 'run',
	projectName: 'Fake Project',
	cleaning: false,
	cmd: `c:/ProgramData/GameMakerStudio2-Beta/Cache/runtimes/runtime-2024.200.0.516/bin/igor/windows/x64/Igor.exe`,
	args: [
		'--project="c:/PROJECT/project.yyp"',
		'--user="c:/Users/USER/AppData/Roaming/GameMakerStudio2-Beta/unknownUser_unknownUserID"',
		'--runtimePath="c:/ProgramData/GameMakerStudio2-Beta/Cache/runtimes/runtime-2024.200.0.516"',
		'--runtime=VM',
		'--config=dev',
		'--cache="c:/PROJECT/tmp/igor/cache"',
		'--temp="c:/PROJECT/tmp/igor/temp"',
		'--of="c:/PROJECT/tmp/igor/out/project.win"',
		'--tf="c:/PROJECT/project.zip"',
		'--',
		'windows',
		'Run'
	],
	runtimeVersion: '2024.200.0.516'
};

const logSample = `Options: c:/ProgramData/GameMakerStudio2-Beta/Cache/runtimes/runtime-2024.200.0.516\\bin\\platform_setting_defaults.json
Options: c:/Users/USER/AppData/Roaming/GameMakerStudio2-Beta/unknownUser_unknownUserID\\local_settings.json
Setting up the Asset compiler
Found Project Format 2
Core Resources : Debug Info - AddResourceName duplicate name Roofs ... An item with the same key has already been added. Key: Roofs
+++ GMSC serialisation:  SUCCESSFUL LOAD AND LINK TIME: 632.7109ms
Loaded Project: Crashlands2
finished.
Found Project Format 2
+++ GMSC serialisation:  SUCCESSFUL LOAD AND LINK TIME: 51.5101ms
Loaded Project: __yy_sdf_shader
finished.
Found Project Format 2
+++ GMSC serialisation:  SUCCESSFUL LOAD AND LINK TIME: 24.5889ms
Loaded Project: __yy_sdf_effect_shader
finished.
Found Project Format 2
+++ GMSC serialisation:  SUCCESSFUL LOAD AND LINK TIME: 26.0138ms
Loaded Project: __yy_sdf_blur_shader
finished.
Found Project Format 2
+++ GMSC serialisation:  SUCCESSFUL LOAD AND LINK TIME: 26.8013ms
Loaded Project: GMPresetParticles
finished.
Release build
Options: c:/project_dir/tmp/igor/cache\\ExtensionOptions.json
OptionsIni
Options: c:/project_dir/tmp/igor/cache\\PlatformOptions.json
[Compile] Run asset compiler
Looking for built-in fallback image in c:/ProgramData/GameMakerStudio2-Beta/Cache/runtimes/runtime-2024.200.0.516\\bin\\BuiltinImages
Compile Constants...finished.
Remove DnD...finished.
Compile Scripts...finished.
Compile Rooms...finished..... 0 CC empty
Compile Objects...finished.... 30 empty events
Compile Timelines...finished.
Compile Triggers...finished.
Compile Extensions...finished.
Global scripts...finished.
finished.
collapsing enums.
Final Compile...finished.
Looking for built-in particle images in c:/ProgramData/GameMakerStudio2-Beta/Cache/runtimes/runtime-2024.200.0.516\\bin\\assetcompiler\\ParticleImages
Saving IFF file... c:\\project-dir\\tmp\\igor\\out\\Crashlands2.win
Writing Chunk... GEN8 size ... -0.00 MB
option_game_speed=60
Writing Chunk... OPTN size ... 0.00 MB
Writing Chunk... LANG size ... 0.00 MB
Writing Chunk... EXTN size ... 0.00 MB
Writing Chunk... SOND size ... 0.00 MB
Writing audio file mus_creature_evolve.ogg...
Writing audio file snd_bscotch_jingle.ogg...
Writing Chunk... AGRP size ... 0.04 MB
Writing Chunk... SPRT size ... 0.00 MB
Writing Chunk... BGND size ... 1.60 MB
Writing Chunk... PATH size ... 0.00 MB
Writing Chunk... SCPT size ... 0.00 MB
Writing Chunk... GLOB size ... 0.15 MB
Writing Chunk... SHDR size ... 0.00 MB
Writing Chunk... FONT size ... 0.22 MB
Writing Chunk... TMLN size ... 0.00 MB
Writing Chunk... OBJT size ... 0.00 MB
Writing Chunk... FEDS size ... 0.10 MB
Writing Chunk... ACRV size ... 0.00 MB
Writing Chunk... SEQN size ... 0.00 MB
Writing Chunk... TAGS size ... 0.00 MB
Writing Chunk... ROOM size ... 0.00 MB
Writing Chunk... DAFL size ... 0.02 MB
Writing Chunk... EMBI size ... 0.00 MB
Writing Chunk... PSEM size ... 0.00 MB
Writing Chunk... PSYS size ... 0.01 MB
Writing Chunk... TPAGE size ... 0.00 MB
Texture Group - Interface
Texture Group - __YY__0fallbacktexture.png_YYG_AUTO_GEN_TEX_GROUP_NAME_
c:\\project-dir\\extensions\\NekoPresence\\iOSSource\\..\\post_textures.bat
Writing Chunk... TGIN size ... 0.05 MB
Writing Chunk... CODE size ... 0.01 MB
Writing Chunk... VARI size ... 3.99 MB
Writing Chunk... FUNC size ... 0.63 MB
Writing Chunk... FEAT size ... 0.28 MB
Writing Chunk... STRG size ... 0.00 MB
Writing Chunk... TXTR size ... 2.05 MB
0 Compressing texture... writing texture __yy__0fallbacktexture.png_yyg_auto_gen_tex_group_name__0.yytex... 
1 Compressing texture... writing texture bscotchpack_0.yytex... 
2 Compressing texture... writing texture default_0.yytex... 
3 Compressing texture... writing texture default_1.yytex... 
4 Compressing texture... writing texture default_2.yytex... 
5 Compressing texture... writing texture default_3.yytex... 
6 Compressing texture... writing texture default_4.yytex... 
7 Compressing texture... writing texture default_5.yytex... 
8 Compressing texture... writing texture default_6.yytex... 
9 Compressing texture... writing texture default_7.yytex... 
Writing Chunk... AUDO size ... 33.59 MB
Writing Chunk... SCPT size ... -0.00 MB
Writing Chunk... DBGI size ... 0.11 MB
Writing Chunk... INST size ... 1.97 MB
Writing Chunk... LOCL size ... 0.00 MB
Writing Chunk... DFNC size ... 0.14 MB
Writing Chunk... STRG size ... 0.38 MB
Stats : GMA : Elapsed=8601.6945
Stats : GMA : sp=1196,au=939,bk=0,pt=0,sc=13263,sh=26,fo=2,tl=0,ob=244,ro=21,da=26,ex=14,ma=1663,fm=0xD840B39F7FFF67B5
Igor complete.
[Run] Run game
Setting scheduler resolution to 1
Attempting to set gamepadcount to 12
DirectX11: Using hardware device
Collision Event time(microsecs)=28
Variable_Global_Init()
PrepareGame()
Audio_Init()
Game_Prepare()
Script_Prepare() 
TimeLine_Prepare() 
Object_Prepare() 
Room_Prepare() 
Finished PrepareGame() 
Run_Start
Done g_EffectsManager.Init()
Done RenderStateManager
CreateColPairs took 0.000000s 8 usecs for 245 object types obj_col_numb=0 physobjcount=0 resizes 0 final size 0
Done ObjectLists
Done Extension_Initialize
About to startroom
o_init|1.26| ===================  Asset Lookup Initialized  =================== 
o_init|1.26| 939 Sounds 
o_init|1.26| 21 Rooms 
o_init|1.26| 245 Objects 
o_init|1.26| 1196 Sprites 
o_init|1.26| 20 Particles 
o_init|1.26| ===================   =================== 
o_init|1.90| ===================  Loading Languages  =================== 
o_init|1.90| Getting path for packed file: l10n.json 
o_init|1.90|   Using in main folder: l10n.json 
o_init|1.97| Earparty initializing! 
o_init|1.99| ===================  BscotchPack Initialized  =================== 
Struct.Bschema|1.99| Getting path for packed file: gamechanger.json 
Struct.Bschema|1.99|   Using in main folder: gamechanger.json 
Struct.Bschema|2.35| Loaded Bschema packed file. Packed commit ID: c3046 
o_init|2.35| WARNING: Did not find any instance of o_google_controller that is needed for the GPGS sign-in method 
o_init duration (ms):1174
Total memory used = 1819714398 (0x6c76a35e) bytes 1735.41MB
Free memory = 21602160 (0x01499f70) bytes 20.60MB
Peak memory used = 1842932821 (0x6dd8ec55) bytes 1757.56MB
**********************************.
Entering main loop.
**********************************.
Resizing swap chain...
o_rumpus_user_transitioner|2.44| Spawned Rumpus user transitioner. 
o_async_manager|3.31| File group name: Dev 
LOAD: numFiles 1, numBundleFiles 0
o_rumpus_loader|3.32| Loaded master file! Verifying contents. 
o_async_manager|3.33| File group name: Dev 
LOAD: checking file Rumpus/Crates/game-changer/metadata
LOAD: checking file Rumpus/Crates/public-library/metadata
LOAD: checking file Rumpus/Crates/cl2-workshop/metadata
LOAD: numFiles 3, numBundleFiles 0
o_rumpus_loader|3.34| Successfully loaded crate ID game-changer 
o_rumpus_loader|3.34| Successfully loaded crate ID public-library 
o_rumpus_loader|3.34| Successfully loaded crate ID cl2-workshop 
o_rumpus_user_loader|3.50| ===================  Loading user: bscotch404  =================== 
o_async_manager|3.51| File group name: Dev 
LOAD: numFiles 1, numBundleFiles 0
o_http_controller|3.90| Response 4: Received HTTP Status 200 from URL https://dev.example.com/api/version 
o_rumpus_item_downloader|3.92| Sending download request... 
o_async_manager|3.92| Queueing async save at Dev/Rumpus/master with cooldown 10 
o_http_controller|3.98| Response 5: Received HTTP Status 200 from URL https://dev.example.com/api/storage/crates/public-library/items?names=in-game-announcements&download=true 
o_rumpus_item_downloader|3.99| Metadata of item: { bytes : 597, tags : [  ], etag : ""255-OT8d3l7xWVjO3SM4A36sQD1YLuM"", itemId : "5f4685fd43a223001f40582e", updatedAt : "2021-12-16T15:36:01.482Z", createdAt : "2020-08-26T15:55:41.250Z", _id : "5f4685fd43a223001f40582e", mimetype : "application/json", collaborators : [ "bscotch404","bscotch101","bscotch007" ], crateId : "public-library", createdAgo : 110788239, updatedAgo : 69576618, name : "in-game-announcements", userId : "bscotch404" } 
o_rumpus_item_downloader|3.99| Downloaded item contents. Writing to Rumpus! 
o_rumpus_item_downloader|3.99| Rumpus storage writing item: Dev/Rumpus/Crates/public-library/5f4685fd43a223001f40582e 
o_rumpus_item_downloader|3.99| Queueing async save at Dev/Rumpus/Crates/public-library/5f4685fd43a223001f40582e with cooldown 0 
o_async_manager|3.99| Queueing async save at Dev/Rumpus/master with cooldown 10 
o_bschema_loader|5.34| Field additionalProperties/properties/element/properties/actions/additionalProperties/properties/element/oneOf/20/properties/pool/properties/babbler/formatProperties/validationSchema/type doesn't exist in my diff. 
o_bschema_loader|5.34| Checking field additionalProperties/properties/element/properties/actions/additionalProperties/properties/element/oneOf/20/properties/pool/properties/babbler/formatProperties/validationSchema/additionalProperties 
o_bschema_loader|5.34| Field additionalProperties/properties/element/properties/actions/additionalProperties/properties/element/oneOf/20/properties/pool/properties/babbler/formatProperties/validationSchema/additionalProperties doesn't exist in my diff. 
o_bschema_loader|5.34| Checking field additionalProperties/properties/element/properties/actions/additionalProperties/properties/element/oneOf/20/properties/pool/properties/babbler/access/audio 
o_bschema_loader|5.34| Field additionalProperties/properties/element/properties/actions/additionalProperties/properties/element/oneOf/20/properties/pool/properties/babbler/access/audio doesn't exist in my diff. 
o_bschema_loader|5.35| Got change of type none in ID ab_driftbulb_boom 
o_bschema_loader|5.35| ===================  Finished checking for changes  =================== 
o_bschema_loader step 7 duration (ms):211
o_bschema_loader|5.35| Bschema Loader State: 8 (Constructing Base Motes) 
o_bschema_loader step 8 duration (ms):26
o_bschema_loader|5.38| Bschema Loader State: 9 (Constructing Motes) 
o_bschema_loader step 9 duration (ms):259
o_bschema_loader|5.63| Bschema Loader State: 10 (Constructing Base Schemas) 
Pause event has been registered for this frame
o_bschema_loader step 10 duration (ms):213
o_bschema_loader|5.85| Bschema Loader State: 11 (Constructing Schemas) 
Pause event has been unregistered
o_bschema_loader step 11 duration (ms):227
o_bschema_loader|6.08| Bschema Loader State: 12 (Creating Draft) 
Struct.BschemaChanges|6.08| Applying changes. 
Struct.BschemaChanges|6.08| Setting additionalProperties/properties/element/properties/actions/additionalProperties/properties/element/oneOf/14/properties/projectile/oneOf/0/properties/multiples/additionalProperties/properties/element/required to 1 
###game_end###0
Attempting to set gamepadcount to 0
Script_Free called with 13262 and global 922
Unsetting previous scheduler resolution of 1


Igor complete.
`;

export const logs: IgorWebviewLog[] = logSample.split(/\r?\n/g).map((line, i) => ({
	kind: 'stdout',
	message: line
}));
