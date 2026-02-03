export { classifyItems } from './classifier.js'
export { contentChangeGate, enclosureConflictGate } from './gates.js'
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
  CandidateGate,
  CandidateGateContext,
  CandidateGateResult,
  ClassifyItemsInput,
  ClassifyItemsResult as ClassificationResult,
  ClassifyPolicy,
  HashableItem,
  HashedFeedItem,
  InsertAction,
  ItemHashes,
  KeyedFeedItem,
  LadderRung,
  MatchableItem,
  MatchSource,
  TraceEvent,
  UpdateAction,
  UpdateGate,
  UpdateGateContext,
} from './types.js'
export { ladderRungs } from './types.js'
