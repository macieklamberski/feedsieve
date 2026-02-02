export { classifyItems } from './classifier.js'
export { computeItemHashes, normalizeLinkForHashing } from './hashes.js'
export {
  buildAllKeys,
  computeAllHashes,
  deduplicateByBatchKey,
  detectCollisions,
  filterWithIdentifier,
} from './pipeline.js'
export type {
  ClassificationResult,
  HashableItem,
  HashedFeedItem,
  InsertAction,
  ItemHashes,
  KeyedFeedItem,
  MatchableItem,
  UpdateAction,
} from './types.js'
