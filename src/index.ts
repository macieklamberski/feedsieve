export { classifyItems } from './classifier.js'
export {
  composeIdentifier,
  computeItemHashes,
  computeMinRung,
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
  deduplicateByIdentifier,
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
export { ladderRungs } from './types.js'
