globalvar BSCHEMA;
BSCHEMA = new Bschema(init_cl2_schemas, "c");

/// @desc Intended as a singleton. Stores all data related to Schemas and Motes.
/// @param {Function} project_setup_function Function that sets up project-specific schemas
/// @param {String} _commit_id_prefix Prefix for commit IDs. Must be letters only.
function Bschema (project_setup_function, _commit_id_prefix) constructor {
	assert(is_defined(_commit_id_prefix), "Missing commit ID prefix");
	force_use_packed = false;
	project_setup	= project_setup_function;
	commit_id_prefix = _commit_id_prefix;
	/// @type {Struct<Array<String>>}
	schema_mote_ids	= {}; // Just used for lookup at runtime. No need to save/load.
	/// @type {Struct<Struct.BschemaRole>}
	roles = {};
	
	#region Working copy
	commitId = "";
	/// @type {Struct<Array<Real>>}
	uid_pools = {};
	changes = new BschemaChanges();
	#endregion

	base = {
		commitId	: "",
		/// @type {Struct<Array<Real>>}
		uid_pools	: {},
		changes		: new BschemaChanges(),
	};
	/// @type {String|Undefined}
	latest_commitId = undefined;
	/// @type {String|Undefined}
	packed_commitId = undefined;
	/// @type {String}
	latest = undefined;

	#region METHODS
	
		#region COMMIT IDS
		/// @param {Real} _number
		/// @returns {String}
		static create_commit_id = function create_commit_id(_number) {
			return commit_id_prefix + string(_number);
		}

		/// @returns {String}
		static next_commit_id = function next_commit_id() {
			return self.create_commit_id(real(string_digits(commitId))+1) ;
		}
		#endregion
		
		#region CHANGES
		static clear_changes = function clear_changes() {
			changes = new BschemaChanges();
			bschema_mote_tally_clear(bschema_tally_schema_changed_mote_ids);
		}
		#endregion
	
	/// @param {String} _role_id
	/// @param {Array<String>} _user_ids
	/// @param {Array<String>} _user_types
	/// @param {Enum.access_type} [_baseline_access]
	function create_role(_role_id, _user_ids=[], _user_types=[], _baseline_access=access_type.read) {
		var _role = new BschemaRole();
		_role.users = _user_ids;
		_role.usertypes =  _user_types;
		_role.access = _baseline_access;
	
		roles[$ _role_id] =  _role;
	}
	#endregion
	
	/// @desc Initialize Bschema with appropriate types etc.
	static init = function init(){
	
		#macro bschema_role_programmer "programmer"
		#macro bschema_role_design "design"
		#macro bschema_role_audio "audio"
		#macro bschema_role_narrative "narrative"
		#macro bschema_role_basic "basic"
	
		create_role(bschema_role_programmer,	[DEVS.seth.id, DEVS.adam.id],	[],	access_type.crud);
		create_role(bschema_role_design,		[DEVS.sam.id, DEVS.jen.id, DEVS.fatbard.id], [], access_type.crud);
		create_role(bschema_role_basic,		[],	["staff"]);
		create_role(bschema_role_narrative);
		create_role(bschema_role_audio);
	}
	
	
}

function BschemaRole () constructor {
	/// @type {Array<String>}
	users = [];
	/// @type {Array<String>}
	usertypes = [];
	access = access_type.read;
}


/// @desc Sets up general schemas, and runs project-specific schema setup
function bschema_project_setup() {
	if is_defined(BSCHEMA.project_setup) {
		BSCHEMA.project_setup();
	}
}

#macro bschema_tally_schema_mote_ids "schema_mote_ids"
#macro bschema_tally_schema_wip_mote_ids "schema_wip_mote_ids"

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

/// @param {Any} claim
/// @param {String} message
function assert(claim, message){
	if(!claim){
		throw(message);
	}
}

/// @param {Any} value
function is_defined(value){
	return !is_undefined(value);
}

enum access_type {
	read,
	readwrite,
	crud,
}
