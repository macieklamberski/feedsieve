export { classifyItems } from './classifier.js'
export {
  buildIdentifierKeyLadder,
  computeFloorKey,
  computeItemHashes,
  normalizeEnclosureForHashing,
  normalizeGuidForHashing,
  normalizeGuidFragmentForHashing,
  normalizeHtmlForHashing,
  normalizeLinkForHashing,
  normalizeLinkFragmentForHashing,
  normalizeTextForHashing,
} from './hashes.js'
export { identityLadder } from './meta.js'
export {
  computeAllHashes,
  deduplicateByIdentifierKey,
  filterWithIdentifier,
} from './pipeline.js'
export type {
  ClassifyItemsInput,
  ClassifyItemsResult as ClassificationResult,
  HashableItem,
  HashedFeedItem,
  InsertAction,
  ItemHashes,
  KeyedFeedItem,
  LadderRung,
  MatchableItem,
  UpdateAction,
} from './types.js'
