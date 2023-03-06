function bschema_init(project_setup_function, _commit_id_prefix=undefined) {
	#macro loggytag_bschema "Bschema"
	loggy_tag_set_verbose(loggytag_bschema, false);
	assert(is_defined(_commit_id_prefix), "Missing commit ID prefix");
	for (var i = 1; i <= string_length(_commit_id_prefix); i++){
		assert(char_is_ascii_letter(string_char_at(_commit_id_prefix, i)), "Commit ID prefix must be letters only.");
	}
	globalvar BSCHEMA;
	BSCHEMA = {
		force_use_packed : false,
		#region Global stuff
		core_types		: {},
		type_lookup		: {},
		hydrators		: {},
		project_setup	: project_setup_function,
		
		invalid_motes : {}, // Regenerated when validating motes.
		links : {},
		
		commit_id_prefix : _commit_id_prefix,
		schema_mote_ids	: {}, // Just used for lookup at runtime. No need to save/load.
		schema_invalid_mote_ids : {},
		schema_changed_mote_ids : {},
		roles : {},
		user : {},
		#endregion
		
		#region Working copy
		commitId : "",
		motes : {}, // bschema_mote_create()
		schemas : {},
		uid_pools : {},
		changes : {
			message : "",
			motes : {},
			schemas : {},
		},
		
		#endregion
		base : {
			commitId	: "",
			schemas		: {},
			uid_pools	: {},
			motes		: {},
			changes		: {},
		},
		latest_commitId : undefined,
		packed_commitId : undefined,
		latest : undefined
	};
	
	_bschema_setup_core_types();
	_bschema_test();
	bschema_init_custom_hydrators();
	
	gc_init();
	
	_bschema_sprite_init_preview();
	
	bschema_load_packed(true);
	
	#macro bschema_role_programmer "programmer"
	#macro bschema_role_design "design"
	#macro bschema_role_audio "audio"
	#macro bschema_role_narrative "narrative"
	#macro bschema_role_basic "basic"
	
	bschema_access_role_create(bschema_role_programmer,	["bscotch101"],	[],	access_type.crud);
	bschema_access_role_create(bschema_role_design,		["bscotch007", "bscotch772", "bscotch045" /*fat bard*/], [], access_type.crud);
	bschema_access_role_create(bschema_role_basic,		[],	["staff"], access_type.read);
	bschema_access_role_create(bschema_role_narrative,	[],	[], access_type.read);
	bschema_access_role_create(bschema_role_audio,		[], [],	access_type.read);
}

function bschema_project_setup() {
	_bschema_schema2_setup();
	_bschema_init_earparty_schemas();
	_bschema_init_gms_object_schema();
	_bschema_init_sprite_schema();
	_bschema_init_video_schema();
	
	gc_wip_add_to_schemas();
	
	#region Subschemas
	_gc_init_wip_subschema();
	#endregion
	
	earparty_sounds_to_motes();
	if is_defined(BSCHEMA.project_setup) {
		BSCHEMA.project_setup();
	}
}

#macro bschema_tally_schema_mote_ids "schema_mote_ids"
#macro bschema_tally_schema_invalid_mote_ids "schema_invalid_mote_ids"
#macro bschema_tally_schema_changed_mote_ids "schema_changed_mote_ids"

function bschema_mote_tally_count_all(field) {
	var _schemas = struct_get_names(BSCHEMA[$ field]);
	var _total = 0;
	var num_schemas = array_length(_schemas);
	for (var i = 0; i < num_schemas; i++){
		_total += bschema_mote_tally_count(_schemas[i], field);
	}
	return _total;
}

function bschema_mote_tally_count(schema_id, field) {
	var _array = BSCHEMA[$ field][$ schema_id];
	if is_undefined(_array) { return 0; }
	return array_length(_array);
}

function bschema_mote_tally_get_all_motes(field) {
	var _motes = [];
	var _schemas = struct_get_names(BSCHEMA[$ field]);
	var num_schemas = array_length(_schemas);
	for (var i = 0; i < num_schemas; i++) {
		array_merge(_motes, BSCHEMA[$ field][$ _schemas[i]]);
	}
	return _motes;
}

function bschema_mote_tally_clear(field) {
	var _old_tally = BSCHEMA[$ field];
	delete _old_tally;
	BSCHEMA[$ field] = {};
}

function bschema_mote_tally_add(mote_id, field) {
	var _schema_id = bschema_mote_get_schema_id(mote_id, true);
	if is_defined(_schema_id) {
		//echo("Mote Tally: Adding", mote_id, "to", field, "under schema", _schema_id);
		struct_array_push(BSCHEMA[$ field], _schema_id, mote_id, true);
	}
}

function bschema_mote_tally_remove(mote_id, field) {
	var _schema_id = bschema_mote_get_schema_id(mote_id, true);
	if is_defined(_schema_id) {
		//echo("Mote Tally: Removing", mote_id, "from", field, "under schema", _schema_id);
		struct_array_delete_element(BSCHEMA[$ field], _schema_id, mote_id);
	}
}

function bschema_mote_tally_remove_all(mote_id) {
	bschema_mote_tally_remove(mote_id, bschema_tally_schema_mote_ids);
	bschema_mote_tally_remove(mote_id, bschema_tally_schema_invalid_mote_ids);
	bschema_mote_tally_remove(mote_id, bschema_tally_schema_changed_mote_ids);
}
