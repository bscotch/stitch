audio_falloff_set_model(audio_falloff_linear_distance_clamped);
audio_listener_orientation(0,1,0,0,0,1);

babblers = {};

function _update_babblers() {
	var babbler_ids = struct_get_names(babblers);
	var _listener = listener;
	
	for ( var b = 0; b < array_length(babbler_ids); b++){
		var this_babbler_earparty_id = babbler_ids[b];
		
		with babblers[$ this_babbler_earparty_id] {
			if (!earparty_clip_is_playing(clip)) {
				earparty_babbler_stop(this_babbler_earparty_id);
			}
			else {
				var curdist = 5000;
				
				for ( var i = array_length(instances)-1; i >= 0; i--) {
					var inst = instances[i];
					
					if instance_exists(inst) {
						curdist = min(curdist, point_distance(_listener.x, _listener.y, inst.x, inst.y));
					}
					else {
						array_delete(instances, i, 1);
					}
				}
				
				if array_empty(instances) {
					earparty_babbler_stop(this_babbler_earparty_id);
				}
				else if (earparty_clip_is_playing(clip)) {
					var falloff_min_max_spread	= falloff_max-falloff_min;
					var distance_from_min		= curdist-falloff_min;
					var new_gain				= clamp(1-distance_from_min/falloff_min_max_spread, 0, 1);
					earparty_clip_set_gain_mod(clip, new_gain);
				}
			}
		}
	}
}

queued_clips	= ds_list_create();
//positional_sounds	= {};

listener = { x : 0, y : 0 }

update_listener_position = function() {
	listener.x = view_center_x();
	listener.y = view_center_y();
	audio_listener_position(listener.x, listener.y, EARPARTY_AUDIO_POSITION_Z);
}

if instance_number(o_earparty) > 1 {
	show_error("There can be only one Ear Party.", true);	
}