export { classifyItems } from './classifier.js'
export {
  buildIdentifierKeyLadder,
  computeFloorKey,
  computeItemHashes,
  normalizeLinkForHashing,
} from './hashes.js'
export { identityLadder } from './meta.js'
export {
  computeAllHashes,
  deduplicateByIdentifierKey,
  filterWithIdentifier,
} from './pipeline.js'
export type {
  ClassificationResult,
  ClassifyItemsInput,
  HashableItem,
  HashedFeedItem,
  InsertAction,
  ItemHashes,
  KeyedFeedItem,
  LadderRung,
  MatchableItem,
  UpdateAction,
} from './types.js'
