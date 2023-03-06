#macro cfr_sprite "sprite"

#macro cf_sprite_style_normal	"normal"
#macro cf_sprite_style_fit		"fit"
#macro cf_sprite_style_stretch	"stretch"

function CakeframeSpriteRenderer(struct) constructor {
	type				= cfr_sprite; 
	#region Settable
	style				= struct_get_safe(struct, "style", cf_sprite_style_fit);
	sprite				= struct_get_safe(struct, "sprite", -1);
	subimage			= struct_get_safe(struct, "subimage", 0);
	scale				= real_to_point(struct_get_safe(struct, "scale", [1,1]));
	anchor				= struct_get_safe(struct, "anchor", cf_frame_center);
	offset				= struct_get_safe(struct, "offset", undefined);
	offset_proportional = struct_get_safe(struct, "offset_proportional", false);
	alignment			= struct_get_safe(struct, "alignment", cf_align_center);
	alpha				= struct_get_safe(struct, "alpha", 1)
	rotation			= struct_get_safe(struct, "rotation", 0);
	color				= struct_get_safe(struct, "color", c_white);
	box					= struct_get_safe(struct, "box", cf_box_canvas);
	spine_looping		= struct_get_safe(struct, "spine_looping", false);
	active				= struct_get_safe(struct, "active", true);
	#endregion
	
	#region Caching and Calculating
	needs_recalculation			= true;
	cached_sprite				= -1;
	
	// Size
	cached_scale				= [0, 0];
	cached_base_pixels			= [0, 0];
	cached_constrained_pixels	= [0, 0];
	cached_constrained_scale	= [0, 0];
	
	// Positioning/Animating
	visual_changed				= true;
	draw_scale					= [0, 0]; // Scale when taking visuals into account.
	box_vis_scale				= [0, 0];
	draw_pixels					= [0, 0];
	position					= [0, 0];
				
	cached_active				= true;
	is_spine					= false;
	spine_is_playing			= false;
	spine_is_finished			= false;
	cached_animation			= "";
	cached_animation_time		= 0;
	cached_animation_duration	= 0;
	cached_skin					= "";
	cached_animation_durations	= undefined;
	
	cached_box_pixels		= [0, 0];
	cached_box_max_pixels	= [0, 0];
	
	box_intended_pixels		= [0, 0];
	
	static recalculate = function recalculate(_frame) {
		var _new_active = _cfr_renderer_get(active, _frame);
		if (_new_active != cached_active) {
			cached_active = _new_active;
			if !cached_active {
				box_intended_pixels[cf_dimensions.x] = 0;
				box_intended_pixels[cf_dimensions.y] = 0;
			}
			else needs_recalculation = true;
		}
		if !cached_active {
			return false;
		}
		
		var _sprite = _cfr_renderer_get(sprite, _frame);
		var _box	= _frame[$ box];
		
		if (_sprite != cached_sprite) {
			
			cached_sprite				= _sprite;
			cached_animation_durations	= undefined;
			cached_animation_time		= 0;
			spine_is_finished			= false;
			
			needs_recalculation = true;
			if sprite_exists(cached_sprite) {
				is_spine = sprite_is_spine(cached_sprite);
				if is_spine {
					var _sp_info = sprite_get_info(cached_sprite);
					spine_is_playing	= true;
					cached_animation	= _sp_info.animation_names[0];
					cached_skin			= _sp_info.skin_names[0];
					
					with o_cakeframes {
						sprite_index = other.cached_sprite;
						//echo("Got spine sprite", sprite_get_name(sprite_index));
						//echo("  My animation:", skeleton_animation_get());
						//skeleton_animation_set_ext(other.cached_animation, 0);
						var _minmax = skeleton_get_minmax();
						//echo("  Minmax:", _minmax);
						//echo("  Bounds:", skeleton_get_bounds(0));
						other.cached_base_pixels[cf_dimensions.x] = abs(_minmax[0]-_minmax[2]);
						other.cached_base_pixels[cf_dimensions.y] = abs(_minmax[1]-_minmax[3]);
						other.cached_animation_durations = {};
						
						for ( var i = 0; i < array_length(_sp_info.animation_names); i++) {
							var _anim_name = _sp_info.animation_names[i];
							other.cached_animation_durations[$ _anim_name] = skeleton_animation_get_duration(_anim_name);
						}
						
						sprite_index = -1;
					}
				}
				else {
					cached_base_pixels[cf_dimensions.x] = sprite_get_width(cached_sprite);
					cached_base_pixels[cf_dimensions.y] = sprite_get_height(cached_sprite);
				}
			}
			else {
				cached_base_pixels[cf_dimensions.x] = 0;
				cached_base_pixels[cf_dimensions.y] = 0;
			}
		}
		
		var _scale	= real_to_point(_cfr_renderer_get(scale, _frame));
		
		for ( var d = 0; d <= 1; d++) {
			var _pixels		= _box.pixels[d];
			var _max_pixels = _box.max_pixels[d];
			
			if (_scale[d] != cached_scale[d]) {
				needs_recalculation = true;
				cached_scale[d] = _scale[d];
			}
			if (_pixels != cached_box_pixels[d]) {
				needs_recalculation = true;
				cached_box_pixels[d] = _pixels;
			}
			if (_max_pixels != cached_box_max_pixels[d]) {
				needs_recalculation = true;
				cached_box_max_pixels[d] = _max_pixels;
			}
		}
		
		if needs_recalculation {
			if sprite_exists(cached_sprite) {
				switch style {
					case cf_sprite_style_fit:
						var pixels_to_fit_inside	= [infinity, infinity];
						var _scale_to_fit			= infinity;
					
						for ( var d = 0; d <=1 ; d++) {
							pixels_to_fit_inside[d] = (_frame.size_style[d] == cf_style.content) ? _box.max_pixels[d] : _box.pixels[d];
							_scale_to_fit = min(_scale_to_fit, pixels_to_fit_inside[d]/cached_base_pixels[d]);
						}
					
						for ( var d = 0; d <= 1; d++) {
							cached_constrained_scale[d]		= (_scale_to_fit == infinity) ? cached_scale[d] : _scale_to_fit*cached_scale[d];
							cached_constrained_pixels[d]	= abs(cached_constrained_scale[d]*cached_base_pixels[d]);
							box_intended_pixels[d]			= cached_constrained_pixels[d];
						}
						//echo("  Recalculated scale to fit for sprite", sprite_get_name(cached_sprite), ":", _scale_to_fit, "-- Box intended pixels:", box_intended_pixels);
						break;
					case cf_sprite_style_normal:
						for ( var d = 0; d <= 1; d++) {
							cached_constrained_scale[d]		= cached_scale[d];
							cached_constrained_pixels[d]	= abs(cached_constrained_scale[d]*cached_base_pixels[d]);
							box_intended_pixels[d]			= min(cached_constrained_pixels[d], _box.max_pixels[d]);
						}
						break;
					case cf_sprite_style_stretch:
						for ( var d = 0; d <= 1; d++) {
							cached_constrained_pixels[d]	= _box.pixels[d];
							cached_constrained_scale[d]		= cached_scale[d]*(cached_constrained_pixels[d]/cached_base_pixels[d]);
							box_intended_pixels[d]			= 1;
						}
						break;
					default:
						show_error("Unsupported sprite style: " + string(style), true);
						break
				}
			}
			else {
				for ( var d = 0; d <= 1; d++) {
					cached_constrained_pixels[d]	= 0;
					cached_constrained_scale[d]		= 0;
					box_intended_pixels[d]			= 0;
				}
			}
			
			for ( var d = 0; d <= 1; d++) {
				if _box.pixels[d] != box_intended_pixels[d] {
					with _frame {
						if size[d] == cf_size.content {
							_set_as_changed(d);
						}
					}
				}
			}
			
			visual_changed = true;
			needs_recalculation = false;
		}
	}
	#endregion
	
	static draw = function draw(_frame, _drawing_to_surface) {
		//recalculate(_frame);
		if !cached_active { return false; }
		
		var _alpha = _cfr_renderer_get(alpha, _frame);
		
		if (!sprite_exists(cached_sprite) || _alpha <= 0) {
			return false;
		}
		
		if visual_changed {
			var _parent_visual		= _frame.visual;
			var _parent_visual_box	= _parent_visual[$ box];
			for ( var d = 0; d <= 1; d++){
				box_vis_scale[d]  = _parent_visual.scale[d];
				draw_scale[d]	= cached_constrained_scale[d]*box_vis_scale[d];
				draw_pixels[d]	= abs(cached_constrained_pixels[d]*draw_scale[d]);
				position[d]		= _parent_visual_box._get_relative_position(d, anchor[d])-((alignment[d]-1)*draw_pixels[d]);
			}
			visual_changed = false;
		}
		
		var _xdraw = position[0];
		var _ydraw = position[1];
		
		if is_defined(offset) {
			var _offset = _cfr_renderer_get(offset, _frame);
			
			if offset_proportional {
				_xdraw += _offset[0]*draw_pixels[0];
				_ydraw += _offset[1]*draw_pixels[1];
			}
			else {
				_xdraw += _offset[0]*draw_scale[0];
				_ydraw += _offset[1]*draw_scale[1];
			}
		}
		
		var _rotation = _cfr_renderer_get(rotation, _frame);
		
		if _drawing_to_surface {
			cf_premultiply_start();
		}
		
		if is_spine {
			draw_skeleton_time(cached_sprite, cached_animation, cached_skin, cached_animation_time, _xdraw, _ydraw, draw_scale[0], draw_scale[1], _rotation, _cfr_renderer_get(color, _frame), _alpha)
			
			if spine_is_playing {
				cached_animation_time += cf_delta_seconds;
				
				if !spine_looping {
					var _duration = cached_animation_durations[$ cached_animation];
					if cached_animation_time >= cached_animation_durations[$ cached_animation] {
						cached_animation_time = _duration;
						spine_is_playing	= false;
						spine_is_finished	= true;
					}
				}
			}
		}
		else draw_sprite_centered_ext(cached_sprite, _cfr_renderer_get(subimage, _frame), _xdraw, _ydraw, draw_scale[0], draw_scale[1], _rotation, _cfr_renderer_get(color, _frame), _alpha, false);
		
		if _drawing_to_surface {
			cf_premultiply_end();
		}
	}
}