//#region SHIMS

declare type struct = Record<string, any>;
declare type int = number;
declare type ds_list<T> = { _: T[] };
declare type ds_map<K extends string, V> = { _: Record<K, V> };

declare class GmlObject {
  /** This read-only variable holds the unique identifying number for the instance. Every instance that you create is given a number that is used internally to identify this instance and this variable is what you can use to reference it. The id is also returned (and can be stored in a variable) when an instance is created using instance_create_layer.
   */
  public readonly id: number;
  /** This read only variable returns the index of the object that the instance has been created from. This is not the same as the object name, which is a string and can be found using object_get_name, as this function returns the index number, which is a unique value that GameMaker Studio 2 assigns to every object at the time of creation. */
  public readonly object_index: number;
  public x: number;
  public y: number;
  public xprevious: number;
  public yprevious: number;
  public xstart: number;
  public ystart: number;
  public hspeed: number;
  public vspeed: number;
  public direction: number;
  public speed: number;
  public friction: number;
  public gravity: number;
  public gravity_direction: number;
  public readonly path_index: paths;
  public path_position: number;
  public path_positionprevious: number;
  public path_speed: number;
  public path_scale: number;
  public path_orientation: number;
  public path_endaction:
    | typeof path_action_stop
    | typeof path_action_restart
    | typeof path_action_continue
    | typeof path_action_reverse;
  public solid: bool;
  public persistent: bool;
  public mask_index: sprite;
  /**
   * The number of active instances of this type in the room.
   */
  public get instance_count(): int;
  /** This read only array holds all the ids of every active instance within the room. This means that if you have used any of the Instance Deactivate functions those instances that have been deactivated will not be included in this array (if you have used a value from this array previously, it will now return the keyword noone). */
  public readonly instance_id: number[];

  public visible: bool;
  public sprite_index: sprite;
  public readonly sprite_width: int;
  public readonly sprite_height: int;
  public readonly sprite_xoffset: number;
  public readonly sprite_yoffset: number;
  public readonly image_number: int;
  public image_index: number;
  public image_speed: number;
  public depth: number;
  public image_xscale: number;
  public image_yscale: number;
  public image_angle: number;
  public image_alpha: number;
  public image_blend: number;
  public readonly bbox_left: number;
  public readonly bbox_right: number;
  public readonly bbox_top: number;
  public readonly bbox_bottom: number;

  public readonly alarm: ((this: instance) => void)[];
  public timeline_index: timeline;
  public timeline_position: number;
  public timeline_speed: number;
  public timeline_running: bool;
  public timeline_loop: bool;

  public phy_rotation: number;
  public phy_position_x: number;
  public phy_position_y: number;
  public phy_angular_velocity: number;
  public phy_linear_velocity_x: number;
  public phy_linear_velocity_y: number;
  public phy_speed_x: number;
  public phy_speed_y: number;
  public readonly phy_speed: number;
  public phy_angular_damping: number;
  public phy_linear_damping: number;
  public phy_bullet: bool;
  public phy_fixed_rotation: bool;
  public phy_active: bool;
  public readonly phy_mass: number;
  public readonly phy_inertia: number;
  public readonly phy_com_x: number;
  public readonly phy_com_y: number;
  public readonly phy_dynamic: bool;
  public readonly phy_kinematic: bool;
  public readonly phy_sleeping: bool;
  public readonly phy_collision_points: int;
  public readonly phy_collision_x: number[];
  public readonly phy_collision_y: number[];
  public readonly phy_col_normal_x: number[];
  public readonly phy_col_normal_y: number[];
  public readonly phy_position_xprevious: number;
  public readonly phy_position_yprevious: number;
}

declare type objects = typeof GmlObject;
declare type instance = GmlObject;

////#endregion

//#region BASE TYPES

declare type fonts = unknown;
declare type paths = unknown;
declare type rooms = unknown;
declare type scripts = unknown;
declare type sequences = unknown;
declare type shaders = unknown;
declare type sounds = unknown;
declare type sprites = unknown;
declare type tilesets = unknown;
declare type timelines = unknown;

declare type weak_reference = unknown;
declare type asset_type =
  | typeof asset_sequence
  | typeof asset_animationcurve
  | typeof asset_tiles
  | typeof asset_object
  | typeof asset_unknown
  | typeof asset_sprite
  | typeof asset_sound
  | typeof asset_room
  | typeof asset_path
  | typeof asset_script
  | typeof asset_font
  | typeof asset_timeline
  | typeof asset_shader;
declare type network_type =
  | typeof network_socket_ws
  | typeof network_socket_tcp
  | typeof network_socket_udp
  | typeof network_socket_bluetooth;
declare type network_config =
  | typeof network_config_avoid_time_wait
  | typeof network_config_connect_timeout
  | typeof network_config_use_non_blocking_socket
  | typeof network_config_enable_reliable_udp
  | typeof network_config_disable_reliable_udp;
declare type buffer = unknown;
declare type surface = typeof application_surface | typeof view_surface_id;
declare type asset = unknown;
declare type layer_sequence = unknown;
declare type layer = unknown;
declare type gamespeed_type =
  | typeof gamespeed_fps
  | typeof gamespeed_microseconds;
declare type bbox_mode =
  | typeof bboxmode_automatic
  | typeof bboxmode_fullimage
  | typeof bboxmode_manual;
declare type bbox_kind =
  | typeof bboxkind_precise
  | typeof bboxkind_rectangular
  | typeof bboxkind_ellipse
  | typeof bboxkind_diamond;
declare type gif = unknown;
declare type camera = typeof view_camera;
declare type sprite_speed_type =
  | typeof spritespeed_framespersecond
  | typeof spritespeed_framespergameframe;
declare type texture_group = unknown;
declare type display_timing_method = typeof tm_sleep | typeof tm_countvsyncs;
declare type draw_lighttype = typeof lighttype_dir | typeof lighttype_point;
declare type gpu_cmpfunc =
  | typeof cmpfunc_never
  | typeof cmpfunc_less
  | typeof cmpfunc_equal
  | typeof cmpfunc_lessequal
  | typeof cmpfunc_greater
  | typeof cmpfunc_notequal
  | typeof cmpfunc_greaterequal
  | typeof cmpfunc_always;
declare type gpu_cullmode =
  | typeof cull_noculling
  | typeof cull_clockwise
  | typeof cull_counterclockwise;
declare type blendmode =
  | typeof bm_normal
  | typeof bm_add
  | typeof bm_max
  | typeof bm_subtract;
declare type blendmode_ext =
  | typeof bm_zero
  | typeof bm_one
  | typeof bm_src_colour
  | typeof bm_inv_src_colour
  | typeof bm_src_color
  | typeof bm_inv_src_color
  | typeof bm_src_alpha
  | typeof bm_inv_src_alpha
  | typeof bm_dest_alpha
  | typeof bm_inv_dest_alpha
  | typeof bm_dest_colour
  | typeof bm_inv_dest_colour
  | typeof bm_dest_color
  | typeof bm_inv_dest_color
  | typeof bm_src_alpha_sat;
declare type shader_sampler = unknown;
declare type texture_mip_filter =
  | typeof tf_point
  | typeof tf_linear
  | typeof tf_anisotropic;
declare type texture_mip_state =
  | typeof mip_off
  | typeof mip_on
  | typeof mip_markedonly;
declare type layer_element = unknown;
declare type layer_element_type =
  | typeof layerelementtype_undefined
  | typeof layerelementtype_background
  | typeof layerelementtype_instance
  | typeof layerelementtype_oldtilemap
  | typeof layerelementtype_sprite
  | typeof layerelementtype_tilemap
  | typeof layerelementtype_particlesystem
  | typeof layerelementtype_tile
  | typeof layerelementtype_sequence;
declare type layer_background = unknown;
declare type layer_sprite = unknown;
declare type layer_tile_legacy = unknown;
declare type layer_instance = unknown;
declare type layer_tilemap = unknown;
declare type tilemap_data =
  | typeof tile_rotate
  | typeof tile_flip
  | typeof tile_mirror
  | typeof tile_index_mask;
declare type virtual_keyboard_type =
  | typeof kbv_type_default
  | typeof kbv_type_ascii
  | typeof kbv_type_url
  | typeof kbv_type_email
  | typeof kbv_type_numbers
  | typeof kbv_type_phone
  | typeof kbv_type_phone_name;
declare type virtual_keyboard_return_key =
  | typeof kbv_returnkey_default
  | typeof kbv_returnkey_go
  | typeof kbv_returnkey_google
  | typeof kbv_returnkey_join
  | typeof kbv_returnkey_next
  | typeof kbv_returnkey_route
  | typeof kbv_returnkey_search
  | typeof kbv_returnkey_send
  | typeof kbv_returnkey_yahoo
  | typeof kbv_returnkey_done
  | typeof kbv_returnkey_continue
  | typeof kbv_returnkey_emergency;
declare type virtual_keyboard_autocapitalization =
  | typeof kbv_autocapitalize_none
  | typeof kbv_autocapitalize_words
  | typeof kbv_autocapitalize_sentences
  | typeof kbv_autocapitalize_characters;
declare type pointer = typeof pointer_invalid | typeof pointer_null;
declare type datetime = typeof GM_build_date;
declare type timezone_type = typeof timezone_local | typeof timezone_utc;
declare type mp_grid = unknown;
declare type ds_grid = unknown;
declare type event_type =
  | typeof ev_create
  | typeof ev_destroy
  | typeof ev_step
  | typeof ev_alarm
  | typeof ev_keyboard
  | typeof ev_mouse
  | typeof ev_collision
  | typeof ev_other
  | typeof ev_draw
  | typeof ev_keypress
  | typeof ev_keyrelease
  | typeof ev_cleanup
  | typeof ev_gesture;
declare const event_number:
  | typeof ev_draw_begin
  | typeof ev_draw_end
  | typeof ev_draw_pre
  | typeof ev_draw_post
  | typeof ev_left_button
  | typeof ev_right_button
  | typeof ev_middle_button
  | typeof ev_no_button
  | typeof ev_left_press
  | typeof ev_right_press
  | typeof ev_middle_press
  | typeof ev_left_release
  | typeof ev_right_release
  | typeof ev_middle_release
  | typeof ev_mouse_enter
  | typeof ev_mouse_leave
  | typeof ev_mouse_wheel_up
  | typeof ev_mouse_wheel_down
  | typeof ev_global_left_button
  | typeof ev_global_right_button
  | typeof ev_global_middle_button
  | typeof ev_global_left_press
  | typeof ev_global_right_press
  | typeof ev_global_middle_press
  | typeof ev_global_left_release
  | typeof ev_global_right_release
  | typeof ev_global_middle_release
  | typeof ev_joystick1_left
  | typeof ev_joystick1_right
  | typeof ev_joystick1_up
  | typeof ev_joystick1_down
  | typeof ev_joystick1_button1
  | typeof ev_joystick1_button2
  | typeof ev_joystick1_button3
  | typeof ev_joystick1_button4
  | typeof ev_joystick1_button5
  | typeof ev_joystick1_button6
  | typeof ev_joystick1_button7
  | typeof ev_joystick1_button8
  | typeof ev_joystick2_left
  | typeof ev_joystick2_right
  | typeof ev_joystick2_up
  | typeof ev_joystick2_down
  | typeof ev_joystick2_button1
  | typeof ev_joystick2_button2
  | typeof ev_joystick2_button3
  | typeof ev_joystick2_button4
  | typeof ev_joystick2_button5
  | typeof ev_joystick2_button6
  | typeof ev_joystick2_button7
  | typeof ev_joystick2_button8
  | typeof ev_outside
  | typeof ev_boundary
  | typeof ev_game_start
  | typeof ev_game_end
  | typeof ev_room_start
  | typeof ev_room_end
  | typeof ev_no_more_lives
  | typeof ev_animation_end
  | typeof ev_end_of_path
  | typeof ev_no_more_health
  | typeof ev_user0
  | typeof ev_user1
  | typeof ev_user2
  | typeof ev_user3
  | typeof ev_user4
  | typeof ev_user5
  | typeof ev_user6
  | typeof ev_user7
  | typeof ev_user8
  | typeof ev_user9
  | typeof ev_user10
  | typeof ev_user11
  | typeof ev_user12
  | typeof ev_user13
  | typeof ev_user14
  | typeof ev_user15
  | typeof ev_outside_view0
  | typeof ev_outside_view1
  | typeof ev_outside_view2
  | typeof ev_outside_view3
  | typeof ev_outside_view4
  | typeof ev_outside_view5
  | typeof ev_outside_view6
  | typeof ev_outside_view7
  | typeof ev_boundary_view0
  | typeof ev_boundary_view1
  | typeof ev_boundary_view2
  | typeof ev_boundary_view3
  | typeof ev_boundary_view4
  | typeof ev_boundary_view5
  | typeof ev_boundary_view6
  | typeof ev_boundary_view7
  | typeof ev_animation_update
  | typeof ev_animation_event
  | typeof ev_web_image_load
  | typeof ev_web_sound_load
  | typeof ev_web_async
  | typeof ev_dialog_async
  | typeof ev_web_iap
  | typeof ev_web_cloud
  | typeof ev_web_networking
  | typeof ev_web_steam
  | typeof ev_social
  | typeof ev_push_notification
  | typeof ev_async_save_load
  | typeof ev_audio_recording
  | typeof ev_audio_playback
  | typeof ev_system_event
  | typeof ev_broadcast_message
  | typeof ev_step_normal
  | typeof ev_step_begin
  | typeof ev_step_end
  | typeof ev_gui
  | typeof ev_gui_begin
  | typeof ev_gui_end
  | typeof ev_gesture_tap
  | typeof ev_gesture_double_tap
  | typeof ev_gesture_drag_start
  | typeof ev_gesture_dragging
  | typeof ev_gesture_drag_end
  | typeof ev_gesture_flick
  | typeof ev_gesture_pinch_start
  | typeof ev_gesture_pinch_in
  | typeof ev_gesture_pinch_out
  | typeof ev_gesture_pinch_end
  | typeof ev_gesture_rotate_start
  | typeof ev_gesture_rotating
  | typeof ev_gesture_rotate_end
  | typeof ev_global_gesture_tap
  | typeof ev_global_gesture_double_tap
  | typeof ev_global_gesture_drag_start
  | typeof ev_global_gesture_dragging
  | typeof ev_global_gesture_drag_end
  | typeof ev_global_gesture_flick
  | typeof ev_global_gesture_pinch_start
  | typeof ev_global_gesture_pinch_in
  | typeof ev_global_gesture_pinch_out
  | typeof ev_global_gesture_pinch_end
  | typeof ev_global_gesture_rotate_start
  | typeof ev_global_gesture_rotating
  | typeof ev_global_gesture_rotate_end;
declare const mouse_button:
  | typeof mouse_lastbutton
  | typeof mb_any
  | typeof mb_none
  | typeof mb_left
  | typeof mb_right
  | typeof mb_middle;
declare type horizontal_alignment =
  | typeof fa_left
  | typeof fa_center
  | typeof fa_right;
declare type vertical_alignment =
  | typeof fa_top
  | typeof fa_middle
  | typeof fa_bottom;
declare type primitive_type =
  | typeof pr_pointlist
  | typeof pr_linelist
  | typeof pr_linestrip
  | typeof pr_trianglelist
  | typeof pr_trianglestrip
  | typeof pr_trianglefan;
declare type texture = unknown;
declare type audio_falloff_model =
  | typeof audio_falloff_none
  | typeof audio_falloff_inverse_distance
  | typeof audio_falloff_inverse_distance_clamped
  | typeof audio_falloff_linear_distance
  | typeof audio_falloff_linear_distance_clamped
  | typeof audio_falloff_exponent_distance
  | typeof audio_falloff_exponent_distance_clamped;
declare type audio_sound_channel =
  | typeof audio_mono
  | typeof audio_stereo
  | typeof audio_3d;
declare type display_orientation =
  | typeof display_landscape
  | typeof display_landscape_flipped
  | typeof display_portrait
  | typeof display_portrait_flipped;
declare type window_cursor =
  | typeof cr_default
  | typeof cr_none
  | typeof cr_arrow
  | typeof cr_cross
  | typeof cr_beam
  | typeof cr_size_nesw
  | typeof cr_size_ns
  | typeof cr_size_nwse
  | typeof cr_size_we
  | typeof cr_uparrow
  | typeof cr_hourglass
  | typeof cr_drag
  | typeof cr_appstart
  | typeof cr_handpoint
  | typeof cr_size_all;
declare type audio_emitter = unknown;
declare type sound_instance = unknown;
declare type sound_sync_group = unknown;
declare type audio_group = unknown;
declare type buffer_type =
  | typeof buffer_u8
  | typeof buffer_s8
  | typeof buffer_u16
  | typeof buffer_s16
  | typeof buffer_u32
  | typeof buffer_s32
  | typeof buffer_u64
  | typeof buffer_f16
  | typeof buffer_f32
  | typeof buffer_f64
  | typeof buffer_bool
  | typeof buffer_text
  | typeof buffer_string;
declare type sound_play_queue = unknown;
declare type html_clickable_tpe = unknown;
declare type html_clickable = unknown;
declare type file_handle = unknown;
declare type file_attribute =
  | typeof fa_readonly
  | typeof fa_hidden
  | typeof fa_sysfile
  | typeof fa_volumeid
  | typeof fa_directory
  | typeof fa_archive;
declare type binary_file_handle = unknown;
declare type ds_type =
  | typeof ds_type_map
  | typeof ds_type_list
  | typeof ds_type_stack
  | typeof ds_type_queue
  | typeof ds_type_grid
  | typeof ds_type_priority;
declare type ds_stack = unknown;
declare type ds_queue = unknown;
declare type ds_priority = unknown;
declare type effect_kind =
  | typeof ef_explosion
  | typeof ef_ring
  | typeof ef_ellipse
  | typeof ef_firework
  | typeof ef_smoke
  | typeof ef_smokeup
  | typeof ef_star
  | typeof ef_spark
  | typeof ef_flare
  | typeof ef_cloud
  | typeof ef_rain
  | typeof ef_snow;
declare type particle = unknown;
declare type particle_shape =
  | typeof pt_shape_pixel
  | typeof pt_shape_disk
  | typeof pt_shape_square
  | typeof pt_shape_line
  | typeof pt_shape_star
  | typeof pt_shape_circle
  | typeof pt_shape_ring
  | typeof pt_shape_sphere
  | typeof pt_shape_flare
  | typeof pt_shape_spark
  | typeof pt_shape_explosion
  | typeof pt_shape_cloud
  | typeof pt_shape_smoke
  | typeof pt_shape_snow;
declare type particle_system = unknown;
declare type particle_emitter = unknown;
declare type particle_region_shape =
  | typeof ps_shape_rectangle
  | typeof ps_shape_ellipse
  | typeof ps_shape_diamond
  | typeof ps_shape_line;
declare type particle_distribution =
  | typeof ps_distr_linear
  | typeof ps_distr_gaussian
  | typeof ps_distr_invgaussian;
declare type external_call_type = typeof dll_cdecl | typeof dll_stdcall;
declare type external_value_type = typeof ty_real | typeof ty_string;
declare type external_function = unknown;
declare type matrix_type =
  | typeof matrix_view
  | typeof matrix_projection
  | typeof matrix_world;
declare const os_type:
  | typeof os_windows
  | typeof os_macosx
  | typeof os_ios
  | typeof os_android
  | typeof os_linux
  | typeof os_unknown
  | typeof os_winphone
  | typeof os_win8native
  | typeof os_psvita
  | typeof os_xboxone
  | typeof os_uwp
  | typeof os_tvos
  | typeof os_switch;
declare type device_type =
  | typeof os_device
  | typeof device_ios_unknown
  | typeof device_ios_iphone
  | typeof device_ios_iphone_retina
  | typeof device_ios_ipad
  | typeof device_ios_ipad_retina
  | typeof device_ios_iphone5
  | typeof device_ios_iphone6
  | typeof device_ios_iphone6plus
  | typeof device_emulator
  | typeof device_tablet;
declare type browser_type =
  | typeof os_browser
  | typeof browser_not_a_browser
  | typeof browser_unknown
  | typeof browser_ie
  | typeof browser_firefox
  | typeof browser_chrome
  | typeof browser_safari
  | typeof browser_safari_mobile
  | typeof browser_opera
  | typeof browser_tizen
  | typeof browser_edge
  | typeof browser_windows_store
  | typeof browser_ie_mobile;
declare type android_permission_state =
  | typeof os_permission_denied_dont_request
  | typeof os_permission_denied
  | typeof os_permission_granted;
declare type virtual_key = unknown;
declare type achievement_leaderboard_filter =
  | typeof achievement_filter_all_players
  | typeof achievement_filter_friends_only
  | typeof achievement_filter_favorites_only;
declare type achievement_challenge_type =
  | typeof achievement_type_achievement_challenge
  | typeof achievement_type_score_challenge;
declare type achievement_show_type =
  | typeof achievement_show_ui
  | typeof achievement_show_profile
  | typeof achievement_show_leaderboard
  | typeof achievement_show_achievement
  | typeof achievement_show_bank
  | typeof achievement_show_friend_picker
  | typeof achievement_show_purchase_prompt;
declare type achievement_async_id =
  | typeof achievement_our_info
  | typeof achievement_friends_info
  | typeof achievement_leaderboard_info
  | typeof achievement_achievement_info
  | typeof achievement_pic_loaded;
declare type iap_async_id =
  | typeof iap_data
  | typeof iap_ev_storeload
  | typeof iap_ev_product
  | typeof iap_ev_purchase
  | typeof iap_ev_consume
  | typeof iap_ev_restore;
declare type iap_async_storeload =
  | typeof iap_storeload_ok
  | typeof iap_storeload_failed;
declare type iap_system_status =
  | typeof iap_status_uninitialised
  | typeof iap_status_unavailable
  | typeof iap_status_loading
  | typeof iap_status_available
  | typeof iap_status_processing
  | typeof iap_status_restoring;
declare type iap_order_status =
  | typeof iap_failed
  | typeof iap_unavailable
  | typeof iap_available
  | typeof iap_purchased
  | typeof iap_canceled
  | typeof iap_refunded;
declare type gamepad_button =
  | typeof gp_face1
  | typeof gp_face2
  | typeof gp_face3
  | typeof gp_face4
  | typeof gp_shoulderl
  | typeof gp_shoulderr
  | typeof gp_shoulderlb
  | typeof gp_shoulderrb
  | typeof gp_select
  | typeof gp_start
  | typeof gp_stickl
  | typeof gp_stickr
  | typeof gp_padu
  | typeof gp_padd
  | typeof gp_padl
  | typeof gp_padr
  | typeof gp_axislh
  | typeof gp_axislv
  | typeof gp_axisrh
  | typeof gp_axisrv;
declare type physics_debug_flag =
  | typeof phy_debug_render_aabb
  | typeof phy_debug_render_collision_pairs
  | typeof phy_debug_render_coms
  | typeof phy_debug_render_core_shapes
  | typeof phy_debug_render_joints
  | typeof phy_debug_render_obb
  | typeof phy_debug_render_shapes;
declare type physics_fixture = unknown;
declare type physics_joint = unknown;
declare type physics_joint_value =
  | typeof phy_joint_anchor_1_x
  | typeof phy_joint_anchor_1_y
  | typeof phy_joint_anchor_2_x
  | typeof phy_joint_anchor_2_y
  | typeof phy_joint_reaction_force_x
  | typeof phy_joint_reaction_force_y
  | typeof phy_joint_reaction_torque
  | typeof phy_joint_motor_speed
  | typeof phy_joint_angle
  | typeof phy_joint_motor_torque
  | typeof phy_joint_max_motor_torque
  | typeof phy_joint_translation
  | typeof phy_joint_speed
  | typeof phy_joint_motor_force
  | typeof phy_joint_max_motor_force
  | typeof phy_joint_length_1
  | typeof phy_joint_length_2
  | typeof phy_joint_damping_ratio
  | typeof phy_joint_frequency
  | typeof phy_joint_lower_angle_limit
  | typeof phy_joint_upper_angle_limit
  | typeof phy_joint_angle_limits
  | typeof phy_joint_max_length
  | typeof phy_joint_max_torque
  | typeof phy_joint_max_force;
declare type physics_particle_flag =
  | typeof phy_particle_flag_water
  | typeof phy_particle_flag_zombie
  | typeof phy_particle_flag_wall
  | typeof phy_particle_flag_spring
  | typeof phy_particle_flag_elastic
  | typeof phy_particle_flag_viscous
  | typeof phy_particle_flag_powder
  | typeof phy_particle_flag_tensile
  | typeof phy_particle_flag_colourmixing
  | typeof phy_particle_flag_colormixing;
declare type physics_particle = unknown;
declare type physics_particle_data_flag =
  | typeof phy_particle_data_flag_typeflags
  | typeof phy_particle_data_flag_position
  | typeof phy_particle_data_flag_velocity
  | typeof phy_particle_data_flag_colour
  | typeof phy_particle_data_flag_color
  | typeof phy_particle_data_flag_category;
declare type physics_particle_group_flag =
  | typeof phy_particle_group_flag_solid
  | typeof phy_particle_group_flag_rigid;
declare type physics_particle_group = unknown;
declare type network_socket = unknown;
declare type network_server = unknown;
declare type network_async_id =
  | typeof network_type_connect
  | typeof network_type_disconnect
  | typeof network_type_data
  | typeof network_type_non_blocking_connect;
declare type buffer_kind =
  | typeof buffer_fixed
  | typeof buffer_grow
  | typeof buffer_wrap
  | typeof buffer_fast
  | typeof buffer_vbuffer;
declare type buffer_auto_type = unknown;
declare type buffer_seek_base =
  | typeof buffer_seek_start
  | typeof buffer_seek_relative
  | typeof buffer_seek_end;
declare type vertex_buffer = unknown;
declare type steam_overlay_page =
  | typeof ov_friends
  | typeof ov_community
  | typeof ov_players
  | typeof ov_settings
  | typeof ov_gamegroup
  | typeof ov_achievements;
declare type steam_leaderboard_sort_type =
  | typeof lb_sort_none
  | typeof lb_sort_ascending
  | typeof lb_sort_descending;
declare type steam_leaderboard_display_type =
  | typeof lb_disp_none
  | typeof lb_disp_numeric
  | typeof lb_disp_time_sec
  | typeof lb_disp_time_ms;
declare type steam_id = unknown;
declare type steam_ugc = unknown;
declare type steam_ugc_type =
  | typeof ugc_filetype_community
  | typeof ugc_filetype_microtrans;
declare type steam_ugc_visibility =
  | typeof ugc_visibility_public
  | typeof ugc_visibility_friends_only
  | typeof ugc_visibility_private;
declare type steam_ugc_query_list_type =
  | typeof ugc_list_Published
  | typeof ugc_list_VotedOn
  | typeof ugc_list_VotedUp
  | typeof ugc_list_VotedDown
  | typeof ugc_list_WillVoteLater
  | typeof ugc_list_Favorited
  | typeof ugc_list_Subscribed
  | typeof ugc_list_UsedOrPlayed
  | typeof ugc_list_Followed;
declare type steam_ugc_query_match_type =
  | typeof ugc_match_Items
  | typeof ugc_match_Items_Mtx
  | typeof ugc_match_Items_ReadyToUse
  | typeof ugc_match_Collections
  | typeof ugc_match_Artwork
  | typeof ugc_match_Videos
  | typeof ugc_match_Screenshots
  | typeof ugc_match_AllGuides
  | typeof ugc_match_WebGuides
  | typeof ugc_match_IntegratedGuides
  | typeof ugc_match_UsableInGame
  | typeof ugc_match_ControllerBindings;
declare type steam_ugc_query_sort_order =
  | typeof ugc_sortorder_CreationOrderDesc
  | typeof ugc_sortorder_CreationOrderAsc
  | typeof ugc_sortorder_TitleAsc
  | typeof ugc_sortorder_LastUpdatedDesc
  | typeof ugc_sortorder_SubscriptionDateDesc
  | typeof ugc_sortorder_VoteScoreDesc
  | typeof ugc_sortorder_ForModeration;
declare type steam_ugc_query_type =
  | typeof ugc_query_RankedByVote
  | typeof ugc_query_RankedByPublicationDate
  | typeof ugc_query_AcceptedForGameRankedByAcceptanceDate
  | typeof ugc_query_RankedByTrend
  | typeof ugc_query_FavoritedByFriendsRankedByPublicationDate
  | typeof ugc_query_CreatedByFriendsRankedByPublicationDate
  | typeof ugc_query_RankedByNumTimesReported
  | typeof ugc_query_CreatedByFollowedUsersRankedByPublicationDate
  | typeof ugc_query_NotYetRated
  | typeof ugc_query_RankedByTotalVotesAsc
  | typeof ugc_query_RankedByVotesUp
  | typeof ugc_query_RankedByTextSearch;
declare type steam_ugc_query = unknown;
declare type steam_ugc_async_result = typeof ugc_result_success;
declare type shader_uniform = unknown;
declare type vertex_format = unknown;
declare type vertex_type =
  | typeof vertex_type_float1
  | typeof vertex_type_float2
  | typeof vertex_type_float3
  | typeof vertex_type_float4
  | typeof vertex_type_colour
  | typeof vertex_type_color
  | typeof vertex_type_ubyte4;
declare type vertex_usage =
  | typeof vertex_usage_position
  | typeof vertex_usage_colour
  | typeof vertex_usage_color
  | typeof vertex_usage_normal
  | typeof vertex_usage_texcoord
  | typeof vertex_usage_blendweight
  | typeof vertex_usage_blendindices
  | typeof vertex_usage_psize
  | typeof vertex_usage_tangent
  | typeof vertex_usage_binormal
  | typeof vertex_usage_fog
  | typeof vertex_usage_depth
  | typeof vertex_usage_sample;
//#endregion

//#region VARIABLE TYPES

declare let mask_index: sprites;
declare let cursor_sprite: sprites;
declare let sprite_index: sprites;
declare let timeline_index: timelines;
declare let room_first: rooms;
declare let room_last: rooms;
//#endregion

//#region FUNCTION TYPES

declare function is_struct(val: any): bool;
declare function is_method(val: any): bool;
declare function exception_unhandled_handler(
  user_handler: (arg0: Exception, arg1: any | void) => any,
): any;
declare function variable_struct_exists<T extends struct>(
  struct: T,
  name: string,
): bool;
declare function variable_struct_get<T extends struct>(
  struct: T,
  name: string,
): any;
declare function variable_struct_set<T extends struct>(
  struct: T,
  name: string,
  val: any,
): void;
declare function variable_struct_get_names<T extends struct>(
  struct: T,
): string[];
declare function variable_struct_names_count<T extends struct>(struct: T): int;
declare function variable_struct_remove<T extends struct>(
  struct: T,
  name: string,
): void;
declare function array_length<T extends any>(variable: T[]): int;
declare function array_resize<T extends any>(variable: T[], newsize: int): void;
declare function array_push<T extends any>(array: T[], ...values: T[]): void;
declare function array_pop<T extends any>(array: T[]): T;
declare function array_insert<T extends any>(
  array: T[],
  index: int,
  ...values: T[]
): void;
declare function array_delete<T extends any>(
  array: T[],
  index: int,
  number: int,
): void;
declare function array_sort<T extends any>(
  array: T[],
  sortType_or_function: bool | ((arg0: T, arg1: T, arg2: int) => any),
): void;
declare function weak_ref_create<T extends struct>(
  thing_to_track: T,
): weak_reference;
declare function weak_ref_alive(weak_ref: weak_reference): bool;
declare function weak_ref_any_alive(
  array: weak_reference[],
  index?: int,
  length?: int,
): bool;
declare function method<T extends function>(
  context: instance | struct | undefined,
  func: T,
): T;
declare function method_get_index(method: any): any;
declare function method_get_self(method: any): any;
declare function string_pos_ext(
  substr: string,
  str: string,
  startpos: int,
): int;
declare function string_last_pos(substr: string, str: string): int;
declare function string_last_pos_ext(
  substr: string,
  str: string,
  startpos: int,
): int;
declare function debug_get_callstack(maxDepth?: int): string[];
declare function script_execute_ext(
  ind: scripts,
  args: any[],
  offset: int = 0,
  num_args: int = args_length - offset,
): any;
declare function ds_list_is_map<T extends any>(
  list: ds_list<T>,
  pos: int,
): bool;
declare function ds_list_is_list<T extends any>(
  list: ds_list<T>,
  pos: int,
): bool;
declare function ds_map_values_to_array<K, V extends any>(
  map: ds_map<K, V>,
  arg1?: K[],
): K[];
declare function ds_map_keys_to_array<K, V extends any>(
  map: ds_map<K, V>,
  arg1?: V[],
): V[];
declare function ds_map_is_map<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
): bool;
declare function ds_map_is_list<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
): bool;
declare function json_stringify<
  T extends struct | Array | number | string | undefined,
>(val: T): string;
declare function json_parse(json: string): any;
declare function buffer_get_surface(
  buffer: buffer,
  surface: surface,
  offset: int,
): void;
declare function buffer_set_surface(
  buffer: buffer,
  surface: surface,
  offset: int,
): void;
declare function tag_get_asset_ids(
  tags: string | string[],
  asset_type: asset_type,
): asset[];
declare function tag_get_assets(tags: string | string[]): string[];
declare function asset_get_tags(
  asset_name_or_id: string | asset,
  asset_type?: asset_type,
): string[];
declare function asset_add_tags(
  asset_name_or_id: string | asset,
  tags: string | string[],
  asset_type?: asset_type,
): bool;
declare function asset_remove_tags(
  asset_name_or_id: string | asset,
  tags: string | string[],
  asset_type?: asset_type,
): bool;
declare function asset_has_tags(
  asset_name_or_id: string | asset,
  tags: string | string[],
  asset_type?: asset_type,
): bool;
declare function asset_has_any_tag(
  asset_name_or_id: string | asset,
  tags: string | string[],
  asset_type?: asset_type,
): bool;
declare function asset_clear_tags(
  asset_name_or_id: string | asset,
  asset_type?: asset_type,
): bool;
declare function layer_sequence_get_instance(
  sequence_element_id: layer_sequence,
): any;
declare function layer_sequence_create(
  layer_id: layer | string,
  x: number,
  y: number,
  sequence_id: sequences,
): layer_sequence;
declare function layer_sequence_destroy(
  sequence_element_id: layer_sequence,
): void;
declare function layer_sequence_exists(
  layer_id: layer | string,
  sequence_element_id: layer_sequence,
): bool;
declare function layer_sequence_x(
  sequence_element_id: layer_sequence,
  pos_x: number,
): void;
declare function layer_sequence_y(
  sequence_element_id: layer_sequence,
  pos_y: number,
): void;
declare function layer_sequence_angle(
  sequence_element_id: layer_sequence,
  angle: number,
): void;
declare function layer_sequence_xscale(
  sequence_element_id: layer_sequence,
  xscale: number,
): void;
declare function layer_sequence_yscale(
  sequence_element_id: layer_sequence,
  yscale: number,
): void;
declare function layer_sequence_headpos(
  sequence_element_id: layer_sequence,
  position: number,
): void;
declare function layer_sequence_headdir(
  sequence_element_id: layer_sequence,
  direction: number,
): void;
declare function layer_sequence_pause(
  sequence_element_id: layer_sequence,
): void;
declare function layer_sequence_play(sequence_element_id: layer_sequence): void;
declare function layer_sequence_speedscale(
  sequence_element_id: layer_sequence,
  speedscale: number,
): void;
declare function layer_sequence_get_x(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_y(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_angle(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_xscale(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_yscale(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_headpos(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_headdir(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_sequence(
  sequence_element_id: layer_sequence,
): any;
declare function layer_sequence_is_paused(
  sequence_element_id: layer_sequence,
): bool;
declare function layer_sequence_is_finished(
  sequence_element_id: layer_sequence,
): bool;
declare function layer_sequence_get_speedscale(
  sequence_element_id: layer_sequence,
): number;
declare function layer_sequence_get_length(
  sequence_element_id: layer_sequence,
): int;
declare function gc_collect(): void;
declare function gc_enable(enable: boolean): void;
declare function gc_is_enabled(): bool;
declare function gc_get_stats(): any;
declare function gc_target_frame_time(time: int): void;
declare function gc_get_target_frame_time(): int;
declare function is_nan(val: any): bool;
declare function is_infinity(val: any): bool;
declare function variable_instance_get_names<T extends instance>(
  id: T,
): string[];
declare function variable_instance_names_count<T extends instance>(id: T): int;
declare function string_hash_to_newline(str: string): string;
declare function game_set_speed(value: number, type: gamespeed_type): void;
declare function game_get_speed(type: gamespeed_type): number;
declare function collision_point_list<T extends objects>(
  x: number,
  y: number,
  obj: T,
  prec: boolean,
  notme: boolean,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function collision_rectangle_list<T extends objects>(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: T,
  prec: boolean,
  notme: boolean,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function collision_circle_list<T extends objects>(
  x1: number,
  y1: number,
  radius: number,
  obj: T,
  prec: boolean,
  notme: boolean,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function collision_ellipse_list<T extends objects>(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: T,
  prec: boolean,
  notme: boolean,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function collision_line_list<T extends objects>(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: T,
  prec: boolean,
  notme: boolean,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function instance_position_list<T extends objects>(
  x: number,
  y: number,
  obj: T,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function instance_place_list<T extends objects>(
  x: number,
  y: number,
  obj: T,
  list: ds_list<T>,
  ordered: boolean,
): int;
declare function gif_open(width: int, height: int, clear_color: int): gif;
declare function gif_add_surface(
  gifindex: gif,
  surfaceindex: surface,
  delaytime: int,
  [xoffset]: int,
  [yoffset]: int,
  [quantization]: int,
): int;
declare function gif_save(gif: gif, filename: string): int;
declare function gif_save_buffer(gif: gif): buffer;
declare function sprite_set_speed(
  ind: sprites,
  speed: number,
  type: sprite_speed_type,
): void;
declare function sprite_get_speed_type(ind: sprites): sprite_speed_type;
declare function sprite_get_speed(ind: sprites): number;
declare function texture_is_ready(tex_id: texture_group | string): bool;
declare function texture_prefetch(
  tex_id_or_groupname: texture_group | string,
): void;
declare function texture_flush(
  tex_id_or_groupname: texture_group | string,
): void;
declare function texturegroup_get_textures(groupname: string): texture_group[];
declare function texturegroup_get_sprites(groupname: string): sprites[];
declare function texturegroup_get_fonts(groupname: string): fonts[];
declare function texturegroup_get_tilesets(groupname: string): tilesets[];
declare function texture_debug_messages(debug_level: boolean): void;
declare function room_get_camera(ind: rooms, vind: int): camera;
declare function room_set_camera(ind: rooms, vind: int, camera: camera): void;
declare function matrix_build_identity(): number[];
declare function matrix_build_lookat(
  xfrom: number,
  yfrom: number,
  zfrom: number,
  xto: number,
  yto: number,
  zto: number,
  xup: number,
  yup: number,
  zup: number,
): number[];
declare function matrix_build_projection_ortho(
  width: number,
  height: number,
  znear: number,
  zfar: number,
): number[];
declare function matrix_build_projection_perspective(
  width: number,
  height: number,
  znear: number,
  zfar: number,
): number[];
declare function matrix_build_projection_perspective_fov(
  fov_y: number,
  aspect: number,
  znear: number,
  zfar: number,
): number[];
declare function matrix_transform_vertex(
  matrix: number[],
  x: number,
  y: number,
  z: number,
): number[];
declare function matrix_stack_push(matrix: number[]): void;
declare function matrix_stack_pop(): void;
declare function matrix_stack_set(matrix: number[]): void;
declare function matrix_stack_clear(): void;
declare function matrix_stack_top(): number[];
declare function matrix_stack_is_empty(): bool;
declare function display_set_timing_method(method: display_timing_method): void;
declare function display_get_timing_method(): display_timing_method;
declare function display_set_sleep_margin(milliseconds: number): void;
declare function display_get_sleep_margin(): number;
declare function gpu_set_blendenable(enable: boolean): void;
declare function gpu_set_ztestenable(enable: boolean): void;
declare function gpu_set_zfunc(cmp_func: gpu_cmpfunc): void;
declare function gpu_get_zfunc(): gpu_cmpfunc;
declare function gpu_set_cullmode(cullmode: gpu_cullmode): void;
declare function gpu_get_cullmode(): gpu_cullmode;
declare function gpu_set_zwriteenable(enable: boolean): void;
declare function gpu_set_fog(
  array_or_enable: bool | any[],
  col?: number,
  start?: number,
  end?: number,
): void;
declare function gpu_set_blendmode(mode: blendmode): void;
declare function gpu_set_blendmode_ext(
  src: blendmode_ext,
  dest: blendmode_ext,
): void;
declare function gpu_set_blendmode_ext_sepalpha(
  src: blendmode_ext,
  dest: blendmode_ext,
  srcalpha: blendmode_ext,
  destalpha: blendmode_ext,
): void;
declare function gpu_set_colorwriteenable(
  red_or_array: bool | bool[],
  green?: boolean,
  blue?: boolean,
  alpha?: boolean,
): void;
declare function gpu_set_colourwriteenable(
  red_or_array: bool | bool[],
  green?: boolean,
  blue?: any,
  alpha?: boolean,
): void;
declare function gpu_set_alphatestenable(enable: boolean): void;
declare function gpu_set_alphatestref(value: int): void;
declare function gpu_set_texfilter(linear: boolean): void;
declare function gpu_set_texfilter_ext(
  sampler_id: shader_sampler,
  linear: boolean,
): void;
declare function gpu_set_texrepeat(repeat: boolean): void;
declare function gpu_set_texrepeat_ext(
  sampler_id: shader_sampler,
  repeat: boolean,
): void;
declare function gpu_set_tex_filter(linear: boolean): void;
declare function gpu_set_tex_filter_ext(
  sampler_id: shader_sampler,
  linear: boolean,
): void;
declare function gpu_set_tex_repeat(repeat: boolean): void;
declare function gpu_set_tex_repeat_ext(
  sampler_id: shader_sampler,
  repeat: boolean,
): void;
declare function gpu_set_tex_mip_filter(filter: texture_mip_filter): void;
declare function gpu_set_tex_mip_filter_ext(
  sampler_id: shader_sampler,
  filter: texture_mip_filter,
): void;
declare function gpu_set_tex_mip_bias(bias: number): void;
declare function gpu_set_tex_mip_bias_ext(
  sampler_id: shader_sampler,
  bias: number,
): void;
declare function gpu_set_tex_min_mip(minmip: int): void;
declare function gpu_set_tex_min_mip_ext(
  sampler_id: shader_sampler,
  minmip: int,
): void;
declare function gpu_set_tex_max_mip(maxmip: int): void;
declare function gpu_set_tex_max_mip_ext(
  sampler_id: shader_sampler,
  maxmip: int,
): void;
declare function gpu_set_tex_max_aniso(maxaniso: int): void;
declare function gpu_set_tex_max_aniso_ext(
  sampler_id: shader_sampler,
  maxaniso: int,
): void;
declare function gpu_set_tex_mip_enable(setting: texture_mip_state): any;
declare function gpu_set_tex_mip_enable_ext(
  sampler_id: shader_sampler,
  setting: texture_mip_state,
): any;
declare function gpu_get_blendenable(): bool;
declare function gpu_get_ztestenable(): bool;
declare function gpu_get_zwriteenable(): bool;
declare function gpu_get_fog(): any[];
declare function gpu_get_blendmode(): blendmode;
declare function gpu_get_blendmode_ext(): blendmode_ext[];
declare function gpu_get_blendmode_ext_sepalpha(): blendmode_ext[];
declare function gpu_get_blendmode_src(): blendmode_ext;
declare function gpu_get_blendmode_dest(): blendmode_ext;
declare function gpu_get_blendmode_srcalpha(): blendmode_ext;
declare function gpu_get_blendmode_destalpha(): blendmode_ext;
declare function gpu_get_colorwriteenable(): bool;
declare function gpu_get_colourwriteenable(): bool;
declare function gpu_get_alphatestenable(): bool;
declare function gpu_get_alphatestref(): int;
declare function gpu_get_texfilter(): bool;
declare function gpu_get_texfilter_ext(sampler_id: shader_sampler): bool;
declare function gpu_get_texrepeat(): bool;
declare function gpu_get_texrepeat_ext(sampler_id: shader_sampler): bool;
declare function gpu_get_tex_filter(): bool;
declare function gpu_get_tex_filter_ext(sampler_id: shader_sampler): bool;
declare function gpu_get_tex_repeat(): bool;
declare function gpu_get_tex_repeat_ext(sampler_id: shader_sampler): bool;
declare function gpu_get_tex_mip_filter(): texture_mip_filter;
declare function gpu_get_tex_mip_filter_ext(
  sampler_id: shader_sampler,
): texture_mip_filter;
declare function gpu_get_tex_mip_bias(): number;
declare function gpu_get_tex_mip_bias_ext(sampler_id: shader_sampler): number;
declare function gpu_get_tex_min_mip(): int;
declare function gpu_get_tex_min_mip_ext(sampler_id: shader_sampler): int;
declare function gpu_get_tex_max_mip(): int;
declare function gpu_get_tex_max_mip_ext(sampler_id: shader_sampler): int;
declare function gpu_get_tex_max_aniso(): int;
declare function gpu_get_tex_max_aniso_ext(sampler_id: shader_sampler): int;
declare function gpu_get_tex_mip_enable(): texture_mip_state;
declare function gpu_get_tex_mip_enable_ext(
  sampler_id: shader_sampler,
): texture_mip_state;
declare function gpu_push_state(): void;
declare function gpu_pop_state(): void;
declare function gpu_get_state(): ds_map<string, any>;
declare function gpu_set_state(map: ds_map<string, any>): void;
declare function draw_light_define_ambient(col: int): void;
declare function draw_light_define_direction(
  ind: int,
  dx: number,
  dy: number,
  dz: number,
  col: int,
): void;
declare function draw_light_define_point(
  ind: int,
  x: number,
  y: number,
  z: number,
  range: number,
  col: int,
): void;
declare function draw_light_enable(ind: int, enable: boolean): void;
declare function draw_set_lighting(enable: boolean): void;
declare function draw_light_get_ambient(): int;
declare function draw_light_get(ind: int): any[];
declare function draw_get_lighting(): bool;
declare function gamepad_hat_count(device: int): int;
declare function gamepad_hat_value(device: int, hatIndex: int): number;
declare function gamepad_remove_mapping(device: int): void;
declare function gamepad_test_mapping(
  device: int,
  mapping_string: string,
): void;
declare function gamepad_get_mapping(device: int): string;
declare function gamepad_get_guid(device: int): string;
declare function gamepad_set_option(
  gamepad_id: int,
  option_key: string,
  option_value: any,
): void;
declare function gamepad_get_option(gamepad_id: int, option_key: string): any;
declare function layer_get_id(layer_name: string): layer;
declare function layer_get_id_at_depth(depth: int): layer;
declare function layer_get_depth(layer_id: layer | string): int;
declare function layer_create(depth: int, name?: string): layer;
declare function layer_destroy(layer_id: layer | string): void;
declare function layer_destroy_instances(layer_id: layer | string): void;
declare function layer_add_instance<T extends any>(
  layer_id: layer | string,
  instance: T,
): void;
declare function layer_has_instance<T extends any>(
  layer_id: layer | string,
  instance: T,
): bool;
declare function layer_set_visible(
  layer_id: layer | string,
  visible: boolean,
): void;
declare function layer_get_visible(layer_id: layer | string): bool;
declare function layer_exists(layer_id: layer | string): bool;
declare function layer_x(layer_id: layer | string, x: number): void;
declare function layer_y(layer_id: layer | string, y: number): void;
declare function layer_get_x(layer_id: layer | string): number;
declare function layer_get_y(layer_id: layer | string): number;
declare function layer_hspeed(layer_id: layer | string, speed: number): void;
declare function layer_vspeed(layer_id: layer | string, speed: number): void;
declare function layer_get_hspeed(layer_id: layer | string): number;
declare function layer_get_vspeed(layer_id: layer | string): number;
declare function layer_script_begin(
  layer_id: layer | string,
  script: scripts,
): void;
declare function layer_script_end(
  layer_id: layer | string,
  script: scripts,
): void;
declare function layer_shader(layer_id: layer | string, shader: shaders): void;
declare function layer_get_script_begin(layer_id: layer | string): scripts;
declare function layer_get_script_end(layer_id: layer | string): scripts;
declare function layer_get_shader(layer_id: layer | string): shaders;
declare function layer_set_target_room(room: rooms): void;
declare function layer_get_target_room(): rooms;
declare function layer_reset_target_room(): void;
declare function layer_get_all(): layer[];
declare function layer_get_all_elements(
  layer_id: layer | string,
): layer_element[];
declare function layer_get_name(layer_id: layer | string): string;
declare function layer_depth(layer_id: layer | string, depth: int): void;
declare function layer_get_element_layer(element_id: layer_element): layer;
declare function layer_get_element_type(
  element_id: layer_element,
): layer_element_type;
declare function layer_element_move(
  element_id: layer_element,
  layer_id: layer | string,
): void;
declare function layer_force_draw_depth(force: boolean, depth: number): void;
declare function layer_is_draw_depth_forced(): bool;
declare function layer_get_forced_depth(): number;
declare function layer_background_get_id(
  layer_id: layer | string,
): layer_background;
declare function layer_background_exists(
  layer_id: layer | string,
  background_element_id: layer_background,
): bool;
declare function layer_background_create(
  layer_id: layer | string,
  sprite: sprites,
): layer_background;
declare function layer_background_destroy(
  background_element_id: layer_background,
): void;
declare function layer_background_visible(
  background_element_id: layer_background,
  visible: boolean,
): void;
declare function layer_background_change(
  background_element_id: layer_background,
  sprite: sprites,
): void;
declare function layer_background_sprite(
  background_element_id: layer_background,
  sprite: sprites,
): void;
declare function layer_background_htiled(
  background_element_id: layer_background,
  tiled: boolean,
): void;
declare function layer_background_vtiled(
  background_element_id: layer_background,
  tiled: boolean,
): void;
declare function layer_background_stretch(
  background_element_id: layer_background,
  stretch: boolean,
): void;
declare function layer_background_yscale(
  background_element_id: layer_background,
  yscale: number,
): void;
declare function layer_background_xscale(
  background_element_id: layer_background,
  xscale: number,
): void;
declare function layer_background_blend(
  background_element_id: layer_background,
  col: int,
): void;
declare function layer_background_alpha(
  background_element_id: layer_background,
  alpha: number,
): void;
declare function layer_background_index(
  background_element_id: layer_background,
  image_index: int,
): void;
declare function layer_background_speed(
  background_element_id: layer_background,
  image_speed: number,
): void;
declare function layer_background_get_visible(
  background_element_id: layer_background,
): bool;
declare function layer_background_get_sprite(
  background_element_id: layer_background,
): sprites;
declare function layer_background_get_htiled(
  background_element_id: layer_background,
): bool;
declare function layer_background_get_vtiled(
  background_element_id: layer_background,
): bool;
declare function layer_background_get_stretch(
  background_element_id: layer_background,
): bool;
declare function layer_background_get_yscale(
  background_element_id: layer_background,
): number;
declare function layer_background_get_xscale(
  background_element_id: layer_background,
): number;
declare function layer_background_get_blend(
  background_element_id: layer_background,
): int;
declare function layer_background_get_alpha(
  background_element_id: layer_background,
): number;
declare function layer_background_get_index(
  background_element_id: layer_background,
): int;
declare function layer_background_get_speed(
  background_element_id: layer_background,
): number;
declare function layer_sprite_get_id(
  layer_id: layer | string,
  sprite_element_name: string,
): layer_sprite;
declare function layer_sprite_exists(
  layer_id: layer | string,
  sprite_element_id: layer_sprite,
): bool;
declare function layer_sprite_create(
  layer_id: layer | string,
  x: number,
  y: any,
  sprite: number,
): layer_sprite;
declare function layer_sprite_destroy(sprite_element_id: layer_sprite): void;
declare function layer_sprite_change(
  sprite_element_id: layer_sprite,
  sprite: sprites,
): void;
declare function layer_sprite_index(
  sprite_element_id: layer_sprite,
  image_index: int,
): void;
declare function layer_sprite_speed(
  sprite_element_id: layer_sprite,
  image_speed: number,
): void;
declare function layer_sprite_xscale(
  sprite_element_id: layer_sprite,
  scale: number,
): void;
declare function layer_sprite_yscale(
  sprite_element_id: layer_sprite,
  scale: number,
): void;
declare function layer_sprite_angle(
  sprite_element_id: layer_sprite,
  angle: number,
): void;
declare function layer_sprite_blend(
  sprite_element_id: layer_sprite,
  col: int,
): void;
declare function layer_sprite_alpha(
  sprite_element_id: layer_sprite,
  alpha: number,
): void;
declare function layer_sprite_x(
  sprite_element_id: layer_sprite,
  x: number,
): void;
declare function layer_sprite_y(
  sprite_element_id: layer_sprite,
  y: number,
): void;
declare function layer_sprite_get_sprite(
  sprite_element_id: layer_sprite,
): sprites;
declare function layer_sprite_get_index(sprite_element_id: layer_sprite): int;
declare function layer_sprite_get_speed(
  sprite_element_id: layer_sprite,
): number;
declare function layer_sprite_get_xscale(
  sprite_element_id: layer_sprite,
): number;
declare function layer_sprite_get_yscale(
  sprite_element_id: layer_sprite,
): number;
declare function layer_sprite_get_angle(
  sprite_element_id: layer_sprite,
): number;
declare function layer_sprite_get_blend(sprite_element_id: layer_sprite): int;
declare function layer_sprite_get_alpha(
  sprite_element_id: layer_sprite,
): number;
declare function layer_sprite_get_x(sprite_element_id: layer_sprite): number;
declare function layer_sprite_get_y(sprite_element_id: layer_sprite): number;
declare function layer_tile_exists(
  layer_id: layer | string,
  tile_element_id: layer_tile_legacy,
): bool;
declare function layer_tile_create(
  layer_id: layer | string,
  x: number,
  y: number,
  tileset: sprites,
  left: number,
  top: number,
  width: number,
  height: number,
): layer_tile_legacy;
declare function layer_tile_destroy(tile_element_id: layer_tile_legacy): void;
declare function layer_tile_change(
  tile_element_id: layer_tile_legacy,
  sprite: sprites,
): void;
declare function layer_tile_xscale(
  tile_element_id: layer_tile_legacy,
  scale: number,
): void;
declare function layer_tile_yscale(
  tile_element_id: layer_tile_legacy,
  scale: number,
): void;
declare function layer_tile_blend(
  tile_element_id: layer_tile_legacy,
  col: int,
): void;
declare function layer_tile_alpha(
  tile_element_id: layer_tile_legacy,
  alpha: number,
): void;
declare function layer_tile_x(
  tile_element_id: layer_tile_legacy,
  x: number,
): void;
declare function layer_tile_y(
  tile_element_id: layer_tile_legacy,
  y: number,
): void;
declare function layer_tile_region(
  tile_element_id: layer_tile_legacy,
  left: number,
  top: number,
  width: number,
  height: number,
): void;
declare function layer_tile_visible(
  tile_element_id: layer_tile_legacy,
  visible: boolean,
): void;
declare function layer_tile_get_sprite(
  tile_element_id: layer_tile_legacy,
): sprites;
declare function layer_tile_get_xscale(
  tile_element_id: layer_tile_legacy,
): number;
declare function layer_tile_get_yscale(
  tile_element_id: layer_tile_legacy,
): number;
declare function layer_tile_get_blend(tile_element_id: layer_tile_legacy): int;
declare function layer_tile_get_alpha(
  tile_element_id: layer_tile_legacy,
): number;
declare function layer_tile_get_x(tile_element_id: layer_tile_legacy): number;
declare function layer_tile_get_y(tile_element_id: layer_tile_legacy): number;
declare function layer_tile_get_region(
  tile_element_id: layer_tile_legacy,
): number[];
declare function layer_tile_get_visible(
  tile_element_id: layer_tile_legacy,
): bool;
declare function layer_instance_get_instance(
  instance_element_id: layer_instance,
): any;
declare function instance_activate_layer(layer_id: layer | string): bool;
declare function instance_deactivate_layer(layer_id: layer | string): bool;
declare function layer_tilemap_get_id(layer_id: layer | string): layer_tilemap;
declare function layer_tilemap_exists(
  layer_id: layer | string,
  tilemap_element_id: layer_tilemap,
): bool;
declare function layer_tilemap_create(
  layer_id: layer | string,
  x: number,
  y: number,
  tileset: tilesets,
  width: int,
  height: int,
): layer_tilemap;
declare function layer_tilemap_destroy(tilemap_element_id: layer_tilemap): void;
declare function tilemap_tileset(
  tilemap_element_id: layer_tilemap,
  tileset: tilesets,
): void;
declare function tilemap_x(tilemap_element_id: layer_tilemap, x: number): void;
declare function tilemap_y(tilemap_element_id: layer_tilemap, y: number): void;
declare function tilemap_set(
  tilemap_element_id: layer_tilemap,
  tiledata: tilemap_data,
  cell_x: int,
  cell_y: int,
): bool;
declare function tilemap_set_at_pixel(
  tilemap_element_id: layer_tilemap,
  tiledata: tilemap_data,
  x: number,
  y: number,
): bool;
declare function tileset_get_texture(tileset: tilesets): texture;
declare function tileset_get_uvs(tileset: tilesets): int[];
declare function tileset_get_name(tileset: tilesets): string;
declare function tilemap_get_tileset(
  tilemap_element_id: layer_tilemap,
): tilesets;
declare function tilemap_get_tile_width(tilemap_element_id: layer_tilemap): int;
declare function tilemap_get_tile_height(
  tilemap_element_id: layer_tilemap,
): int;
declare function tilemap_get_width(tilemap_element_id: layer_tilemap): int;
declare function tilemap_get_height(tilemap_element_id: layer_tilemap): int;
declare function tilemap_set_width(
  tilemap_element_id: layer_tilemap,
  width: int,
): void;
declare function tilemap_set_height(
  tilemap_element_id: layer_tilemap,
  height: int,
): void;
declare function tilemap_get_x(tilemap_element_id: layer_tilemap): number;
declare function tilemap_get_y(tilemap_element_id: layer_tilemap): number;
declare function tilemap_get(
  tilemap_element_id: layer_tilemap,
  cell_x: int,
  cell_y: int,
): tilemap_data;
declare function tilemap_get_at_pixel(
  tilemap_element_id: layer_tilemap,
  x: number,
  y: number,
): tilemap_data;
declare function tilemap_get_cell_x_at_pixel(
  tilemap_element_id: layer_tilemap,
  x: number,
  y: number,
): int;
declare function tilemap_get_cell_y_at_pixel(
  tilemap_element_id: layer_tilemap,
  x: number,
  y: number,
): int;
declare function tilemap_clear(
  tilemap_element_id: layer_tilemap,
  tiledata: tilemap_data,
): void;
declare function draw_tilemap(
  tilemap_element_id: layer_tilemap,
  x: number,
  y: number,
): void;
declare function draw_tile(
  tileset: tilesets,
  tiledata: tilemap_data,
  frame: number,
  x: number,
  y: number,
): void;
declare function tilemap_set_global_mask(mask: tilemap_data): void;
declare function tilemap_get_global_mask(): tilemap_data;
declare function tilemap_set_mask(
  tilemap_element_id: layer_tilemap,
  mask: tilemap_data,
): void;
declare function tilemap_get_mask(
  tilemap_element_id: layer_tilemap,
): tilemap_data;
declare function tilemap_get_frame(tilemap_element_id: layer_tilemap): number;
declare function tile_set_empty(tiledata: tilemap_data): tilemap_data;
declare function tile_set_index(
  tiledata: tilemap_data,
  tileindex: int,
): tilemap_data;
declare function tile_set_flip(
  tiledata: tilemap_data,
  flip: boolean,
): tilemap_data;
declare function tile_set_mirror(
  tiledata: tilemap_data,
  mirror: boolean,
): tilemap_data;
declare function tile_set_rotate(tiledata: any, rotate: boolean): tilemap_data;
declare function tile_get_empty(tiledata: tilemap_data): bool;
declare function tile_get_index(tiledata: tilemap_data): int;
declare function tile_get_flip(tiledata: tilemap_data): bool;
declare function tile_get_mirror(tiledata: tilemap_data): bool;
declare function tile_get_rotate(tiledata: tilemap_data): bool;
declare function camera_create(): camera;
declare function camera_create_view<T extends any>(
  room_x: number,
  room_y: number,
  width: number,
  height: number,
  angle?: number,
  object?: T,
  x_speed?: number,
  y_speed?: number,
  x_border?: number,
  y_border?: number,
): camera;
declare function camera_destroy(camera: camera): void;
declare function camera_apply(camera: camera): void;
declare function camera_get_active(): camera;
declare function camera_get_default(): camera;
declare function camera_set_default(camera: camera): void;
declare function camera_set_view_mat(camera: camera, matrix: number[]): void;
declare function camera_set_proj_mat(camera: camera, matrix: number[]): void;
declare function camera_set_update_script(
  camera: camera,
  script: scripts,
): void;
declare function camera_set_begin_script(camera: camera, script: scripts): void;
declare function camera_set_end_script(camera: camera, script: scripts): void;
declare function camera_set_view_pos(
  camera: camera,
  x: number,
  y: number,
): void;
declare function camera_set_view_size(
  camera: camera,
  width: number,
  height: number,
): void;
declare function camera_set_view_speed(
  camera: camera,
  x_speed: number,
  y_speed: number,
): void;
declare function camera_set_view_border(
  camera: camera,
  x_border: number,
  y_border: number,
): void;
declare function camera_set_view_angle(camera: camera, angle: number): void;
declare function camera_set_view_target<T extends any>(
  camera: camera,
  object: T,
): void;
declare function camera_get_view_mat(camera: camera): number[];
declare function camera_get_proj_mat(camera: camera): number[];
declare function camera_get_update_script(camera: camera): scripts;
declare function camera_get_begin_script(camera: camera): scripts;
declare function camera_get_end_script(camera: camera): scripts;
declare function camera_get_view_x(camera: camera): number;
declare function camera_get_view_y(camera: camera): number;
declare function camera_get_view_width(camera: camera): number;
declare function camera_get_view_height(camera: camera): number;
declare function camera_get_view_speed_x(camera: camera): number;
declare function camera_get_view_speed_y(camera: camera): number;
declare function camera_get_view_border_x(camera: camera): number;
declare function camera_get_view_border_y(camera: camera): number;
declare function camera_get_view_angle(camera: camera): number;
declare function camera_get_view_target(camera: camera): any;
declare function view_get_camera(view: int): camera;
declare function view_get_visible(view: int): bool;
declare function view_get_xport(view: int): int;
declare function view_get_yport(view: int): int;
declare function view_get_wport(view: int): int;
declare function view_get_hport(view: int): int;
declare function view_get_surface_id(view: int): surface;
declare function view_set_camera(view: int, camera: camera): void;
declare function view_set_visible(view: int, visible: boolean): void;
declare function view_set_xport(view: int, xport: int): void;
declare function view_set_yport(view: int, yport: int): void;
declare function view_set_wport(view: int, wport: int): void;
declare function view_set_hport(view: int, hport: int): void;
declare function view_set_surface_id(view: int, surface_id: surface): void;
declare function gesture_drag_time(time: number): void;
declare function gesture_drag_distance(distance: number): void;
declare function gesture_flick_speed(speed: number): void;
declare function gesture_double_tap_time(time: number): void;
declare function gesture_double_tap_distance(distance: number): void;
declare function gesture_pinch_distance(distance: number): void;
declare function gesture_pinch_angle_towards(angle: number): void;
declare function gesture_pinch_angle_away(angle: number): void;
declare function gesture_rotate_time(time: number): void;
declare function gesture_rotate_angle(angle: number): void;
declare function gesture_tap_count(enable: boolean): void;
declare function gesture_get_drag_time(): number;
declare function gesture_get_drag_distance(): number;
declare function gesture_get_flick_speed(): number;
declare function gesture_get_double_tap_time(): number;
declare function gesture_get_double_tap_distance(): number;
declare function gesture_get_pinch_distance(): number;
declare function gesture_get_pinch_angle_towards(): number;
declare function gesture_get_pinch_angle_away(): number;
declare function gesture_get_rotate_time(): number;
declare function gesture_get_rotate_angle(): number;
declare function gesture_get_tap_count(): bool;
declare function keyboard_virtual_show(
  virtual_keyboard_type: virtual_keyboard_type,
  virtual_return_key_type: virtual_keyboard_return_key,
  auto_capitalization_type: virtual_keyboard_autocapitalization,
  predictive_text_enabled: boolean,
): any;
declare function keyboard_virtual_hide(): void;
declare function keyboard_virtual_status(): bool;
declare function keyboard_virtual_height(): int;
declare function is_real(val: any): bool;
declare function is_numeric(val: any): bool;
declare function is_string(val: any): bool;
declare function is_array(val: any): bool;
declare function is_undefined(val: any): bool;
declare function is_int32(val: any): bool;
declare function is_int64(val: any): bool;
declare function is_ptr(val: any): bool;
declare function is_bool(val: any): bool;
declare function variable_global_exists(name: string): bool;
declare function variable_global_get(name: string): any;
declare function variable_global_set(name: string, val: any): void;
declare function variable_instance_exists<T extends instance>(
  id: T,
  name: string,
): bool;
declare function variable_instance_get<T extends instance>(
  id: T,
  name: string,
): any;
declare function variable_instance_set<T extends instance>(
  id: T,
  name: string,
  val: any,
): void;
declare function array_equals<T0 extends any, T1 extends any>(
  var1: T0[],
  var2: T1[],
): bool;
declare function array_create<T extends any>(size: int, value?: T): array<T>;
declare function array_copy<T extends any>(
  dest: T[],
  dest_index: int,
  src: T[],
  src_index: int,
  length: int,
): void;
declare function array_get<T extends any>(variable: T[], index: int): any;
declare function array_set<T extends any>(
  variable: T[],
  index: int,
  val: any,
): void;
declare function random(x: number): number;
declare function random_range(x1: number, x2: number): number;
declare function irandom(x: int): int;
declare function irandom_range(x1: int, x2: int): int;
declare function random_set_seed(seed: int): void;
declare function random_get_seed(): int;
declare function randomize(): void;
declare function randomise(): void;
declare function choose<T extends any>(...values: T[]): T;
declare function abs(x: number): number;
declare function round(x: number): int;
declare function floor(x: number): int;
declare function ceil(x: number): int;
declare function sign(x: number): int;
declare function frac(x: number): number;
declare function sqrt(x: number): number;
declare function sqr(x: number): number;
declare function exp(x: number): number;
declare function ln(x: number): number;
declare function log2(x: number): number;
declare function log10(x: number): number;
declare function sin(radian_angle: number): number;
declare function cos(radian_angle: number): number;
declare function tan(radian_angle: number): number;
declare function arcsin(x: number): number;
declare function arccos(x: number): number;
declare function arctan(x: number): number;
declare function arctan2(y: number, x: number): number;
declare function dsin(degree_angle: number): number;
declare function dcos(degree_angle: number): number;
declare function dtan(degree_angle: number): number;
declare function darcsin(x: number): number;
declare function darccos(x: number): number;
declare function darctan(x: number): number;
declare function darctan2(y: number, x: number): number;
declare function degtorad(x: number): number;
declare function radtodeg(x: number): number;
declare function power(x: number, n: number): number;
declare function logn(n: number, x: number): number;
declare function min(...values: number[]): number;
declare function max(...values: number[]): number;
declare function mean(...values: number[]): number;
declare function median(...values: number[]): number;
declare function clamp(val: number, min: number, max: number): number;
declare function lerp(val1: number, val2: number, amount: number): number;
declare function dot_product(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
declare function dot_product_3d(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): number;
declare function dot_product_normalised(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
declare function dot_product_3d_normalised(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): number;
declare function dot_product_normalized(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
declare function dot_product_3d_normalized(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): number;
declare function math_set_epsilon(new_epsilon: number): void;
declare function math_get_epsilon(): number;
declare function angle_difference(src: number, dest: number): number;
declare function point_distance_3d(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): number;
declare function point_distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
declare function point_direction(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
declare function lengthdir_x(len: number, dir: number): number;
declare function lengthdir_y(len: number, dir: number): number;
declare function real(val: string): number;
declare function bool(val: number): bool;
declare function int64(val: number | string | pointer): int;
declare function ptr(val: number | string): pointer;
declare function string_format(val: number, total: int, dec: int): string;
declare function chr(val: int): string;
declare function ansi_char(val: int): string;
declare function ord(char: string): int;
declare function string_length(str: string): int;
declare function string_byte_length(str: string): int;
declare function string_pos(substr: string, str: string): int;
declare function string_copy(str: string, index: int, count: int): string;
declare function string_char_at(str: string, index: int): string;
declare function string_ord_at(str: string, index: int): int;
declare function string_byte_at(str: string, index: int): int;
declare function string_set_byte_at(str: string, index: int, val: int): string;
declare function string_delete(str: string, index: int, count: int): string;
declare function string_insert(substr: string, str: string, index: int): string;
declare function string_lower(str: string): string;
declare function string_upper(str: string): string;
declare function string_repeat(str: string, count: int): string;
declare function string_letters(str: string): string;
declare function string_digits(str: string): string;
declare function string_lettersdigits(str: string): string;
declare function string_replace(
  str: string,
  substr: string,
  newstr: string,
): string;
declare function string_replace_all(
  str: string,
  substr: string,
  newstr: string,
): string;
declare function string_count(substr: string, str: string): int;
declare function clipboard_has_text(): bool;
declare function clipboard_set_text(str: string): void;
declare function clipboard_get_text(): string;
declare function date_current_datetime(): datetime;
declare function date_create_datetime(
  year: int,
  month: int,
  day: int,
  hour: int,
  minute: int,
  second: int,
): datetime;
declare function date_valid_datetime(
  year: int,
  month: int,
  day: int,
  hour: int,
  minute: int,
  second: int,
): bool;
declare function date_inc_year(date: datetime, amount: int): datetime;
declare function date_inc_month(date: datetime, amount: int): datetime;
declare function date_inc_week(date: datetime, amount: int): datetime;
declare function date_inc_day(date: datetime, amount: int): datetime;
declare function date_inc_hour(date: datetime, amount: int): datetime;
declare function date_inc_minute(date: datetime, amount: int): datetime;
declare function date_inc_second(date: datetime, amount: int): datetime;
declare function date_get_year(date: datetime): int;
declare function date_get_month(date: datetime): int;
declare function date_get_week(date: datetime): int;
declare function date_get_day(date: datetime): int;
declare function date_get_hour(date: datetime): int;
declare function date_get_minute(date: datetime): int;
declare function date_get_second(date: datetime): int;
declare function date_get_weekday(date: datetime): int;
declare function date_get_day_of_year(date: datetime): int;
declare function date_get_hour_of_year(date: datetime): int;
declare function date_get_minute_of_year(date: datetime): int;
declare function date_get_second_of_year(date: datetime): int;
declare function date_year_span(date1: datetime, date2: datetime): int;
declare function date_month_span(date1: datetime, date2: datetime): int;
declare function date_week_span(date1: datetime, date2: datetime): int;
declare function date_day_span(date1: datetime, date2: datetime): int;
declare function date_hour_span(date1: datetime, date2: datetime): int;
declare function date_minute_span(date1: datetime, date2: datetime): int;
declare function date_second_span(date1: datetime, date2: datetime): int;
declare function date_compare_datetime(date1: datetime, date2: datetime): int;
declare function date_compare_date(date1: datetime, date2: datetime): int;
declare function date_compare_time(date1: datetime, date2: datetime): int;
declare function date_date_of(date: datetime): datetime;
declare function date_time_of(date: datetime): datetime;
declare function date_datetime_string(date: datetime): string;
declare function date_date_string(date: datetime): string;
declare function date_time_string(date: datetime): string;
declare function date_days_in_month(date: datetime): int;
declare function date_days_in_year(date: datetime): int;
declare function date_leap_year(date: datetime): bool;
declare function date_is_today(date: datetime): bool;
declare function date_set_timezone(timezone: timezone_type): void;
declare function date_get_timezone(): timezone_type;
declare function motion_set(dir: number, speed: number): void;
declare function motion_add(dir: number, speed: number): void;
declare function place_free(x: number, y: number): bool;
declare function place_empty<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): bool;
declare function place_meeting<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): bool;
declare function place_snapped(hsnap: number, vsnap: number): bool;
declare function move_random(hsnap: number, vsnap: number): void;
declare function move_snap(hsnap: number, vsnap: number): void;
declare function move_towards_point(x: number, y: number, sp: number): void;
declare function move_contact_solid(dir: number, maxdist: number): void;
declare function move_contact_all(dir: number, maxdist: number): void;
declare function move_outside_solid(dir: number, maxdist: number): void;
declare function move_outside_all(dir: number, maxdist: number): void;
declare function move_bounce_solid(advanced: boolean): void;
declare function move_bounce_all(advanced: boolean): void;
declare function move_wrap(hor: number, vert: number, margin: number): void;
declare function distance_to_point(x: number, y: number): number;
declare function distance_to_object<T extends objects | instance>(
  obj: T,
): number;
declare function position_empty(x: number, y: number): bool;
declare function position_meeting<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): bool;
declare function path_start(
  path: paths,
  speed: number,
  endaction: path_endaction,
  absolute: boolean,
): void;
declare function path_end(): void;
declare function mp_linear_step(
  x: number,
  y: number,
  speed: number,
  checkall: boolean,
): bool;
declare function mp_potential_step(
  x: number,
  y: number,
  speed: number,
  checkall: boolean,
): bool;
declare function mp_linear_step_object<T extends objects | instance>(
  x: number,
  y: number,
  speed: number,
  obj: T,
): bool;
declare function mp_potential_step_object<T extends objects | instance>(
  x: number,
  y: number,
  speed: number,
  obj: T,
): bool;
declare function mp_potential_settings(
  maxrot: number,
  rotstep: number,
  ahead: int,
  onspot: boolean,
): void;
declare function mp_linear_path(
  path: paths,
  xg: number,
  yg: number,
  stepsize: number,
  checkall: boolean,
): bool;
declare function mp_potential_path(
  path: paths,
  xg: number,
  yg: number,
  stepsize: number,
  factor: int,
  checkall: boolean,
): bool;
declare function mp_linear_path_object<T extends objects | instance>(
  path: paths,
  xg: number,
  yg: number,
  stepsize: number,
  obj: T,
): bool;
declare function mp_potential_path_object<T extends objects | instance>(
  path: paths,
  xg: number,
  yg: number,
  stepsize: number,
  factor: int,
  obj: T,
): bool;
declare function mp_grid_create(
  left: number,
  top: number,
  hcells: int,
  vcells: int,
  cellwidth: number,
  cellheight: number,
): mp_grid;
declare function mp_grid_destroy(id: mp_grid): void;
declare function mp_grid_clear_all(id: mp_grid): void;
declare function mp_grid_clear_cell(id: mp_grid, h: int, v: int): void;
declare function mp_grid_clear_rectangle(
  id: mp_grid,
  left: int,
  top: int,
  right: int,
  bottom: int,
): void;
declare function mp_grid_add_cell(id: mp_grid, h: int, v: int): void;
declare function mp_grid_get_cell(id: mp_grid, h: int, v: int): int;
declare function mp_grid_add_rectangle(
  id: mp_grid,
  left: int,
  top: int,
  right: int,
  bottom: int,
): void;
declare function mp_grid_add_instances<T extends objects | instance>(
  id: mp_grid,
  obj: T,
  prec: boolean,
): void;
declare function mp_grid_path(
  id: mp_grid,
  path: paths,
  xstart: number,
  ystart: number,
  xgoal: number,
  ygoal: number,
  allowdiag: boolean,
): bool;
declare function mp_grid_draw(id: mp_grid): void;
declare function mp_grid_to_ds_grid(src: mp_grid, dest: ds_grid<number>): bool;
declare function collision_point<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
  prec: boolean,
  notme: boolean,
): T;
declare function collision_rectangle<T extends objects | instance>(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: T,
  prec: boolean,
  notme: boolean,
): T;
declare function collision_circle<T extends objects | instance>(
  x1: number,
  y1: number,
  radius: number,
  obj: T,
  prec: boolean,
  notme: boolean,
): T;
declare function collision_ellipse<T extends objects | instance>(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: T,
  prec: boolean,
  notme: boolean,
): T;
declare function collision_line<T extends objects | instance>(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: T,
  prec: boolean,
  notme: boolean,
): T;
declare function point_in_rectangle(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): bool;
declare function point_in_triangle(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): bool;
declare function point_in_circle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rad: number,
): bool;
declare function rectangle_in_rectangle(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number,
): bool;
declare function rectangle_in_triangle(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): bool;
declare function rectangle_in_circle(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  cx: number,
  cy: number,
  rad: number,
): bool;
declare function instance_find<T extends objects>(obj: T, n: int): int;
declare function instance_exists<T extends objects | instance>(obj: T): bool;
declare function instance_number<T extends objects>(obj: T): bool;
declare function instance_position<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): T;
declare function instance_nearest<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): T;
declare function instance_furthest<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): T;
declare function instance_place<T extends objects | instance>(
  x: number,
  y: number,
  obj: T,
): T;
declare function instance_create_depth<T extends objects>(
  x: number,
  y: number,
  depth: number,
  obj: T,
): T;
declare function instance_create_layer<T extends objects>(
  x: number,
  y: number,
  layer_id_or_name: layer | string,
  obj: T,
): T;
declare function instance_copy(performevent: any): any;
declare function instance_change<T extends objects | instance>(
  obj: T,
  performevents: boolean,
): void;
declare function instance_destroy<T extends objects | instance>(
  id?: T,
  execute_event_flag?: boolean,
): void;
declare function position_destroy(x: number, y: number): void;
declare function position_change<T extends objects>(
  x: number,
  y: number,
  obj: T,
  performevents: boolean,
): void;
declare function instance_id_get(index: int): any;
declare function instance_deactivate_all(notme: boolean): void;
declare function instance_deactivate_object<T extends objects | instance>(
  obj: T,
): void;
declare function instance_deactivate_region(
  left: number,
  top: number,
  width: number,
  height: number,
  inside: boolean,
  notme: boolean,
): void;
declare function instance_activate_all(): void;
declare function instance_activate_object<T extends objects | instance>(
  obj: T,
): void;
declare function instance_activate_region(
  left: number,
  top: number,
  width: number,
  height: number,
  inside: boolean,
): void;
declare function room_goto(numb: rooms): void;
declare function room_goto_previous(): void;
declare function room_goto_next(): void;
declare function room_previous(numb: rooms): rooms;
declare function room_next(numb: rooms): rooms;
declare function room_restart(): void;
declare function game_end(): void;
declare function game_restart(): void;
declare function game_load(filename: string): void;
declare function game_save(filename: string): void;
declare function game_save_buffer(buffer: buffer): void;
declare function game_load_buffer(buffer: buffer): void;
declare function event_perform<T extends objects>(
  type: event_type,
  numb: int | event_number | T,
): void;
declare function event_user(numb: int): void;
declare function event_perform_object<T0 extends objects, T1 extends objects>(
  obj: T0,
  type: event_type,
  numb: int | event_number | T1,
): void;
declare function event_inherited(): void;
declare function show_debug_message(str: any): void;
declare function show_debug_overlay(enable: boolean): void;
declare function debug_event(str: string): void;
declare function alarm_get(index: int): int;
declare function alarm_set(index: int, count: int): void;
declare function keyboard_set_map(key1: int, key2: int): void;
declare function keyboard_get_map(key: int): int;
declare function keyboard_unset_map(): void;
declare function keyboard_check(key: int): bool;
declare function keyboard_check_pressed(key: int): bool;
declare function keyboard_check_released(key: int): bool;
declare function keyboard_check_direct(key: int): bool;
declare function keyboard_get_numlock(): bool;
declare function keyboard_set_numlock(on: boolean): void;
declare function keyboard_key_press(key: int): void;
declare function keyboard_key_release(key: int): void;
declare function keyboard_clear(key: int): bool;
declare function io_clear(): void;
declare function mouse_check_button(button: mouse_button): bool;
declare function mouse_check_button_pressed(button: mouse_button): bool;
declare function mouse_check_button_released(button: mouse_button): bool;
declare function mouse_wheel_up(): bool;
declare function mouse_wheel_down(): bool;
declare function mouse_clear(button: mouse_button): bool;
declare function draw_self(): void;
declare function draw_sprite(
  sprite: sprites,
  subimg: number,
  x: number,
  y: number,
): void;
declare function draw_sprite_pos(
  sprite: sprites,
  subimg: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
  alpha: number,
): void;
declare function draw_sprite_ext(
  sprite: sprites,
  subimg: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  col: int,
  alpha: number,
): void;
declare function draw_sprite_stretched(
  sprite: sprites,
  subimg: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void;
declare function draw_sprite_stretched_ext(
  sprite: sprites,
  subimg: number,
  x: number,
  y: number,
  w: number,
  h: number,
  col: int,
  alpha: number,
): void;
declare function draw_sprite_tiled(
  sprite: sprites,
  subimg: number,
  x: number,
  y: number,
): void;
declare function draw_sprite_tiled_ext(
  sprite: sprites,
  subimg: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  col: int,
  alpha: number,
): void;
declare function draw_sprite_part(
  sprite: sprites,
  subimg: number,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
): void;
declare function draw_sprite_part_ext(
  sprite: sprites,
  subimg: number,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  col: int,
  alpha: number,
): void;
declare function draw_sprite_general(
  sprite: sprites,
  subimg: number,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_clear(col: int): void;
declare function draw_clear_alpha(col: int, alpha: number): void;
declare function draw_point(x: number, y: number): void;
declare function draw_line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void;
declare function draw_line_width(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
): void;
declare function draw_rectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: boolean,
): void;
declare function draw_roundrect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: number,
): void;
declare function draw_roundrect_ext(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radiusx: number,
  radiusy: number,
  outline: boolean,
): void;
declare function draw_triangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  outline: boolean,
): void;
declare function draw_circle(
  x: number,
  y: number,
  r: number,
  outline: boolean,
): void;
declare function draw_ellipse(
  x1: number,
  y1: number,
  x2: number,
  y2: any,
  outline: boolean,
): void;
declare function draw_set_circle_precision(precision: int): void;
declare function draw_arrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
): void;
declare function draw_button(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  up: boolean,
): void;
declare function draw_path(
  path: paths,
  x: number,
  y: number,
  absolute: boolean,
): void;
declare function draw_healthbar(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amount: number,
  backcol: int,
  mincol: int,
  maxcol: int,
  direction: number,
  showback: boolean,
  showborder: boolean,
): void;
declare function draw_getpixel(x: number, y: number): int;
declare function draw_getpixel_ext(x: number, y: number): int;
declare function draw_set_colour(col: int): void;
declare function draw_set_color(col: int): void;
declare function draw_set_alpha(alpha: number): void;
declare function draw_get_colour(): int;
declare function draw_get_color(): int;
declare function draw_get_alpha(): number;
declare function merge_colour(col1: int, col2: int, amount: number): int;
declare function make_colour_rgb(red: int, green: int, blue: int): int;
declare function make_colour_hsv(
  hue: number,
  saturation: number,
  value: number,
): int;
declare function colour_get_red(col: int): int;
declare function colour_get_green(col: int): int;
declare function colour_get_blue(col: int): int;
declare function colour_get_hue(col: int): number;
declare function colour_get_saturation(col: int): number;
declare function colour_get_value(col: int): number;
declare function merge_color(col1: int, col2: int, amount: number): any;
declare function make_color_rgb(red: int, green: int, blue: int): int;
declare function make_color_hsv(
  hue: number,
  saturation: number,
  value: number,
): int;
declare function color_get_red(col: int): int;
declare function color_get_green(col: int): int;
declare function color_get_blue(col: int): int;
declare function color_get_hue(col: int): number;
declare function color_get_saturation(col: int): number;
declare function color_get_value(col: int): number;
declare function screen_save(fname: string): void;
declare function screen_save_part(
  fname: string,
  x: number,
  y: number,
  w: int,
  h: int,
): void;
declare function draw_set_font(font: fonts): void;
declare function draw_get_font(): fonts;
declare function draw_set_halign(halign: horizontal_alignment): void;
declare function draw_get_halign(): horizontal_alignment;
declare function draw_set_valign(valign: vertical_alignment): void;
declare function draw_get_valign(): vertical_alignment;
declare function draw_text(x: number, y: number, string: string): void;
declare function draw_text_ext(
  x: number,
  y: number,
  string: string,
  sep: number,
  w: number,
): void;
declare function string_width(string: string): number;
declare function string_height(string: string): number;
declare function string_width_ext(
  string: string,
  sep: number,
  w: number,
): number;
declare function string_height_ext(
  string: string,
  sep: number,
  w: number,
): number;
declare function draw_text_transformed(
  x: number,
  y: number,
  string: string,
  xscale: number,
  yscale: number,
  angle: number,
): void;
declare function draw_text_ext_transformed(
  x: number,
  y: number,
  string: string,
  sep: number,
  w: number,
  xscale: number,
  yscale: number,
  angle: number,
): void;
declare function draw_text_colour(
  x: number,
  y: number,
  string: string,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_ext_colour(
  x: number,
  y: number,
  string: string,
  sep: number,
  w: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_transformed_colour(
  x: number,
  y: number,
  string: string,
  xscale: number,
  yscale: number,
  angle: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_ext_transformed_colour(
  x: number,
  y: number,
  string: string,
  sep: number,
  w: number,
  xscale: number,
  yscale: number,
  angle: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_color(
  x: number,
  y: number,
  string: string,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_ext_color(
  x: number,
  y: number,
  string: string,
  sep: number,
  w: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_transformed_color(
  x: number,
  y: number,
  string: string,
  xscale: number,
  yscale: number,
  angle: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_text_ext_transformed_color(
  x: number,
  y: number,
  string: string,
  sep: number,
  w: number,
  xscale: number,
  yscale: number,
  angle: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: number,
): void;
declare function draw_point_colour(x: number, y: number, col1: int): void;
declare function draw_line_colour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
): void;
declare function draw_line_width_colour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  col1: int,
  col2: int,
): void;
declare function draw_rectangle_colour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
  col3: int,
  col4: int,
  outline: boolean,
): void;
declare function draw_roundrect_colour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_roundrect_colour_ext(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radiusx: number,
  radiusy: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_triangle_colour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  col1: int,
  col2: int,
  col3: int,
  outline: boolean,
): void;
declare function draw_circle_colour(
  x: number,
  y: number,
  r: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_ellipse_colour(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_point_color(x: number, y: number, col1: int): void;
declare function draw_line_color(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
): void;
declare function draw_line_width_color(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  col1: int,
  col2: int,
): void;
declare function draw_rectangle_color(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
  col3: int,
  col4: int,
  outline: boolean,
): void;
declare function draw_roundrect_color(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_roundrect_color_ext(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radiusx: number,
  radiusy: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_triangle_color(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  col1: int,
  col2: int,
  col3: int,
  outline: boolean,
): void;
declare function draw_circle_color(
  x: number,
  y: number,
  r: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_ellipse_color(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  col1: int,
  col2: int,
  outline: boolean,
): void;
declare function draw_primitive_begin(kind: primitive_type): void;
declare function draw_vertex(x: number, y: number): void;
declare function draw_vertex_colour(
  x: number,
  y: number,
  col: int,
  alpha: number,
): void;
declare function draw_vertex_color(
  x: number,
  y: number,
  col: int,
  alpha: number,
): void;
declare function draw_primitive_end(): void;
declare function sprite_get_uvs(spr: sprites, subimg: int): int[];
declare function font_get_uvs(font: fonts): fonts[];
declare function sprite_get_texture(spr: sprites, subimg: int): texture;
declare function font_get_texture(font: fonts): texture;
declare function texture_get_width(texid: texture): int;
declare function texture_get_height(texid: texture): int;
declare function texture_get_uvs(texid: texture): int[];
declare function draw_primitive_begin_texture(
  kind: primitive_type,
  texid: texture,
): void;
declare function draw_vertex_texture(
  x: number,
  y: number,
  xtex: number,
  ytex: number,
): void;
declare function draw_vertex_texture_colour(
  x: number,
  y: number,
  xtex: number,
  ytex: number,
  col: int,
  alpha: number,
): void;
declare function draw_vertex_texture_color(
  x: number,
  y: number,
  xtex: number,
  ytex: number,
  col: int,
  alpha: number,
): void;
declare function texture_global_scale(pow2integer: int): void;
declare function surface_create(w: int, h: int): surface;
declare function surface_create_ext(name: string, w: int, h: int): surface;
declare function surface_resize(id: surface, width: int, height: int): void;
declare function surface_free(id: surface): void;
declare function surface_exists(id: surface): bool;
declare function surface_get_width(id: surface): int;
declare function surface_get_height(id: surface): int;
declare function surface_get_texture(id: surface): texture;
declare function surface_set_target(id: surface): void;
declare function surface_set_target_ext(index: int, id: surface): bool;
declare function surface_get_target(): surface;
declare function surface_get_target_ext(index: int): surface;
declare function surface_reset_target(): void;
declare function surface_depth_disable(disable: boolean): void;
declare function surface_get_depth_disable(): bool;
declare function draw_surface(id: surface, x: number, y: number): void;
declare function draw_surface_stretched(
  id: surface,
  x: number,
  y: number,
  w: number,
  h: number,
): void;
declare function draw_surface_tiled(id: surface, x: number, y: number): void;
declare function draw_surface_part(
  id: surface,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
): void;
declare function draw_surface_ext(
  id: surface,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  col: int,
  alpha: number,
): void;
declare function draw_surface_stretched_ext(
  id: surface,
  x: number,
  y: number,
  w: number,
  h: number,
  col: int,
  alpha: number,
): void;
declare function draw_surface_tiled_ext(
  id: surface,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  col: int,
  alpha: number,
): void;
declare function draw_surface_part_ext(
  id: surface,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  col: int,
  alpha: number,
): void;
declare function draw_surface_general(
  id: surface,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  c1: int,
  c2: int,
  c3: int,
  c4: int,
  alpha: int,
): void;
declare function surface_getpixel(id: surface, x: number, y: number): int;
declare function surface_getpixel_ext(id: surface, x: number, y: number): int;
declare function surface_save(id: surface, fname: string): void;
declare function surface_save_part(
  id: surface,
  fname: string,
  x: number,
  y: number,
  w: int,
  h: int,
): void;
declare function surface_copy(
  destination: surface,
  x: number,
  y: number,
  source: surface,
): void;
declare function surface_copy_part(
  destination: surface,
  x: number,
  y: number,
  source: surface,
  xs: number,
  ys: number,
  ws: int,
  hs: int,
): void;
declare function application_surface_draw_enable(on_off: boolean): void;
declare function application_get_position(): int[];
declare function application_surface_enable(enable: boolean): void;
declare function application_surface_is_enabled(): bool;
declare function display_get_width(): int;
declare function display_get_height(): int;
declare function display_get_orientation(): display_orientation;
declare function display_get_gui_width(): int;
declare function display_get_gui_height(): int;
declare function display_reset(aa_level: int, vsync: boolean): void;
declare function display_mouse_get_x(): number;
declare function display_mouse_get_y(): number;
declare function display_mouse_set(x: number, y: number): void;
declare function display_set_ui_visibility(flags: int): void;
declare function window_set_fullscreen(full: boolean): void;
declare function window_get_fullscreen(): bool;
declare function window_set_caption(caption: string): void;
declare function window_set_min_width(minwidth: int): void;
declare function window_set_max_width(maxwidth: int): void;
declare function window_set_min_height(minheight: int): void;
declare function window_set_max_height(maxheight: int): void;
declare function window_get_visible_rects(
  startx: int,
  starty: int,
  endx: int,
  endy: int,
): int[];
declare function window_get_caption(): string;
declare function window_set_cursor(cursor: window_cursor): void;
declare function window_get_cursor(): window_cursor;
declare function window_set_colour(colour: int): void;
declare function window_get_colour(): int;
declare function window_set_color(color: int): void;
declare function window_get_color(): int;
declare function window_set_position(x: int, y: int): void;
declare function window_set_size(w: int, h: int): void;
declare function window_set_rectangle(x: int, y: int, w: int, h: int): void;
declare function window_center(): void;
declare function window_get_x(): int;
declare function window_get_y(): int;
declare function window_get_width(): int;
declare function window_get_height(): int;
declare function window_mouse_get_x(): int;
declare function window_mouse_get_y(): int;
declare function window_mouse_set(x: int, y: int): void;
declare function window_view_mouse_get_x(id: int): number;
declare function window_view_mouse_get_y(id: int): number;
declare function window_views_mouse_get_x(): number;
declare function window_views_mouse_get_y(): number;
declare function audio_listener_position(x: number, y: number, z: number): void;
declare function audio_listener_velocity(
  vx: number,
  vy: number,
  vz: number,
): void;
declare function audio_listener_orientation(
  lookat_x: number,
  lookat_y: number,
  lookat_z: number,
  up_x: number,
  up_y: number,
  up_z: number,
): void;
declare function audio_emitter_position(
  emitterid: audio_emitter,
  x: number,
  y: number,
  z: number,
): void;
declare function audio_emitter_create(): audio_emitter;
declare function audio_emitter_free(emitterid: audio_emitter): void;
declare function audio_emitter_exists(emitterid: audio_emitter): bool;
declare function audio_emitter_pitch(
  emitterid: audio_emitter,
  pitch: number,
): void;
declare function audio_emitter_velocity(
  emitterid: audio_emitter,
  vx: number,
  vy: number,
  vz: number,
): void;
declare function audio_emitter_falloff(
  emitterid: audio_emitter,
  falloff_ref_dist: number,
  falloff_max_dist: number,
  falloff_factor: number,
): void;
declare function audio_emitter_gain(
  emitterid: audio_emitter,
  gain: number,
): void;
declare function audio_play_sound(
  soundid: sounds,
  priority: int,
  loops: boolean,
): sound_instance;
declare function audio_play_sound_on(
  emitterid: audio_emitter,
  soundid: sounds,
  loops: boolean,
  priority: int,
): sound_instance;
declare function audio_play_sound_at(
  soundid: sounds,
  x: number,
  y: number,
  z: number,
  falloff_ref_dist: number,
  falloff_max_dist: number,
  falloff_factor: number,
  loops: boolean,
  priority: int,
): sound_instance;
declare function audio_stop_sound(soundid: sounds | sound_instance): void;
declare function audio_resume_sound(soundid: sounds | sound_instance): void;
declare function audio_pause_sound(soundid: sounds | sound_instance): void;
declare function audio_channel_num(numchannels: int): void;
declare function audio_sound_length(soundid: sounds | sound_instance): number;
declare function audio_get_type(soundid: sounds | sound_instance): int;
declare function audio_falloff_set_model(
  falloffmode: audio_falloff_model,
): void;
declare function audio_master_gain(gain: number): void;
declare function audio_sound_gain(
  index: sounds | sound_instance,
  level: number,
  time: number,
): void;
declare function audio_sound_pitch(
  index: sounds | sound_instance,
  pitch: number,
): void;
declare function audio_stop_all(): void;
declare function audio_resume_all(): void;
declare function audio_pause_all(): void;
declare function audio_is_playing(soundid: sounds | sound_instance): bool;
declare function audio_is_paused(soundid: sounds | sound_instance): bool;
declare function audio_exists(soundid: sounds | sound_instance): bool;
declare function audio_system_is_available(): bool;
declare function audio_sound_is_playable(soundid: sounds): bool;
declare function audio_emitter_get_gain(emitterid: audio_emitter): number;
declare function audio_emitter_get_pitch(emitterid: audio_emitter): number;
declare function audio_emitter_get_x(emitterid: audio_emitter): number;
declare function audio_emitter_get_y(emitterid: audio_emitter): number;
declare function audio_emitter_get_z(emitterid: audio_emitter): number;
declare function audio_emitter_get_vx(emitterid: audio_emitter): number;
declare function audio_emitter_get_vy(emitterid: audio_emitter): number;
declare function audio_emitter_get_vz(emitterid: audio_emitter): number;
declare function audio_listener_set_position(
  index: int,
  x: number,
  y: number,
  z: number,
): void;
declare function audio_listener_set_velocity(
  index: int,
  vx: number,
  vy: number,
  vz: number,
): void;
declare function audio_listener_set_orientation(
  index: int,
  lookat_x: number,
  lookat_y: number,
  lookat_z: number,
  up_x: number,
  up_y: number,
  up_z: number,
): void;
declare function audio_listener_get_data(index: int): ds_map<string, number>;
declare function audio_set_master_gain(listenerIndex: int, gain: number): void;
declare function audio_get_master_gain(listenerIndex: int): number;
declare function audio_sound_get_gain(index: sounds | sound_instance): number;
declare function audio_sound_get_pitch(index: sounds | sound_instance): number;
declare function audio_get_name(index: sounds | sound_instance): string;
declare function audio_sound_set_track_position(
  index: sounds | sound_instance,
  time: number,
): void;
declare function audio_sound_get_track_position(
  index: sounds | sound_instance,
): number;
declare function audio_create_stream(filename: string): sounds;
declare function audio_destroy_stream(stream_sound_id: sounds): void;
declare function audio_create_sync_group(looping: boolean): sound_sync_group;
declare function audio_destroy_sync_group(
  sync_group_id: sound_sync_group,
): void;
declare function audio_play_in_sync_group(
  sync_group_id: sound_sync_group,
  soundid: sounds,
): sound_instance;
declare function audio_start_sync_group(sync_group_id: sound_sync_group): void;
declare function audio_stop_sync_group(sync_group_id: sound_sync_group): void;
declare function audio_pause_sync_group(sync_group_id: sound_sync_group): void;
declare function audio_resume_sync_group(sync_group_id: sound_sync_group): void;
declare function audio_sync_group_get_track_pos(
  sync_group_id: sound_sync_group,
): number;
declare function audio_sync_group_debug(
  sync_group_id: sound_sync_group | int,
): void;
declare function audio_sync_group_is_playing(
  sync_group_id: sound_sync_group,
): bool;
declare function audio_debug(enable: boolean): void;
declare function audio_group_load(groupId: audio_group): bool;
declare function audio_group_unload(groupId: audio_group): bool;
declare function audio_group_is_loaded(groupId: audio_group): bool;
declare function audio_group_load_progress(groupId: audio_group): number;
declare function audio_group_name(groupId: audio_group): string;
declare function audio_group_stop_all(groupId: audio_group): void;
declare function audio_group_set_gain(
  groupId: audio_group,
  volume: number,
  time: number,
): void;
declare function audio_create_buffer_sound(
  bufferId: buffer,
  format: buffer_type,
  rate: int,
  offset: int,
  length: int,
  channels: audio_sound_channel,
): sounds;
declare function audio_free_buffer_sound(soundId: sounds): void;
declare function audio_create_play_queue(
  bufferFormat: buffer_type,
  sampleRate: int,
  channels: audio_sound_channel,
): sound_play_queue;
declare function audio_free_play_queue(queueId: sound_play_queue): void;
declare function audio_queue_sound(
  queueId: sound_play_queue,
  buffer_id: buffer,
  offset: int,
  length: int,
): void;
declare function audio_get_recorder_count(): int;
declare function audio_get_recorder_info(
  recorder_num: int,
): ds_map<string, any>;
declare function audio_start_recording(recorder_num: int): buffer;
declare function audio_stop_recording(channel_index: int): void;
declare function audio_sound_get_listener_mask(
  soundid: sounds | sound_instance,
): int;
declare function audio_emitter_get_listener_mask(emitterid: audio_emitter): int;
declare function audio_get_listener_mask(): int;
declare function audio_sound_set_listener_mask(
  soundid: sounds | sound_instance,
  mask: int,
): void;
declare function audio_emitter_set_listener_mask(
  emitterid: audio_emitter,
  mask: int,
): void;
declare function audio_set_listener_mask(mask: int): void;
declare function audio_get_listener_count(): int;
declare function audio_get_listener_info(index: int): ds_map<string, any>;
declare function show_message(str: string): void;
declare function show_message_async(str: string): void;
declare function clickable_add(
  x: number,
  y: number,
  spritetpe: html_clickable_tpe,
  URL: string,
  target: string,
  params: string,
): html_clickable;
declare function clickable_add_ext(
  x: number,
  y: number,
  spritetpe: html_clickable_tpe,
  URL: string,
  target: string,
  params: string,
  scale: number,
  alpha: number,
): html_clickable;
declare function clickable_change(
  buttonid: html_clickable,
  spritetpe: html_clickable_tpe,
  x: number,
  y: number,
): void;
declare function clickable_change_ext(
  buttonid: html_clickable,
  spritetpe: html_clickable_tpe,
  x: number,
  y: number,
  scale: number,
  alpha: number,
): void;
declare function clickable_delete(buttonid: html_clickable): void;
declare function clickable_exists(index: html_clickable): bool;
declare function clickable_set_style(
  buttonid: html_clickable,
  map: ds_map<string, string>,
): bool;
declare function show_question(str: string): bool;
declare function show_question_async(str: string): int;
declare function get_integer(str: string, def: number): number;
declare function get_string(str: string, def: string): string;
declare function get_integer_async(str: string, def: number): int;
declare function get_string_async(str: string, def: string): int;
declare function get_login_async(username: string, password: string): int;
declare function get_open_filename(filter: string, fname: string): string;
declare function get_save_filename(filter: string, fname: string): string;
declare function get_open_filename_ext(
  filter: string,
  fname: string,
  dir: string,
  title: string,
): string;
declare function get_save_filename_ext(
  filter: string,
  fname: string,
  dir: string,
  title: string,
): string;
declare function show_error(str: string, abort: boolean): void;
declare function highscore_clear(): void;
declare function highscore_add(str: string, numb: number): void;
declare function highscore_value(place: int): number;
declare function highscore_name(place: int): string;
declare function draw_highscore(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void;
declare function sprite_exists(ind: sprites): bool;
declare function sprite_get_name(ind: sprites): string;
declare function sprite_get_number(ind: sprites): int;
declare function sprite_get_width(ind: sprites): int;
declare function sprite_get_height(ind: sprites): int;
declare function sprite_get_xoffset(ind: sprites): number;
declare function sprite_get_yoffset(ind: sprites): number;
declare function sprite_get_bbox_mode(ind: sprites): bbox_mode;
declare function sprite_get_bbox_left(ind: sprites): number;
declare function sprite_get_bbox_right(ind: sprites): number;
declare function sprite_get_bbox_top(ind: sprites): number;
declare function sprite_get_bbox_bottom(ind: sprites): number;
declare function sprite_set_bbox_mode(ind: sprites, mode: bbox_mode): void;
declare function sprite_set_bbox(
  ind: sprites,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void;
declare function sprite_save(ind: sprites, subimg: int, fname: string): void;
declare function sprite_save_strip(ind: sprites, fname: string): void;
declare function sprite_set_cache_size(ind: sprites, max: int): void;
declare function sprite_set_cache_size_ext(
  ind: sprites,
  image: int,
  max: int,
): void;
declare function sprite_get_tpe(index: any, subindex: any): html_clickable_tpe;
declare function sprite_prefetch(ind: sprites): int;
declare function sprite_prefetch_multi(indarray: sprites[]): int;
declare function sprite_flush(ind: sprites): int;
declare function sprite_flush_multi(indarray: sprites[]): int;
declare function font_exists(ind: fonts): bool;
declare function font_get_name(ind: fonts): string;
declare function font_get_fontname(ind: fonts): string;
declare function font_get_bold(ind: fonts): bool;
declare function font_get_italic(ind: fonts): bool;
declare function font_get_first(ind: fonts): int;
declare function font_get_last(ind: fonts): int;
declare function font_get_size(ind: fonts): int;
declare function font_set_cache_size(font: fonts, max: int): void;
declare function path_exists(ind: paths): bool;
declare function path_get_name(ind: paths): string;
declare function path_get_length(ind: paths): number;
declare function path_get_kind(ind: paths): bool;
declare function path_get_closed(ind: paths): bool;
declare function path_get_precision(ind: paths): int;
declare function path_get_number(ind: paths): int;
declare function path_get_point_x(ind: paths, n: int): number;
declare function path_get_point_y(ind: paths, n: int): number;
declare function path_get_point_speed(ind: paths, n: int): number;
declare function path_get_x(ind: paths, pos: number): number;
declare function path_get_y(ind: paths, pos: number): number;
declare function path_get_speed(ind: paths, pos: number): number;
declare function script_exists(ind: scripts): bool;
declare function script_get_name(ind: scripts): string;
declare function timeline_add(): timelines;
declare function timeline_delete(ind: timelines): void;
declare function timeline_clear(ind: timelines): void;
declare function timeline_exists(ind: timelines): bool;
declare function timeline_get_name(ind: timelines): string;
declare function timeline_moment_clear(ind: timelines, step: int): void;
declare function timeline_moment_add_script(
  ind: timelines,
  step: int,
  script: scripts,
): void;
declare function timeline_size(ind: timelines): int;
declare function timeline_max_moment(ind: timelines): int;
declare function object_exists<T extends objects>(ind: T): bool;
declare function object_get_name<T extends objects>(ind: T): string;
declare function object_get_sprite<T extends objects>(ind: T): sprites;
declare function object_get_solid<T extends objects>(ind: T): bool;
declare function object_get_visible<T extends objects>(ind: T): bool;
declare function object_get_persistent<T extends objects>(ind: T): bool;
declare function object_get_mask<T extends objects>(ind: T): sprites;
declare function object_get_parent<T extends objects>(ind: T): any;
declare function object_get_physics<T extends objects>(ind: T): bool;
declare function object_is_ancestor<T0 extends objects, T1 extends objects>(
  ind_child: T0,
  ind_parent: T1,
): bool;
declare function room_exists(ind: rooms): bool;
declare function room_get_name(ind: rooms): string;
declare function sprite_set_offset(
  ind: sprites,
  xoff: number,
  yoff: number,
): void;
declare function sprite_duplicate(ind: sprites): sprites;
declare function sprite_assign(ind: sprites, source: sprites): void;
declare function sprite_merge(ind1: sprites, ind2: sprites): void;
declare function sprite_add(
  fname: string,
  imgnumb: number,
  removeback: boolean,
  smooth: boolean,
  xorig: number,
  yorig: number,
): sprites;
declare function sprite_replace(
  ind: sprites,
  fname: string,
  imgnumb: number,
  removeback: boolean,
  smooth: boolean,
  xorig: number,
  yorig: number,
): void;
declare function sprite_create_from_surface(
  id: surface,
  x: int,
  y: int,
  w: int,
  h: int,
  removeback: boolean,
  smooth: boolean,
  xorig: number,
  yorig: number,
): sprites;
declare function sprite_add_from_surface(
  sprite: sprites,
  surface: surface,
  x: int,
  y: int,
  w: int,
  h: int,
  removeback: boolean,
  smooth: boolean,
): sprites;
declare function sprite_delete(ind: sprites): void;
declare function sprite_set_alpha_from_sprite(ind: sprites, spr: sprites): void;
declare function sprite_collision_mask(
  ind: sprites,
  sepmasks: boolean,
  bboxmode: int,
  bbleft: number,
  bbtop: number,
  bbright: number,
  bbbottom: number,
  kind: bbox_kind,
  tolerance: int,
): void;
declare function font_add_enable_aa(enable: boolean): void;
declare function font_add_get_enable_aa(): bool;
declare function font_add(
  name: string,
  size: number,
  bold: boolean,
  italic: boolean,
  first: int,
  last: int,
): fonts;
declare function font_add_sprite(
  spr: sprites,
  first: int,
  prop: boolean,
  sep: number,
): fonts;
declare function font_add_sprite_ext(
  spr: sprites,
  mapstring: string,
  prop: boolean,
  sep: number,
): fonts;
declare function font_replace(
  ind: fonts,
  name: string,
  size: number,
  bold: boolean,
  italic: boolean,
  first: int,
  last: int,
): void;
declare function font_replace_sprite(
  ind: fonts,
  spr: sprites,
  first: int,
  prop: boolean,
  sep: number,
): void;
declare function font_replace_sprite_ext(
  font: fonts,
  spr: sprites,
  mapstring: string,
  prop: boolean,
  sep: number,
): void;
declare function font_delete(ind: fonts): void;
declare function path_set_kind(ind: paths, kind: boolean): void;
declare function path_set_closed(ind: paths, closed: boolean): void;
declare function path_set_precision(ind: paths, prec: int): void;
declare function path_add(): paths;
declare function path_assign(target: paths, source: paths): void;
declare function path_duplicate(ind: paths): paths;
declare function path_append(ind: paths, path: paths): void;
declare function path_delete(ind: paths): void;
declare function path_add_point(
  ind: paths,
  x: number,
  y: number,
  speed: number,
): void;
declare function path_insert_point(
  ind: paths,
  n: int,
  x: number,
  y: number,
  speed: number,
): void;
declare function path_change_point(
  ind: paths,
  n: int,
  x: number,
  y: number,
  speed: number,
): void;
declare function path_delete_point(ind: paths, n: int): void;
declare function path_clear_points(ind: paths): void;
declare function path_reverse(ind: paths): void;
declare function path_mirror(ind: paths): void;
declare function path_flip(ind: paths): void;
declare function path_rotate(ind: paths, angle: number): void;
declare function path_rescale(ind: paths, xscale: number, yscale: number): void;
declare function path_shift(ind: paths, xshift: number, yshift: number): void;
declare function script_execute(ind: scripts, ...values: any[]): any;
declare function object_set_sprite<T extends objects>(
  ind: T,
  spr: sprites,
): void;
declare function object_set_solid<T extends objects>(
  ind: T,
  solid: boolean,
): void;
declare function object_set_visible<T extends objects>(
  ind: T,
  vis: boolean,
): void;
declare function object_set_persistent<T extends objects>(
  ind: T,
  pers: boolean,
): void;
declare function object_set_mask<T extends objects>(ind: T, spr: sprites): void;
declare function room_set_width(ind: rooms, w: number): void;
declare function room_set_height(ind: rooms, h: number): void;
declare function room_set_persistent(ind: rooms, pers: boolean): void;
declare function room_set_viewport(
  ind: rooms,
  vind: int,
  vis: boolean,
  xport: number,
  yport: number,
  wport: number,
  hport: number,
): void;
declare function room_get_viewport(ind: rooms, vind: int): any[];
declare function room_set_view_enabled(ind: rooms, val: boolean): void;
declare function room_add(): rooms;
declare function room_duplicate(ind: rooms): rooms;
declare function room_assign(ind: rooms, source: rooms): void;
declare function room_instance_add<T extends objects>(
  ind: rooms,
  x: number,
  y: number,
  obj: T,
): void;
declare function room_instance_clear(ind: rooms): void;
declare function asset_get_index(name: string): any;
declare function asset_get_type(name: string): asset_type;
declare function file_text_open_from_string(content: string): file_handle;
declare function file_text_open_read(fname: string): file_handle;
declare function file_text_open_write(fname: string): file_handle;
declare function file_text_open_append(fname: string): file_handle;
declare function file_text_close(file: file_handle): void;
declare function file_text_write_string(file: file_handle, str: string): void;
declare function file_text_write_real(file: file_handle, val: number): void;
declare function file_text_writeln(file: file_handle): void;
declare function file_text_read_string(file: file_handle): string;
declare function file_text_read_real(file: file_handle): number;
declare function file_text_readln(file: file_handle): string;
declare function file_text_eof(file: file_handle): bool;
declare function file_text_eoln(file: file_handle): bool;
declare function file_exists(fname: string): bool;
declare function file_delete(fname: string): bool;
declare function file_rename(oldname: string, newname: string): bool;
declare function file_copy(fname: string, newname: string): bool;
declare function directory_exists(dname: string): bool;
declare function directory_create(dname: string): void;
declare function directory_destroy(dname: string): void;
declare function file_find_first(
  mask: string,
  attr: int | file_attribute,
): string;
declare function file_find_next(): string;
declare function file_find_close(): void;
declare function file_attributes(
  fname: string,
  attr: int | file_attribute,
): bool;
declare function filename_name(fname: string): string;
declare function filename_path(fname: string): string;
declare function filename_dir(fname: string): string;
declare function filename_drive(fname: string): string;
declare function filename_ext(fname: string): string;
declare function filename_change_ext(fname: string, newext: string): string;
declare function file_bin_open(fname: string, mode: int): binary_file_handle;
declare function file_bin_rewrite(file: binary_file_handle): void;
declare function file_bin_close(file: binary_file_handle): void;
declare function file_bin_position(file: binary_file_handle): int;
declare function file_bin_size(file: binary_file_handle): int;
declare function file_bin_seek(file: binary_file_handle, pos: int): void;
declare function file_bin_write_byte(file: binary_file_handle, byte: int): void;
declare function file_bin_read_byte(file: binary_file_handle): int;
declare function parameter_count(): int;
declare function parameter_string(n: int): string;
declare function environment_get_variable(name: string): string;
declare function ini_open_from_string(content: string): void;
declare function ini_open(fname: string): void;
declare function ini_close(): string;
declare function ini_read_string(
  section: string,
  key: string,
  fallback: string,
): string;
declare function ini_read_real(
  section: string,
  key: string,
  fallback: number,
): number;
declare function ini_write_string(
  section: string,
  key: string,
  str: string,
): void;
declare function ini_write_real(
  section: string,
  key: string,
  value: number,
): void;
declare function ini_key_exists(section: string, key: string): bool;
declare function ini_section_exists(section: string): bool;
declare function ini_key_delete(section: string, key: string): void;
declare function ini_section_delete(section: string): void;
declare function ds_set_precision(prec: number): any;
declare function ds_exists(id: any, type: ds_type): bool;
declare function ds_stack_create(): ds_stack;
declare function ds_stack_destroy<T extends any>(id: ds_stack<T>): void;
declare function ds_stack_clear<T extends any>(id: ds_stack<T>): void;
declare function ds_stack_copy<T extends any>(
  id: ds_stack<T>,
  source: ds_stack<T>,
): void;
declare function ds_stack_size<T extends any>(id: ds_stack<T>): int;
declare function ds_stack_empty<T extends any>(id: ds_stack<T>): bool;
declare function ds_stack_push<T extends any>(
  id: ds_stack<T>,
  ...values: T[]
): void;
declare function ds_stack_pop<T extends any>(id: ds_stack<T>): T;
declare function ds_stack_top<T extends any>(id: ds_stack<T>): T;
declare function ds_stack_write<T extends any>(id: ds_stack<T>): string;
declare function ds_stack_read<T extends any>(
  id: ds_stack<T>,
  str: any,
  legacy?: boolean,
): void;
declare function ds_queue_create(): ds_queue;
declare function ds_queue_destroy<T extends any>(id: ds_queue<T>): void;
declare function ds_queue_clear<T extends any>(id: ds_queue<T>): void;
declare function ds_queue_copy<T extends any>(
  id: ds_queue<T>,
  source: ds_queue<T>,
): void;
declare function ds_queue_size<T extends any>(id: ds_queue<T>): int;
declare function ds_queue_empty<T extends any>(id: ds_queue<T>): bool;
declare function ds_queue_enqueue<T extends any>(
  id: ds_queue<T>,
  ...values: T[]
): void;
declare function ds_queue_dequeue<T extends any>(id: ds_queue<T>): T;
declare function ds_queue_head<T extends any>(id: ds_queue<T>): T;
declare function ds_queue_tail<T extends any>(id: ds_queue<T>): T;
declare function ds_queue_write<T extends any>(id: ds_queue<T>): string;
declare function ds_queue_read<T extends any>(
  id: ds_queue<T>,
  str: string,
  legacy?: boolean,
): void;
declare function ds_list_create(): ds_list;
declare function ds_list_destroy<T extends any>(list: ds_list<T>): any;
declare function ds_list_clear<T extends any>(list: ds_list<T>): any;
declare function ds_list_copy<T extends any>(
  list: ds_list<T>,
  source: ds_list<T>,
): any;
declare function ds_list_size<T extends any>(list: ds_list<T>): int;
declare function ds_list_empty<T extends any>(list: ds_list<T>): bool;
declare function ds_list_add<T extends any>(
  list: ds_list<T>,
  ...values: T[]
): any;
declare function ds_list_insert<T extends any>(
  list: ds_list<T>,
  pos: int,
  value: T,
): any;
declare function ds_list_replace<T extends any>(
  list: ds_list<T>,
  pos: int,
  value: T,
): any;
declare function ds_list_delete<T extends any>(list: ds_list<T>, pos: int): any;
declare function ds_list_find_index<T extends any>(
  list: ds_list<T>,
  value: T,
): int;
declare function ds_list_find_value<T extends any>(
  list: ds_list<T>,
  pos: int,
): T;
declare function ds_list_mark_as_list<T extends any>(
  list: ds_list<T>,
  pos: int,
): any;
declare function ds_list_mark_as_map<T extends any>(
  list: ds_list<T>,
  pos: int,
): any;
declare function ds_list_sort<T extends any>(
  list: ds_list<T>,
  ascending: boolean,
): any;
declare function ds_list_shuffle<T extends any>(list: ds_list<T>): any;
declare function ds_list_write<T extends any>(list: ds_list<T>): string;
declare function ds_list_read<T extends any>(
  list: ds_list<T>,
  str: string,
  legacy?: boolean,
): any;
declare function ds_list_set<T extends any>(
  list: ds_list<T>,
  pos: int,
  value: T,
): any;
declare function ds_map_create(): ds_map;
declare function ds_map_destroy<K, V extends any>(map: ds_map<K, V>): any;
declare function ds_map_clear<K, V extends any>(map: ds_map<K, V>): any;
declare function ds_map_copy<K, V extends any>(
  map: ds_map<K, V>,
  source: ds_map<K, V>,
): any;
declare function ds_map_size<K, V extends any>(map: ds_map<K, V>): int;
declare function ds_map_empty<K, V extends any>(map: ds_map<K, V>): bool;
declare function ds_map_add<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): bool;
declare function ds_map_add_list<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): any;
declare function ds_map_add_map<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): any;
declare function ds_map_replace<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): bool;
declare function ds_map_replace_map<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): any;
declare function ds_map_replace_list<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): any;
declare function ds_map_delete<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
): any;
declare function ds_map_exists<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
): bool;
declare function ds_map_find_value<K, V extends any>(
  map: ds_map<K, V>,
  key: any,
): V;
declare function ds_map_find_previous<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
): K;
declare function ds_map_find_next<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
): K;
declare function ds_map_find_first<K, V extends any>(map: ds_map<K, V>): K;
declare function ds_map_find_last<K, V extends any>(map: ds_map<K, V>): K;
declare function ds_map_write<K, V extends any>(map: ds_map<K, V>): string;
declare function ds_map_read<K, V extends any>(
  map: ds_map<K, V>,
  str: string,
  legacy?: boolean,
): any;
declare function ds_map_set<K, V extends any>(
  map: ds_map<K, V>,
  key: K,
  value: V,
): any;
declare function ds_map_secure_save<K, V extends any>(
  map: ds_map<K, V>,
  filename: string,
): any;
declare function ds_map_secure_load<K, V extends any>(
  filename: string,
): ds_map<K, V>;
declare function ds_map_secure_load_buffer<K, V extends any>(
  buffer: buffer,
): ds_map<K, V>;
declare function ds_map_secure_save_buffer<K, V extends any>(
  map: ds_map<K, V>,
  buffer: buffer,
): ds_map<K, V>;
declare function ds_priority_create(): ds_priority;
declare function ds_priority_destroy<T extends any>(id: ds_priority<T>): void;
declare function ds_priority_clear<T extends any>(id: ds_priority<T>): void;
declare function ds_priority_copy<T extends any>(
  id: ds_priority<T>,
  source: ds_priority<T>,
): void;
declare function ds_priority_size<T extends any>(id: ds_priority<T>): int;
declare function ds_priority_empty<T extends any>(id: ds_priority<T>): bool;
declare function ds_priority_add<T extends any>(
  id: ds_priority<T>,
  value: T,
  priority: number,
): void;
declare function ds_priority_change_priority<T extends any>(
  id: ds_priority<T>,
  value: T,
  priority: number,
): void;
declare function ds_priority_find_priority<T extends any>(
  id: ds_priority<T>,
  value: T,
): number;
declare function ds_priority_delete_value<T extends any>(
  id: ds_priority<T>,
  value: T,
): void;
declare function ds_priority_delete_min<T extends any>(id: ds_priority<T>): T;
declare function ds_priority_find_min<T extends any>(id: ds_priority<T>): T;
declare function ds_priority_delete_max<T extends any>(id: ds_priority<T>): T;
declare function ds_priority_find_max<T extends any>(id: ds_priority<T>): T;
declare function ds_priority_write<T extends any>(id: ds_priority<T>): string;
declare function ds_priority_read<T extends any>(
  id: ds_priority<T>,
  str: string,
  legacy?: boolean,
): void;
declare function ds_grid_create(w: int, h: int): ds_grid;
declare function ds_grid_destroy<T extends any>(grid: ds_grid<T>): any;
declare function ds_grid_copy<T extends any>(
  grid: ds_grid<T>,
  source: ds_grid<T>,
): any;
declare function ds_grid_resize<T extends any>(
  grid: ds_grid<T>,
  w: int,
  h: int,
): any;
declare function ds_grid_width<T extends any>(grid: ds_grid<T>): int;
declare function ds_grid_height<T extends any>(grid: ds_grid<T>): int;
declare function ds_grid_clear<T extends any>(grid: ds_grid<T>, val: T): any;
declare function ds_grid_add<T extends any>(
  grid: ds_grid<T>,
  x: int,
  y: int,
  val: T,
): any;
declare function ds_grid_multiply<T extends any>(
  grid: ds_grid<T>,
  x: int,
  y: int,
  val: T,
): any;
declare function ds_grid_set_region<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  val: T,
): any;
declare function ds_grid_add_region<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  val: T,
): any;
declare function ds_grid_multiply_region<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  val: T,
): any;
declare function ds_grid_set_disk<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
  val: T,
): any;
declare function ds_grid_add_disk<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
  val: T,
): any;
declare function ds_grid_multiply_disk<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
  val: T,
): any;
declare function ds_grid_set_grid_region<T extends any>(
  grid: ds_grid<T>,
  source: any,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  xpos: any,
  ypos: any,
): any;
declare function ds_grid_add_grid_region<T extends any>(
  grid: ds_grid<T>,
  source: any,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  xpos: any,
  ypos: any,
): any;
declare function ds_grid_multiply_grid_region<T extends any>(
  grid: ds_grid<T>,
  source: any,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  xpos: any,
  ypos: any,
): any;
declare function ds_grid_get_sum<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
): T;
declare function ds_grid_get_max<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
): T;
declare function ds_grid_get_min<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
): T;
declare function ds_grid_get_mean<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
): T;
declare function ds_grid_get_disk_sum<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
): T;
declare function ds_grid_get_disk_min<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
): T;
declare function ds_grid_get_disk_max<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
): T;
declare function ds_grid_get_disk_mean<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
): T;
declare function ds_grid_value_exists<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  val: T,
): bool;
declare function ds_grid_value_x<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  val: T,
): int;
declare function ds_grid_value_y<T extends any>(
  grid: ds_grid<T>,
  x1: int,
  y1: int,
  x2: int,
  y2: int,
  val: T,
): int;
declare function ds_grid_value_disk_exists<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
  val: T,
): bool;
declare function ds_grid_value_disk_x<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
  val: T,
): int;
declare function ds_grid_value_disk_y<T extends any>(
  grid: ds_grid<T>,
  xm: number,
  ym: number,
  r: number,
  val: T,
): int;
declare function ds_grid_shuffle<T extends any>(grid: ds_grid<T>): any;
declare function ds_grid_write<T extends any>(grid: ds_grid<T>): string;
declare function ds_grid_read<T extends any>(
  grid: ds_grid<T>,
  str: string,
  legacy?: boolean,
): any;
declare function ds_grid_sort<T extends any>(
  grid: ds_grid<T>,
  column: int,
  ascending: boolean,
): any;
declare function ds_grid_set<T extends any>(
  grid: ds_grid<T>,
  x: int,
  y: int,
  value: T,
): any;
declare function ds_grid_get<T extends any>(
  grid: ds_grid<T>,
  x: int,
  y: any,
): any;
declare function effect_create_below(
  kind: effect_kind,
  x: number,
  y: number,
  size: int,
  col: int,
): void;
declare function effect_create_above(
  kind: effect_kind,
  x: number,
  y: number,
  size: int,
  col: int,
): void;
declare function effect_clear(): any;
declare function part_type_create(): particle;
declare function part_type_destroy(ind: particle): void;
declare function part_type_exists(ind: particle): bool;
declare function part_type_clear(ind: particle): void;
declare function part_type_shape(ind: particle, shape: particle_shape): void;
declare function part_type_sprite(
  ind: particle,
  sprite: sprites,
  animat: boolean,
  stretch: boolean,
  random: boolean,
): void;
declare function part_type_size(
  ind: particle,
  size_min: number,
  size_max: number,
  size_incr: number,
  size_wiggle: number,
): void;
declare function part_type_scale(
  ind: particle,
  xscale: number,
  yscale: number,
): void;
declare function part_type_orientation(
  ind: particle,
  ang_min: number,
  ang_max: number,
  ang_incr: number,
  ang_wiggle: number,
  ang_relative: boolean,
): void;
declare function part_type_life(
  ind: particle,
  life_min: number,
  life_max: number,
): void;
declare function part_type_step(
  ind: particle,
  step_number: int,
  step_type: particle,
): void;
declare function part_type_death(
  ind: particle,
  death_number: int,
  death_type: particle,
): void;
declare function part_type_speed(
  ind: particle,
  speed_min: number,
  speed_max: number,
  speed_incr: number,
  speed_wiggle: number,
): void;
declare function part_type_direction(
  ind: particle,
  dir_min: number,
  dir_max: number,
  dir_incr: number,
  dir_wiggle: number,
): void;
declare function part_type_gravity(
  ind: particle,
  grav_amount: number,
  grav_dir: number,
): void;
declare function part_type_colour1(ind: particle, colour1: int): void;
declare function part_type_colour2(
  ind: particle,
  colour1: int,
  colour2: int,
): void;
declare function part_type_colour3(
  ind: particle,
  colour1: int,
  colour2: int,
  colour3: int,
): void;
declare function part_type_colour_mix(
  ind: particle,
  colour1: int,
  colour2: int,
): void;
declare function part_type_colour_rgb(
  ind: particle,
  rmin: int,
  rmax: int,
  gmin: int,
  gmax: int,
  bmin: int,
  bmax: int,
): void;
declare function part_type_colour_hsv(
  ind: particle,
  hmin: number,
  hmax: number,
  smin: number,
  smax: number,
  vmin: number,
  vmax: number,
): void;
declare function part_type_color1(ind: particle, color1: int): void;
declare function part_type_color2(
  ind: particle,
  color1: int,
  color2: int,
): void;
declare function part_type_color3(
  ind: particle,
  color1: int,
  color2: int,
  color3: int,
): void;
declare function part_type_color_mix(
  ind: particle,
  color1: int,
  color2: int,
): void;
declare function part_type_color_rgb(
  ind: particle,
  rmin: int,
  rmax: int,
  gmin: int,
  gmax: int,
  bmin: int,
  bmax: int,
): void;
declare function part_type_color_hsv(
  ind: particle,
  hmin: number,
  hmax: number,
  smin: number,
  smax: number,
  vmin: number,
  vmax: number,
): void;
declare function part_type_alpha1(ind: particle, alpha1: number): void;
declare function part_type_alpha2(
  ind: particle,
  alpha1: number,
  alpha2: number,
): void;
declare function part_type_alpha3(
  ind: particle,
  alpha1: number,
  alpha2: number,
  alpha3: number,
): void;
declare function part_type_blend(ind: particle, additive: boolean): void;
declare function part_system_create(): particle_system;
declare function part_system_create_layer(
  layer: layer | string,
  persistent: boolean,
): particle_system;
declare function part_system_destroy(ind: particle_system): void;
declare function part_system_exists(ind: particle_system): bool;
declare function part_system_clear(ind: particle_system): void;
declare function part_system_draw_order(
  ind: particle_system,
  oldtonew: boolean,
): void;
declare function part_system_depth(ind: particle_system, depth: number): void;
declare function part_system_position(
  ind: particle_system,
  x: number,
  y: number,
): void;
declare function part_system_automatic_update(
  ind: particle_system,
  automatic: boolean,
): void;
declare function part_system_automatic_draw(
  ind: particle_system,
  draw: boolean,
): void;
declare function part_system_update(ind: particle_system): void;
declare function part_system_drawit(ind: particle_system): void;
declare function part_system_get_layer(ind: particle_system): layer;
declare function part_system_layer(
  ind: particle_system,
  layer: layer | string,
): void;
declare function part_particles_create(
  ind: particle_system,
  x: number,
  y: number,
  parttype: particle,
  number: int,
): void;
declare function part_particles_create_colour(
  ind: particle_system,
  x: number,
  y: number,
  parttype: particle,
  colour: int,
  number: int,
): void;
declare function part_particles_create_color(
  ind: particle_system,
  x: number,
  y: number,
  parttype: particle,
  color: int,
  number: int,
): void;
declare function part_particles_clear(ind: particle_system): void;
declare function part_particles_count(ind: particle_system): int;
declare function part_emitter_create(ps: particle_system): particle_emitter;
declare function part_emitter_destroy(
  ps: particle_system,
  emitter: particle_emitter,
): void;
declare function part_emitter_destroy_all(ps: particle_system): void;
declare function part_emitter_exists(
  ps: particle_system,
  ind: particle_emitter,
): bool;
declare function part_emitter_clear(
  ps: particle_system,
  ind: particle_emitter,
): void;
declare function part_emitter_region(
  ps: particle_system,
  ind: particle_emitter,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  shape: particle_region_shape,
  distribution: particle_distribution,
): void;
declare function part_emitter_burst(
  ps: particle_system,
  ind: particle_emitter,
  parttype: particle,
  number: int,
): void;
declare function part_emitter_stream(
  ps: particle_system,
  ind: particle_emitter,
  parttype: particle,
  number: int,
): void;
declare function external_define(
  dll_path: string,
  func_name: string,
  calltype: external_call_type,
  restype: external_value_type,
  argnumb: number,
  ...argtypes: external_value_type[]
): external_function;
declare function external_call(
  func: external_function,
  ...arguments: undefined[]
): any;
declare function external_free(dllname: string): any;
declare function window_handle(): pointer;
declare function window_device(): pointer;
declare function matrix_get(type: matrix_type): number[];
declare function matrix_set(type: matrix_type, matrix: number[]): void;
declare function matrix_build(
  x: number,
  y: number,
  z: number,
  xrotation: number,
  yrotation: number,
  zrotation: number,
  xscale: number,
  yscale: number,
  zscale: number,
): number[];
declare function matrix_multiply(matrix: number[], matrix: number[]): number[];
declare function browser_input_capture(enable: boolean): void;
declare function os_get_config(): string;
declare function os_get_info(): ds_map<string, any>;
declare function os_get_language(): string;
declare function os_get_region(): string;
declare function os_check_permission(
  permission: string,
): android_permission_state;
declare function os_request_permission(permission: string): void;
declare function os_lock_orientation(flag: boolean): void;
declare function display_get_dpi_x(): number;
declare function display_get_dpi_y(): number;
declare function display_set_gui_size(width: number, height: number): void;
declare function display_set_gui_maximise(
  xscale?: number,
  yscale?: number,
  xoffset?: number,
  yoffset?: number,
): void;
declare function display_set_gui_maximize(
  xscale?: number,
  yscale?: number,
  xoffset?: number,
  yoffset?: number,
): void;
declare function device_mouse_dbclick_enable(enable: boolean): void;
declare function virtual_key_add(
  x: number,
  y: number,
  w: number,
  h: number,
  keycode: int,
): virtual_key;
declare function virtual_key_hide(id: virtual_key): void;
declare function virtual_key_delete(id: virtual_key): void;
declare function virtual_key_show(id: virtual_key): void;
declare function draw_enable_drawevent(enable: boolean): void;
declare function draw_enable_swf_aa(enable: boolean): void;
declare function draw_set_swf_aa_level(aa_level: number): void;
declare function draw_get_swf_aa_level(): number;
declare function draw_texture_flush(): void;
declare function draw_flush(): void;
declare function shop_leave_rating(
  text_string: string,
  yes_string: string,
  no_string: string,
  url: string,
): void;
declare function url_get_domain(): string;
declare function url_open(url: string): void;
declare function url_open_ext(url: string, target: string): void;
declare function url_open_full(
  url: string,
  target: string,
  options: string,
): void;
declare function get_timer(): int;
declare function achievement_login(): void;
declare function achievement_logout(): void;
declare function achievement_post(
  achievement_name: string,
  value: number,
): void;
declare function achievement_increment(
  achievement_name: string,
  value: number,
): void;
declare function achievement_post_score(
  score_name: string,
  value: number,
): void;
declare function achievement_available(): bool;
declare function achievement_show_achievements(): bool;
declare function achievement_show_leaderboards(): bool;
declare function achievement_load_friends(): bool;
declare function achievement_load_leaderboard(
  ident: string,
  minindex: int,
  maxindex: int,
  filter: achievement_leaderboard_filter,
): void;
declare function achievement_send_challenge(
  to: string,
  challengeid: string,
  score: number,
  type: achievement_challenge_type,
  msg: string,
): void;
declare function achievement_load_progress(): void;
declare function achievement_reset(): void;
declare function achievement_login_status(): bool;
declare function achievement_get_pic(char: string): void;
declare function achievement_show_challenge_notifications(
  receive_challenge: boolean,
  local_complete: boolean,
  remote_complete: boolean,
): void;
declare function achievement_get_challenges(): void;
declare function achievement_event(stringid: string): void;
declare function achievement_show(type: achievement_show_type, val: any): void;
declare function achievement_get_info(userid: string): void;
declare function cloud_file_save(filename: string, description: string): int;
declare function cloud_string_save(data: string, description: string): int;
declare function cloud_synchronise(): int;
declare function device_get_tilt_x(): number;
declare function device_get_tilt_y(): number;
declare function device_get_tilt_z(): number;
declare function device_is_keypad_open(): bool;
declare function device_mouse_check_button(
  device: int,
  button: mouse_button,
): bool;
declare function device_mouse_check_button_pressed(
  device: int,
  button: mouse_button,
): bool;
declare function device_mouse_check_button_released(
  device: int,
  button: mouse_button,
): bool;
declare function device_mouse_x(device: int): number;
declare function device_mouse_y(device: int): number;
declare function device_mouse_raw_x(device: int): number;
declare function device_mouse_raw_y(device: int): number;
declare function device_mouse_x_to_gui(device: int): number;
declare function device_mouse_y_to_gui(device: int): number;
declare function iap_activate(ds_list: ds_list<ds_map<string, any>>): void;
declare function iap_status(): iap_system_status;
declare function iap_enumerate_products(
  ds_list: ds_list<ds_map<string, any>>,
): void;
declare function iap_restore_all(): void;
declare function iap_acquire(product_id: string, payload: string): int;
declare function iap_consume(product_id: string): void;
declare function iap_product_details(
  product_id: string,
  ds_map: ds_map<string, any>,
): void;
declare function iap_purchase_details(
  purchase_id: string,
  ds_map: ds_map<string, any>,
): void;
declare function gamepad_is_supported(): bool;
declare function gamepad_get_device_count(): int;
declare function gamepad_is_connected(device: int): bool;
declare function gamepad_get_description(device: int): string;
declare function gamepad_get_button_threshold(device: int): number;
declare function gamepad_set_button_threshold(
  device: int,
  threshold: number,
): void;
declare function gamepad_get_axis_deadzone(device: int): number;
declare function gamepad_set_axis_deadzone(device: int, deadzone: number): void;
declare function gamepad_button_count(device: int): int;
declare function gamepad_button_check(
  device: int,
  buttonIndex: gamepad_button,
): bool;
declare function gamepad_button_check_pressed(
  device: int,
  buttonIndex: gamepad_button,
): bool;
declare function gamepad_button_check_released(
  device: int,
  buttonIndex: gamepad_button,
): bool;
declare function gamepad_button_value(
  device: int,
  buttonIndex: gamepad_button,
): number;
declare function gamepad_axis_count(device: int): int;
declare function gamepad_axis_value(
  device: int,
  axisIndex: gamepad_button,
): number;
declare function gamepad_set_vibration(
  device: int,
  leftMotorSpeed: number,
  rightMotorSpeed: number,
): void;
declare function gamepad_set_colour(index: int, colour: int): void;
declare function gamepad_set_color(index: int, color: int): void;
declare function os_is_paused(): bool;
declare function window_has_focus(): bool;
declare function code_is_compiled(): bool;
declare function http_get(url: string): int;
declare function http_get_file(url: string, dest: string): int;
declare function http_post_string(url: string, string: string): int;
declare function http_request(
  url: string,
  method: string,
  header_map: ds_map<string, string>,
  body: string,
): int;
declare function http_get_request_crossorigin(): string;
declare function http_set_request_crossorigin(crossorigin_type: string): void;
declare function json_encode(ds_map: ds_map<string, any>): string;
declare function json_decode(string: string): ds_map<string, any>;
declare function zip_unzip(file: string, destPath: string): int;
declare function load_csv(filename: string): ds_grid<string>;
declare function base64_encode(string: string): string;
declare function base64_decode(string: string): string;
declare function md5_string_unicode(string: string): string;
declare function md5_string_utf8(string: string): string;
declare function md5_file(fname: string): string;
declare function sha1_string_unicode(string: string): string;
declare function sha1_string_utf8(string: string): string;
declare function sha1_file(fname: string): string;
declare function os_is_network_connected(attempt_connection?: boolean): bool;
declare function os_powersave_enable(enable: boolean): void;
declare function physics_world_create(PixelToMetreScale: number): void;
declare function physics_world_gravity(gx: number, gy: number): void;
declare function physics_world_update_speed(speed: int): void;
declare function physics_world_update_iterations(iterations: int): void;
declare function physics_world_draw_debug(draw_flags: physics_debug_flag): void;
declare function physics_pause_enable(pause: boolean): void;
declare function physics_fixture_create(): physics_fixture;
declare function physics_fixture_set_kinematic(fixture: physics_fixture): void;
declare function physics_fixture_set_density(
  fixture: physics_fixture,
  density: number,
): void;
declare function physics_fixture_set_awake(
  fixture: physics_fixture,
  awake: boolean,
): void;
declare function physics_fixture_set_restitution(
  fixture: physics_fixture,
  restitution: number,
): void;
declare function physics_fixture_set_friction(
  fixture: physics_fixture,
  friction: number,
): void;
declare function physics_fixture_set_collision_group(
  fixture: physics_fixture,
  group: int,
): void;
declare function physics_fixture_set_sensor(
  fixture: physics_fixture,
  is_sensor: boolean,
): void;
declare function physics_fixture_set_linear_damping(
  fixture: physics_fixture,
  damping: number,
): void;
declare function physics_fixture_set_angular_damping(
  fixture: physics_fixture,
  damping: number,
): void;
declare function physics_fixture_set_circle_shape(
  fixture: physics_fixture,
  circleRadius: number,
): void;
declare function physics_fixture_set_box_shape(
  fixture: physics_fixture,
  halfWidth: number,
  halfHeight: number,
): void;
declare function physics_fixture_set_edge_shape(
  fixture: physics_fixture,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void;
declare function physics_fixture_set_polygon_shape(
  fixture: physics_fixture,
): void;
declare function physics_fixture_set_chain_shape(
  fixture: physics_fixture,
  loop: boolean,
): void;
declare function physics_fixture_add_point(
  fixture: physics_fixture,
  local_x: number,
  local_y: number,
): void;
declare function physics_fixture_bind<T extends instance | objects>(
  fixture: physics_fixture,
  obj: T,
): physics_fixture;
declare function physics_fixture_bind_ext<T extends instance | objects>(
  fixture: physics_fixture,
  obj: T,
  xo: number,
  yo: number,
): physics_fixture;
declare function physics_fixture_delete(fixture: physics_fixture): void;
declare function physics_apply_force(
  xpos: number,
  ypos: number,
  xforce: number,
  yforce: number,
): void;
declare function physics_apply_impulse(
  xpos: number,
  ypos: number,
  ximpulse: number,
  yimpulse: number,
): void;
declare function physics_apply_angular_impulse(impulse: number): void;
declare function physics_apply_local_force(
  xlocal: number,
  ylocal: number,
  xforce_local: number,
  yforce_local: number,
): void;
declare function physics_apply_local_impulse(
  xlocal: number,
  ylocal: number,
  ximpulse_local: number,
  yimpulse_local: number,
): void;
declare function physics_apply_torque(torque: number): void;
declare function physics_mass_properties(
  mass: number,
  local_centre_of_mass_x: number,
  local_centre_of_mass_y: number,
  inertia: number,
): void;
declare function physics_draw_debug(): void;
declare function physics_test_overlap<T extends instance | objects>(
  x: number,
  y: number,
  angle: number,
  obj: T,
): bool;
declare function physics_remove_fixture<T extends any>(
  inst: T,
  id: physics_fixture,
): void;
declare function physics_set_friction(
  fixture: physics_fixture,
  friction: number,
): void;
declare function physics_set_density(
  fixture: physics_fixture,
  density: number,
): void;
declare function physics_set_restitution(
  fixture: physics_fixture,
  restitution: number,
): void;
declare function physics_get_friction(fixture: physics_fixture): number;
declare function physics_get_density(fixture: physics_fixture): number;
declare function physics_get_restitution(fixture: physics_fixture): number;
declare function physics_joint_distance_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_1_x: number,
  anchor_1_y: number,
  anchor_2_x: number,
  anchor_2_y: number,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_rope_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_1_x: number,
  anchor_1_y: number,
  anchor_2_x: number,
  anchor_2_y: number,
  maxLength: number,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_revolute_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_x: number,
  anchor_y: number,
  lower_angle_limit: number,
  upper_angle_limit: number,
  enable_limit: number,
  max_motor_torque: number,
  motor_speed: number,
  enable_motor: boolean,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_prismatic_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_x: number,
  anchor_y: number,
  axis_x: number,
  axis_y: number,
  lower_translation_limit: number,
  upper_translation_limit: number,
  enable_limit: boolean,
  max_motor_force: number,
  motor_speed: number,
  enable_motor: boolean,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_pulley_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_1_x: number,
  anchor_1_y: number,
  anchor_2_x: number,
  anchor_2_y: number,
  local_anchor_1_x: number,
  local_anchor_1_y: number,
  local_anchor_2_x: number,
  local_anchor_2_y: number,
  ratio: number,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_wheel_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_x: number,
  anchor_y: number,
  axis_x: number,
  axis_y: number,
  enableMotor: boolean,
  max_motor_torque: number,
  motor_speed: number,
  freq_hz: number,
  damping_ratio: number,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_weld_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_x: number,
  anchor_y: number,
  ref_angle: number,
  freq_hz: number,
  damping_ratio: number,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_friction_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  anchor_x: number,
  anchor_y: number,
  max_force: number,
  max_torque: number,
  collideInstances: boolean,
): physics_joint;
declare function physics_joint_gear_create<
  T0 extends instance,
  T1 extends instance,
>(
  inst1: T0,
  inst2: T1,
  revoluteJoint: physics_joint,
  prismaticJoint: physics_joint,
  ratio: number,
): physics_joint;
declare function physics_joint_enable_motor(
  joint: physics_joint,
  motorState: boolean,
): void;
declare function physics_joint_get_value(
  joint: physics_joint,
  field: physics_joint_value,
): number | bool;
declare function physics_joint_set_value(
  joint: physics_joint,
  field: physics_joint_value,
  value: number | bool,
): physics_joint_value;
declare function physics_joint_delete(joint: physics_joint): void;
declare function physics_particle_create(
  typeflags: physics_particle_flag,
  x: number,
  y: number,
  xv: number,
  yv: number,
  col: int,
  alpha: number,
  category: int,
): physics_particle;
declare function physics_particle_delete(ind: physics_particle): void;
declare function physics_particle_delete_region_circle(
  x: number,
  y: number,
  radius: number,
): void;
declare function physics_particle_delete_region_box(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
): void;
declare function physics_particle_delete_region_poly(
  pointList: ds_list<number>,
): void;
declare function physics_particle_set_flags(
  ind: physics_particle,
  typeflags: physics_particle_flag,
): void;
declare function physics_particle_set_category_flags(
  category: int,
  typeflags: physics_particle_flag,
): void;
declare function physics_particle_draw(
  typemask: physics_particle_flag,
  category: int,
  sprite: sprites,
  subimg: int,
): void;
declare function physics_particle_draw_ext(
  typemask: physics_particle_flag,
  category: int,
  sprite: sprites,
  subimg: int,
  xscale: number,
  yscale: number,
  angle: number,
  col: int,
  alpha: number,
): void;
declare function physics_particle_count(): int;
declare function physics_particle_get_data(
  buffer: buffer,
  dataFlags: physics_particle_data_flag,
): void;
declare function physics_particle_get_data_particle(
  ind: physics_particle,
  buffer: buffer,
  dataFlags: physics_particle_data_flag,
): void;
declare function physics_particle_group_begin(
  typeflags: physics_particle_flag,
  groupflags: physics_particle_group_flag,
  x: number,
  y: number,
  ang: number,
  xv: number,
  yv: number,
  angVelocity: number,
  col: int,
  alpha: number,
  strength: number,
  category: int,
): void;
declare function physics_particle_group_circle(radius: number): void;
declare function physics_particle_group_box(
  halfWidth: number,
  halfHeight: number,
): void;
declare function physics_particle_group_polygon(): void;
declare function physics_particle_group_add_point(x: number, y: number): void;
declare function physics_particle_group_end(): physics_particle_group;
declare function physics_particle_group_join(
  to: physics_particle_group,
  from: physics_particle_group,
): void;
declare function physics_particle_group_delete(
  ind: physics_particle_group,
): void;
declare function physics_particle_group_count(
  group: physics_particle_group,
): int;
declare function physics_particle_group_get_data(
  group: physics_particle_group,
  buffer: buffer,
  dataFlags: physics_particle_data_flag,
): void;
declare function physics_particle_group_get_mass(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_inertia(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_centre_x(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_centre_y(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_vel_x(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_vel_y(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_ang_vel(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_x(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_y(
  group: physics_particle_group,
): number;
declare function physics_particle_group_get_angle(
  group: physics_particle_group,
): number;
declare function physics_particle_set_group_flags(
  group: physics_particle_group,
  groupflags: physics_particle_group_flag,
): void;
declare function physics_particle_get_group_flags(
  group: physics_particle_group,
): physics_particle_group_flag;
declare function physics_particle_get_max_count(): int;
declare function physics_particle_get_radius(): number;
declare function physics_particle_get_density(): number;
declare function physics_particle_get_damping(): number;
declare function physics_particle_get_gravity_scale(): number;
declare function physics_particle_set_max_count(count: int): void;
declare function physics_particle_set_radius(radius: number): void;
declare function physics_particle_set_density(density: number): void;
declare function physics_particle_set_damping(damping: number): void;
declare function physics_particle_set_gravity_scale(scale: number): void;
declare function network_create_socket(type: network_type): network_socket;
declare function network_create_socket_ext(
  type: network_type,
  port: int,
): network_socket;
declare function network_create_server(
  type: network_type,
  port: int,
  maxclients: int,
): network_server;
declare function network_create_server_raw(
  type: network_type,
  port: int,
  maxclients: int,
): network_server;
declare function network_connect(
  socket: network_socket,
  url: string,
  port: int,
): int;
declare function network_connect_raw(
  socket: network_socket,
  url: string,
  port: int,
): int;
declare function network_connect_async(
  socket: network_socket,
  url: string,
  port: int,
): int;
declare function network_connect_raw_async(
  socket: network_socket,
  url: string,
  port: int,
): int;
declare function network_send_packet(
  socket: network_socket,
  bufferid: buffer,
  size: int,
): int;
declare function network_send_raw(
  socket: network_socket,
  bufferid: buffer,
  size: int,
): int;
declare function network_send_broadcast(
  socket: network_socket,
  port: int,
  bufferid: buffer,
  size: int,
): int;
declare function network_send_udp(
  socket: network_socket,
  URL: string,
  port: int,
  bufferid: buffer,
  size: int,
): int;
declare function network_send_udp_raw(
  socket: network_socket,
  URL: string,
  port: int,
  bufferid: buffer,
  size: int,
): int;
declare function network_set_timeout(
  socket: network_socket,
  read: int,
  write: int,
): void;
declare function network_set_config(
  parameter: network_config,
  value: network_socket | int | bool,
): void;
declare function network_resolve(url: string): string;
declare function network_destroy(socket: network_socket | network_server): void;
declare function buffer_create(
  size: int,
  buffer_kind: buffer_kind,
  alignment: int,
): buffer;
declare function buffer_write(
  buffer: buffer,
  type: buffer_type,
  value: buffer_auto_type,
): int;
declare function buffer_read(
  buffer: buffer,
  type: buffer_type,
): buffer_auto_type;
declare function buffer_seek(
  buffer: buffer,
  base: buffer_seek_base,
  offset: int,
): void;
declare function buffer_delete(buffer: buffer): void;
declare function buffer_exists(buffer: buffer): bool;
declare function buffer_get_type(buffer: buffer): buffer_kind;
declare function buffer_get_alignment(buffer: buffer): int;
declare function buffer_poke(
  buffer: buffer,
  offset: int,
  type: buffer_type,
  value: buffer_auto_type,
): void;
declare function buffer_peek(
  buffer: buffer,
  offset: int,
  type: buffer_type,
): buffer_auto_type;
declare function buffer_save(buffer: buffer, filename: string): void;
declare function buffer_save_ext(
  buffer: buffer,
  filename: string,
  offset: int,
  size: int,
): void;
declare function buffer_load(filename: string): buffer;
declare function buffer_load_ext(
  buffer: buffer,
  filename: string,
  offset: int,
): void;
declare function buffer_load_partial(
  buffer: buffer,
  filename: string,
  src_offset: int,
  src_len: int,
  dest_offset: int,
): void;
declare function buffer_copy(
  src_buffer: buffer,
  src_offset: int,
  size: int,
  dest_buffer: buffer,
  dest_offset: int,
): void;
declare function buffer_fill(
  buffer: buffer,
  offset: int,
  type: buffer_type,
  value: buffer_auto_type,
  size: int,
): void;
declare function buffer_get_size(buffer: buffer): int;
declare function buffer_tell(buffer: buffer): int;
declare function buffer_resize(buffer: buffer, newsize: int): void;
declare function buffer_md5(buffer: buffer, offset: int, size: int): string;
declare function buffer_sha1(buffer: buffer, offset: int, size: int): string;
declare function buffer_crc32(buffer: buffer, offset: int, size: int): int;
declare function buffer_base64_encode(
  buffer: buffer,
  offset: int,
  size: int,
): string;
declare function buffer_base64_decode(string: string): buffer;
declare function buffer_base64_decode_ext(
  buffer: buffer,
  string: string,
  offset: int,
): void;
declare function buffer_sizeof(type: buffer_type): int;
declare function buffer_get_address(buffer: buffer): pointer;
declare function buffer_create_from_vertex_buffer(
  vertex_buffer: vertex_buffer,
  kind: buffer_kind,
  alignment: int,
): buffer;
declare function buffer_create_from_vertex_buffer_ext(
  vertex_buffer: vertex_buffer,
  kind: buffer_kind,
  alignment: int,
  start_vertex: int,
  num_vertices: int,
): buffer;
declare function buffer_copy_from_vertex_buffer(
  vertex_buffer: vertex_buffer,
  start_vertex: int,
  num_vertices: int,
  dest_buffer: buffer,
  dest_offset: int,
): void;
declare function buffer_async_group_begin(groupname: string): void;
declare function buffer_async_group_option(
  optionname: string,
  optionvalue: number | bool | string,
): void;
declare function buffer_async_group_end(): int;
declare function buffer_load_async(
  bufferid: buffer,
  filename: string,
  offset: int,
  size: int,
): int;
declare function buffer_save_async(
  bufferid: buffer,
  filename: string,
  offset: int,
  size: int,
): int;
declare function buffer_compress(
  bufferid: buffer,
  offset: int,
  size: int,
): buffer;
declare function buffer_decompress(bufferId: buffer): buffer;
declare function gml_release_mode(enable: boolean): void;
declare function gml_pragma(setting: string, ...parameters: string[]): void;
declare function steam_activate_overlay(overlayIndex: steam_overlay_page): void;
declare function steam_is_overlay_enabled(): bool;
declare function steam_is_overlay_activated(): bool;
declare function steam_get_persona_name(): string;
declare function steam_initialised(): bool;
declare function steam_is_cloud_enabled_for_app(): bool;
declare function steam_is_cloud_enabled_for_account(): bool;
declare function steam_file_persisted(filename: string): bool;
declare function steam_get_quota_total(): int;
declare function steam_get_quota_free(): int;
declare function steam_file_write(
  steam_filename: string,
  data: string,
  size: int,
): int;
declare function steam_file_write_file(
  steam_filename: string,
  local_filename: string,
): int;
declare function steam_file_read(filename: string): string;
declare function steam_file_delete(filename: string): int;
declare function steam_file_exists(filename: string): bool;
declare function steam_file_size(filename: string): int;
declare function steam_file_share(filename: string): int;
declare function steam_is_screenshot_requested(): bool;
declare function steam_send_screenshot(
  filename: string,
  width: int,
  height: int,
): int;
declare function steam_is_user_logged_on(): bool;
declare function steam_get_user_steam_id(): int;
declare function steam_user_owns_dlc(dlc_id: int): bool;
declare function steam_user_installed_dlc(dlc_id: int): bool;
declare function steam_set_achievement(ach_name: string): void;
declare function steam_get_achievement(ach_name: string): bool;
declare function steam_clear_achievement(ach_name: string): void;
declare function steam_set_stat_int(stat_name: string, value: int): void;
declare function steam_set_stat_float(stat_name: string, value: number): void;
declare function steam_set_stat_avg_rate(
  stat_name: string,
  session_count: number,
  session_length: number,
): void;
declare function steam_get_stat_int(stat_name: string): int;
declare function steam_get_stat_float(stat_name: string): number;
declare function steam_get_stat_avg_rate(stat_name: string): number;
declare function steam_reset_all_stats(): void;
declare function steam_reset_all_stats_achievements(): void;
declare function steam_stats_ready(): bool;
declare function steam_create_leaderboard(
  lb_name: string,
  sort_method: steam_leaderboard_sort_type,
  display_type: steam_leaderboard_display_type,
): int;
declare function steam_upload_score(lb_name: string, score: number): int;
declare function steam_upload_score_ext(
  lb_name: string,
  score: number,
  forceupdate: boolean,
): int;
declare function steam_download_scores_around_user(
  lb_name: string,
  range_start: int,
  range_end: int,
): int;
declare function steam_download_scores(
  lb_name: string,
  start_idx: int,
  end_idx: int,
): int;
declare function steam_download_friends_scores(lb_name: string): int;
declare function steam_upload_score_buffer(
  lb_name: string,
  score: number,
  buffer_id: buffer,
): int;
declare function steam_upload_score_buffer_ext(
  lb_name: string,
  score: number,
  buffer_id: number,
  forceupdate: boolean,
): int;
declare function steam_current_game_language(): string;
declare function steam_available_languages(): string;
declare function steam_activate_overlay_browser(url: string): void;
declare function steam_activate_overlay_user(
  dialog_name: string,
  steamid: steam_id,
): void;
declare function steam_activate_overlay_store(app_id: int): void;
declare function steam_get_user_persona_name(steam_id: steam_id): int;
declare function steam_get_app_id(): int;
declare function steam_get_user_account_id(): steam_id;
declare function steam_ugc_download(
  ugc_handle: steam_ugc,
  dest_filename: string,
): int;
declare function steam_ugc_create_item(
  consumer_app_id: int,
  file_type: steam_ugc_type,
): int;
declare function steam_ugc_start_item_update(
  consumer_app_id: int,
  published_file_id: steam_ugc,
): int;
declare function steam_ugc_set_item_title(
  ugc_update_handle: steam_ugc,
  title: string,
): bool;
declare function steam_ugc_set_item_description(
  ugc_update_handle: steam_ugc,
  description: string,
): bool;
declare function steam_ugc_set_item_visibility(
  ugc_update_handle: steam_ugc,
  visibility: steam_ugc_visibility,
): bool;
declare function steam_ugc_set_item_tags(
  ugc_update_handle: steam_ugc,
  tag_array: string[],
): bool;
declare function steam_ugc_set_item_content(
  ugc_update_handle: steam_ugc,
  directory: string,
): bool;
declare function steam_ugc_set_item_preview(
  ugc_update_handle: steam_ugc,
  image_path: string,
): bool;
declare function steam_ugc_submit_item_update(
  ugc_update_handle: steam_ugc,
  change_note: string,
): int;
declare function steam_ugc_get_item_update_progress(
  ugc_update_handle: steam_ugc,
  info_map: ds_map<string, any>,
): bool;
declare function steam_ugc_subscribe_item(published_file_id: steam_ugc): int;
declare function steam_ugc_unsubscribe_item(published_file_id: steam_ugc): int;
declare function steam_ugc_num_subscribed_items(): int;
declare function steam_ugc_get_subscribed_items(
  item_list: ds_list<steam_ugc>,
): bool;
declare function steam_ugc_get_item_install_info(
  published_file_id: steam_ugc,
  info_map: ds_map<string, any>,
): bool;
declare function steam_ugc_get_item_update_info(
  published_file_id: steam_ugc,
  info_map: ds_map<string, any>,
): bool;
declare function steam_ugc_request_item_details(
  published_file_id: steam_ugc,
  max_age_seconds: int,
): int;
declare function steam_ugc_create_query_user(
  list_type: steam_ugc_query_list_type,
  match_type: steam_ugc_query_match_type,
  sort_order: steam_ugc_query_sort_order,
  page: int,
): int;
declare function steam_ugc_create_query_user_ex(
  list_type: steam_ugc_query_list_type,
  match_type: steam_ugc_query_match_type,
  sort_order: steam_ugc_query_sort_order,
  page: int,
  account_id: steam_id,
  creator_app_id: steam_id,
  consumer_app_id: int,
): int;
declare function steam_ugc_create_query_all(
  query_type: steam_ugc_query_type,
  match_type: steam_ugc_query_match_type,
  page: int,
): int;
declare function steam_ugc_create_query_all_ex(
  query_type: steam_ugc_query_type,
  match_type: steam_ugc_query_match_type,
  page: int,
  creator_app_id: steam_id,
  consumer_app_id: int,
): int;
declare function steam_ugc_query_set_cloud_filename_filter(
  ugc_query_handle: steam_ugc_query,
  match_cloud_filename: boolean,
): bool;
declare function steam_ugc_query_set_match_any_tag(
  ugc_query_handle: steam_ugc_query,
  match_any_tag: boolean,
): bool;
declare function steam_ugc_query_set_search_text(
  ugc_query_handle: steam_ugc_query,
  search_text: string,
): bool;
declare function steam_ugc_query_set_ranked_by_trend_days(
  ugc_query: steam_ugc_query,
  days: number,
): bool;
declare function steam_ugc_query_add_required_tag(
  ugc_query_handle: steam_ugc_query,
  tag_name: string,
): bool;
declare function steam_ugc_query_add_excluded_tag(
  ugc_query_handle: steam_ugc_query,
  tag_name: string,
): bool;
declare function steam_ugc_query_set_return_long_description(
  ugc_query_handle: steam_ugc_query,
  return_long_desc: boolean,
): bool;
declare function steam_ugc_query_set_return_total_only(
  ugc_query_handle: steam_ugc_query,
  return_total_only: boolean,
): bool;
declare function steam_ugc_query_set_allow_cached_response(
  ugc_query_handle: steam_ugc_query,
  allow_cached_response: boolean,
): bool;
declare function steam_ugc_send_query(ugc_query_handle: steam_ugc_query): int;
declare function shader_set(shader: shaders): void;
declare function shader_get_name(shader: shaders): string;
declare function shader_reset(): void;
declare function shader_current(): shaders;
declare function shader_is_compiled(shader: shaders): bool;
declare function shader_get_sampler_index(
  shader: shaders,
  uniform_name: string,
): shader_sampler;
declare function shader_get_uniform(
  shader: shaders,
  uniform_name: string,
): shader_uniform;
declare function shader_set_uniform_i(
  uniform_id: shader_uniform,
  val1: int,
  val2?: int,
  val3?: int,
  val4?: int,
): void;
declare function shader_set_uniform_i_array(
  uniform_id: shader_uniform,
  array: int[],
): void;
declare function shader_set_uniform_f(
  uniform_id: shader_uniform,
  val1: number,
  val2?: number,
  val3?: number,
  val4?: number,
): void;
declare function shader_set_uniform_f_array(
  uniform_id: shader_uniform,
  array: number[],
): void;
declare function shader_set_uniform_matrix(uniform_id: shader_uniform): void;
declare function shader_set_uniform_matrix_array(
  uniform_id: shader_uniform,
  array: int[],
): void;
declare function shader_enable_corner_id(enable: boolean): void;
declare function texture_set_stage(
  sampled_id: shader_sampler,
  texture_id: texture,
): void;
declare function texture_get_texel_width(texture_id: texture): int;
declare function texture_get_texel_height(texture_id: texture): int;
declare function shaders_are_supported(): bool;
declare function vertex_format_begin(): void;
declare function vertex_format_end(): vertex_format;
declare function vertex_format_delete(format_id: vertex_format): void;
declare function vertex_format_add_position(): void;
declare function vertex_format_add_position_3d(): void;
declare function vertex_format_add_colour(): void;
declare function vertex_format_add_color(): void;
declare function vertex_format_add_normal(): void;
declare function vertex_format_add_texcoord(): void;
declare function vertex_format_add_custom(
  type: vertex_type,
  usage: vertex_usage,
): void;
declare function vertex_create_buffer(): vertex_buffer;
declare function vertex_create_buffer_ext(size: int): vertex_buffer;
declare function vertex_delete_buffer(vbuff: vertex_buffer): void;
declare function vertex_begin(
  vbuff: vertex_buffer,
  format: vertex_format,
): void;
declare function vertex_end(vbuff: vertex_buffer): void;
declare function vertex_position(
  vbuff: vertex_buffer,
  x: number,
  y: number,
): void;
declare function vertex_position_3d(
  vbuff: vertex_buffer,
  x: number,
  y: number,
  z: number,
): void;
declare function vertex_colour(
  vbuff: vertex_buffer,
  colour: int,
  alpha: number,
): void;
declare function vertex_color(
  vbuff: vertex_buffer,
  color: int,
  alpha: number,
): void;
declare function vertex_argb(vbuff: vertex_buffer, argb: int): void;
declare function vertex_texcoord(
  vbuff: vertex_buffer,
  u: number,
  v: number,
): void;
declare function vertex_normal(
  vbuff: vertex_buffer,
  nx: number,
  ny: number,
  nz: number,
): void;
declare function vertex_float1(vbuff: vertex_buffer, f1: number): void;
declare function vertex_float2(
  vbuff: vertex_buffer,
  f1: number,
  f2: number,
): void;
declare function vertex_float3(
  vbuff: vertex_buffer,
  f1: number,
  f2: number,
  f3: number,
): void;
declare function vertex_float4(
  vbuff: vertex_buffer,
  f1: number,
  f2: number,
  f3: number,
  f4: number,
): void;
declare function vertex_ubyte4(
  vbuff: vertex_buffer,
  b1: int,
  b2: int,
  b3: int,
  b4: int,
): void;
declare function vertex_submit(
  vbuff: vertex_buffer,
  prim: primitive_type,
  texture: texture,
): void;
declare function vertex_freeze(vbuff: vertex_buffer): void;
declare function vertex_get_number(vbuff: vertex_buffer): int;
declare function vertex_get_buffer_size(vbuff: vertex_buffer): int;
declare function vertex_create_buffer_from_buffer(
  src_buffer: buffer,
  format: vertex_format,
): vertex_buffer;
declare function vertex_create_buffer_from_buffer_ext(
  src_buffer: buffer,
  format: vertex_format,
  src_offset: int,
  num_vertices: int,
): vertex_buffer;
declare function push_local_notification(
  fire_time: datetime,
  title: string,
  message: string,
  data: string,
): void;
declare function push_get_first_local_notification(
  ds_map: ds_map<string, string>,
): int;
declare function push_get_next_local_notification(
  ds_map: ds_map<string, string>,
): int;
declare function push_cancel_local_notification(id: int): void;
declare function push_get_application_badge_number(): int;
declare function push_set_application_badge_number(num: int): void;
declare function skeleton_animation_set(anim_name: string): void;
declare function skeleton_animation_get(): string;
declare function skeleton_animation_mix(
  anim_from: string,
  anim_to: string,
  duration: number,
): void;
declare function skeleton_animation_set_ext(
  anim_name: string,
  track: int,
): void;
declare function skeleton_animation_get_ext(track: int): string;
declare function skeleton_animation_get_duration(anim_name: string): number;
declare function skeleton_animation_get_frames(anim_name: string): int;
declare function skeleton_animation_clear(track: int): void;
declare function skeleton_skin_set(skin_name: string): void;
declare function skeleton_skin_get(): string;
declare function skeleton_attachment_set(
  slot: string,
  attachment: string | sprites,
): any;
declare function skeleton_attachment_get(slot: string): string;
declare function skeleton_attachment_create(
  name: string,
  sprite: sprites,
  ind: int,
  xo: number,
  yo: number,
  xs: number,
  ys: number,
  rot: number,
): int;
declare function skeleton_attachment_create_colour(
  name: string,
  sprite: sprites,
  ind: int,
  xo: number,
  yo: number,
  xs: number,
  ys: number,
  rot: number,
  col: int,
  alpha: number,
): int;
declare function skeleton_attachment_create_color(
  name: string,
  sprite: sprites,
  ind: int,
  xo: number,
  yo: number,
  xs: number,
  ys: number,
  rot: number,
  col: int,
  alpha: number,
): int;
declare function skeleton_collision_draw_set(val: boolean): void;
declare function skeleton_bone_data_get(
  bone: string,
  map: ds_map<string, any>,
): void;
declare function skeleton_bone_data_set(
  bone: string,
  map: ds_map<string, any>,
): void;
declare function skeleton_bone_state_get(
  bone: string,
  map: ds_map<string, any>,
): void;
declare function skeleton_bone_state_set(
  bone: string,
  map: ds_map<string, any>,
): void;
declare function skeleton_slot_colour_set(
  slot: string,
  col: int,
  alpha: number,
): void;
declare function skeleton_slot_color_set(
  slot: string,
  col: int,
  alpha: number,
): void;
declare function skeleton_slot_colour_get(slot: string): int;
declare function skeleton_slot_color_get(slot: string): int;
declare function skeleton_slot_alpha_get(slot: string): number;
declare function skeleton_find_slot(
  x: number,
  y: number,
  list: ds_list<string>,
): void;
declare function skeleton_get_minmax(): number[];
declare function skeleton_get_num_bounds(): int;
declare function skeleton_get_bounds(index: int): number[];
declare function skeleton_animation_get_frame(track: int): int;
declare function skeleton_animation_set_frame(track: int, index: int): void;
declare function skeleton_animation_get_event_frames(
  anim_name: string,
  event_name: string,
): int[];
declare function draw_skeleton(
  sprite: sprites,
  animname: string,
  skinname: string,
  frame: int,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  col: int,
  alpha: number,
): void;
declare function draw_skeleton_time(
  sprite: sprites,
  animname: string,
  skinname: string,
  time: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  col: int,
  alpha: number,
): void;
declare function draw_skeleton_instance<T extends any>(
  instance: T,
  animname: string,
  skinname: string,
  frame: int,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  col: int,
  alpha: number,
): void;
declare function draw_skeleton_collision(
  sprite: sprites,
  animname: string,
  frame: int,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  col: int,
): void;
declare function draw_enable_skeleton_blendmodes(enable: boolean): void;
declare function draw_get_enable_skeleton_blendmodes(): bool;
declare function skeleton_animation_list(
  sprite: sprites,
  list: ds_list<string>,
): void;
declare function skeleton_skin_list(
  sprite: sprites,
  list: ds_list<string>,
): void;
declare function skeleton_bone_list(
  sprite: sprites,
  list: ds_list<string>,
): void;
declare function skeleton_slot_list(
  sprite: sprites,
  list: ds_list<string>,
): void;
declare function skeleton_slot_data(
  sprite: sprites,
  list: ds_list<ds_map<string, any>>,
): void;
declare function skeleton_slot_data_instance(
  list: ds_list<ds_map<string, any>>,
): any;
////#endregion
