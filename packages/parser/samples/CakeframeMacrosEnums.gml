enum cf_style				{ content=-1, fill=0, proportional=1, fixed=2 };
enum cf_bounds				{ lowest=0, highest};
enum cf_padding				{ interior=0, exterior };
enum cf_dimensions			{ x=0, y };
enum cf_size				{ content=-1, fill=0 }
enum cf_arrangement_type	{ row=0, column=1 }
enum cf_type				{ cell=0, attachment=1, root=2, /* Deprecated beyond here--remove after refactor*/ row, column}
enum cf_input_mode			{ kbm, gamepad, touch }

#macro cf_seconds CAKEFRAMES.total_seconds
#macro cf_delta_seconds CAKEFRAMES.seconds_delta
#macro cf_frame_number CAKEFRAMES.frame_number

#macro cf_event_input_mode_change "input_mode_change"
#macro cf_event_input_rebind "input_rebind"

#macro cf_event_step "step"
function _cf_event_name(_event_name_parts) {
	array_delete_element(_event_name_parts, undefined);
	return array_join(_event_name_parts, "_");
}
function cf_event_input_press(input_id=undefined, player_id=undefined) {	return _cf_event_name(["input_press", input_id, player_id]) };
function cf_event_input_hold(input_id=undefined, player_id=undefined) {		return _cf_event_name(["input_hold", input_id, player_id]) };
function cf_event_input_release(input_id=undefined, player_id=undefined) {	return _cf_event_name(["input_release", input_id, player_id]) };
function cf_event_cursor_press(player_id=undefined, touch_id=undefined)	{	return _cf_event_name(["cursor_press", player_id, touch_id]) }
function cf_event_cursor_release(player_id=undefined, touch_id=undefined) { return _cf_event_name(["cursor_release", player_id, touch_id]) }
function cf_event_cursor_hold(player_id=undefined, touch_id=undefined)	{	return _cf_event_name(["cursor_hold", player_id, touch_id]) }

#macro cf_align_topleft		[fa_left,	fa_top]
#macro cf_align_left		[fa_left,	fa_middle]
#macro cf_align_bottomleft	[fa_left,	fa_bottom]
#macro cf_align_top			[fa_center, fa_top]
#macro cf_align_center		[fa_center, fa_middle]
#macro cf_align_bottom		[fa_center, fa_bottom]
#macro cf_align_topright	[fa_right,	fa_top]
#macro cf_align_right		[fa_right,	fa_middle]
#macro cf_align_bottomright	[fa_right,	fa_bottom]

#macro cf_frame_topleft		[0,	0]
#macro cf_frame_left		[0,	.5]
#macro cf_frame_bottomleft	[0,	1]
#macro cf_frame_top			[.5, 0]
#macro cf_frame_center		[.5, .5]
#macro cf_frame_bottom		[.5, 1]
#macro cf_frame_topright	[1,	0]
#macro cf_frame_right		[1,	.5]
#macro cf_frame_bottomright	[1,	1]

#macro cf_row "row"
#macro cf_column "column"

#macro cf_box_edge		"edge"
#macro cf_box_canvas	"canvas"

