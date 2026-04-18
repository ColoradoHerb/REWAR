import type { ProvinceEdge } from '../types/game';

const undirectedEdges = [
  ['north-fen', 'riverbend'],
  ['riverbend', 'duskfield'],
  ['duskfield', 'blackharbor'],
  ['ironcrest', 'stonegate'],
  ['stonegate', 'emberplain'],
  ['emberplain', 'northhold'],
  ['mossplain', 'cold-quarry'],
  ['cold-quarry', 'red-mesa'],
  ['red-mesa', 'sunport'],
  ['north-fen', 'ironcrest'],
  ['ironcrest', 'mossplain'],
  ['riverbend', 'stonegate'],
  ['stonegate', 'cold-quarry'],
  ['duskfield', 'emberplain'],
  ['emberplain', 'red-mesa'],
  ['blackharbor', 'northhold'],
  ['northhold', 'sunport'],
] as const;

export const STARTER_PROVINCE_EDGES: ProvinceEdge[] = undirectedEdges.flatMap(
  ([fromProvinceId, toProvinceId]) => [
    { fromProvinceId, toProvinceId, distance: 1 },
    { fromProvinceId: toProvinceId, toProvinceId: fromProvinceId, distance: 1 },
  ],
);
