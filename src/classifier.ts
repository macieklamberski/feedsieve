import { generateChecksum, isDefined } from './helpers.js'
import {
  computeChannelProfile,
  findCandidatesForItem,
  hasItemChanged,
  selectMatch,
} from './matching.js'
import {
  buildAllKeys,
  computeAllHashes,
  deduplicateByBatchKey,
  detectCollisions,
  filterWithIdentifier,
} from './pipeline.js'
import type {
  ClassificationResult,
  HashableItem,
  InsertAction,
  MatchableItem,
  UpdateAction,
} from './types.js'

// Pure function: classify feed items against existing items into inserts/updates.
export const classifyItems = <TItem extends HashableItem>(input: {
  feedItems: Array<TItem>
  existingItems: Array<MatchableItem>
}): ClassificationResult<TItem> => {
  const { feedItems, existingItems } = input

  const hashed = computeAllHashes(feedItems)
  const collisions = detectCollisions(hashed)
  const keyed = buildAllKeys(hashed, collisions)
  const identified = filterWithIdentifier(keyed)
  const deduplicated = deduplicateByBatchKey(identified)

  // Compute profile from existing + incoming link hashes.
  const incomingLinkHashes = deduplicated.map((item) => item.hashes.linkHash).filter(isDefined)
  const profile = computeChannelProfile(existingItems, incomingLinkHashes)

  // Classify against existing items.
  const inserts: Array<InsertAction<TItem>> = []
  const updates: Array<UpdateAction<TItem>> = []

  for (const item of deduplicated) {
    const identifierHash = generateChecksum(item.identifierKey)
    const candidates = findCandidatesForItem(item.hashes, existingItems)
    const result = selectMatch({
      hashes: item.hashes,
      candidates,
      linkUniquenessRate: profile.linkUniquenessRate,
    })

    if (!result) {
      inserts.push({
        feedItem: item.feedItem,
        hashes: item.hashes,
        identifierHash,
      })
      continue
    }

    if (hasItemChanged(result.match, item.hashes)) {
      updates.push({
        feedItem: item.feedItem,
        hashes: item.hashes,
        identifierHash,
        existingItemId: result.match.id,
        identifierSource: result.identifierSource,
      })
    }
    // Matched + unchanged → omitted from output.
  }

  return { inserts, updates }
}
