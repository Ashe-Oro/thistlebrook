// Both cards describe the same live staffing state; stock is session output.
export function workStatus(state,hour) {
 if(hour>=12&&hour<13)return 'Lunch hour · back at one';
 if(hour<7)return 'Before the day shift · starts at seven';
 if(hour>=17)return 'The day shift has finished';
 if(state.workers)return `${state.workers} working now · ${state.commuting||0} on their way`;
 if(state.commuting)return 'Day shift · neighbours are on their way';
 return 'Day shift · breaks and errands';
}
