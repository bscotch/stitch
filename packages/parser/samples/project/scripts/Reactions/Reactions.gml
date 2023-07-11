/// @self Asset.GMObject.o_world_element
function worldement_reactions_process_timers() {
	var _timer = reaction_timers[0];
	with _timer {
		timer += SLOMO_SECONDS;
		if (timer >= maxtime) {
			timer -= maxtime;
			maxtime = random_range(maxtime_min, maxtime_max);
		}
	}
}

function ReactionTimer(_reaction_id, _trigger, _event_id) constructor {
	reaction_id = _reaction_id;
	timer = 0;
	maxtime_min = _trigger.seconds.value0;
	maxtime_max = _trigger.seconds.value1;
	maxtime = random_range(_trigger.seconds.value0, _trigger.seconds.value1);
	event_id = _event_id;
}
