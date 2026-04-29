import { STARTER_WORLD_ID, US48_SUB_WORLD_ID, US48_WORLD_ID } from '@rewar/shared';
import { StarterWorldMap } from './StarterWorldMap';
import type { StrategyMapProps } from './types';
import { USMap } from './USMap';

export function StrategyMap(props: StrategyMapProps) {
  if (
    props.worldState.session.seedWorldId === US48_WORLD_ID ||
    props.worldState.session.seedWorldId === US48_SUB_WORLD_ID
  ) {
    return <USMap {...props} />;
  }

  if (props.worldState.session.seedWorldId === STARTER_WORLD_ID) {
    return <StarterWorldMap {...props} />;
  }

  return <StarterWorldMap {...props} />;
}
