import { isDemoState, type DemoState } from "@/lib/demo";
export const WORLD_KEY="ryvo-demo-competition-world-v1";
export function hydrateWorld(state:DemoState):DemoState{try{const world=JSON.parse(localStorage.getItem(WORLD_KEY)||"null");if(world){const next={...state,createdCompetitions:world.createdCompetitions,rounds:world.rounds};if(isDemoState(next))return next}}catch{}return state}
export function worldSnapshot(state:DemoState){return JSON.stringify({createdCompetitions:state.createdCompetitions??[],rounds:state.rounds??{}})}
