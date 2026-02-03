import { buildIdentifierKeyLadder, computeFloorKey } from './hashes.js'
import { generateHash, isDefined } from './helpers.js'
import {
  computeChannelProfile,
  findCandidatesForItem,
  hasItemChanged,
  selectMatch,
} from './matching.js'
import { hashKeys } from './meta.js'
import { computeAllHashes, deduplicateByIdentifierKey, filterWithIdentifier } from './pipeline.js'
import type {
  ClassifyItemsInput,
  ClassifyItemsResult,
  HashableItem,
  InsertAction,
  ItemHashes,
  MatchableItem,
  UpdateAction,
} from './types.js'

// Convert MatchableItem (string | null) to ItemHashes (string | undefined).
const toItemHashes = (item: MatchableItem): ItemHashes => {
  const hashes: ItemHashes = {}

  for (const key of hashKeys) {
    const value = item[key]

    if (value) {
      hashes[key] = value
    }
  }

  return hashes
}

// Pure function: classify feed items against existing items into inserts/updates.
// Uses ladder-based identity with auto-computed floor when floorKey is not provided.
export const classifyItems = <TItem extends HashableItem>(
  input: ClassifyItemsInput<TItem>,
): ClassifyItemsResult<TItem> => {
  const { feedItems, existingItems, floorKey: inputFloorKey } = input

  const hashedItems = computeAllHashes(feedItems)
  const incomingHashes = hashedItems.map((item) => item.hashes)

  // Compute profile early — used for both pre-match exclusion and final
  // classification. Uses raw (not deduped) incoming link hashes; duplicates
  // lower uniqueness slightly, which is conservative (fewer link matches).
  const incomingLinkHashes = incomingHashes.map((hashes) => hashes.linkHash).filter(isDefined)
  const profile = computeChannelProfile(existingItems, incomingLinkHashes)

  // Pre-match: find existing items that are true updates and exclude them
  // from the floor collision set. A match is "strong enough" when it's by
  // guid, enclosure, or title — those are unambiguously the same item. A
  // link match is only trusted when the max-rung keys agree (true duplicate);
  // a bare link match with different titles could be hub onset and must stay
  // in the collision set so the floor can detect it.
  const matchedExistingIds = new Set<string>()

  for (const { hashes } of hashedItems) {
    const candidates = findCandidatesForItem(hashes, existingItems)
    const result = selectMatch({
      hashes,
      candidates,
      linkUniquenessRate: profile.linkUniquenessRate,
    })

    if (!result) {
      continue
    }

    if (result.identifierSource !== 'link') {
      matchedExistingIds.add(result.match.id)
      continue
    }

    // Link match: only exclude when max-rung keys agree (true duplicate).
    const incomingMaxKey = buildIdentifierKeyLadder(hashes, 'title')
    const existingMaxKey = buildIdentifierKeyLadder(toItemHashes(result.match), 'title')

    if (incomingMaxKey === existingMaxKey) {
      matchedExistingIds.add(result.match.id)
    }
  }

  const unmatchedExistingHashes = existingItems
    .filter((item) => !matchedExistingIds.has(item.id))
    .map(toItemHashes)

  // Dedup by max-rung ladder key so identity-equivalent items (literal feed
  // duplicates, or same item with slightly different hash coverage) don't
  // cause false downgrades. Items with no ladder identity are skipped.
  const seenKeys = new Set<string>()
  const floorHashes = [...incomingHashes, ...unmatchedExistingHashes].filter((hashes) => {
    const maxKey = buildIdentifierKeyLadder(hashes, 'title')

    if (!maxKey) {
      return false
    }

    if (seenKeys.has(maxKey)) {
      return false
    }

    seenKeys.add(maxKey)
    return true
  })

  // Resolve floor: validate/downgrade if provided, compute from data otherwise.
  const resolvedFloorKey = computeFloorKey(floorHashes, inputFloorKey)
  const floorKeyChanged = inputFloorKey !== undefined && resolvedFloorKey !== inputFloorKey

  // Build keyed items using ladder identity at the resolved floor.
  const keyed = hashedItems.map((item) => ({
    ...item,
    identifierKey: buildIdentifierKeyLadder(item.hashes, resolvedFloorKey),
  }))
  const identified = filterWithIdentifier(keyed)
  const deduplicated = deduplicateByIdentifierKey(identified)

  // Classify against existing items.
  const inserts: Array<InsertAction<TItem>> = []
  const updates: Array<UpdateAction<TItem>> = []

  for (const item of deduplicated) {
    const identifierHash = generateHash(item.identifierKey)
    const candidates = findCandidatesForItem(item.hashes, existingItems)

    // Reject candidates whose ladder key differs from the incoming item.
    // This prevents matching (and merging) items that the ladder considers distinct.
    const floorFilteredCandidates = candidates.filter(
      (candidate) =>
        buildIdentifierKeyLadder(toItemHashes(candidate), resolvedFloorKey) === item.identifierKey,
    )

    const result = selectMatch({
      hashes: item.hashes,
      candidates: floorFilteredCandidates,
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

    // Otherwise, if matched and unchanged — omit from output.
  }

  return { inserts, updates, floorKey: resolvedFloorKey, floorKeyChanged }
}
