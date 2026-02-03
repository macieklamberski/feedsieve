import { composeIdentifier, computeMinRung } from './hashes.js'
import { generateHash, isDefined } from './helpers.js'
import {
  computeChannelProfile,
  findCandidatesForItem,
  hasItemChanged,
  selectMatch,
} from './matching.js'
import { hashKeys } from './meta.js'
import { computeAllHashes, deduplicateByIdentifier, filterWithIdentifier } from './pipeline.js'
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

// Pure function: classify new items against existing items into inserts/updates.
// Uses ladder-based identity with auto-computed min rung when not provided.
export const classifyItems = <TItem extends HashableItem>(
  input: ClassifyItemsInput<TItem>,
): ClassifyItemsResult<TItem> => {
  const { newItems, existingItems, minRung: inputMinRung } = input

  const hashedItems = computeAllHashes(newItems)
  const incomingHashes = hashedItems.map((item) => item.hashes)

  // Compute profile early — used for both pre-match exclusion and final
  // classification. Uses raw (not deduped) incoming link hashes; duplicates
  // lower uniqueness slightly, which is conservative (fewer link matches).
  const incomingLinkHashes = incomingHashes.map((hashes) => hashes.linkHash).filter(isDefined)
  const profile = computeChannelProfile(existingItems, incomingLinkHashes)

  // Pre-match: find existing items that are true updates and exclude them
  // from the rung collision set. A match is "strong enough" when it's by
  // guid, enclosure, or title — those are unambiguously the same item. A
  // link match is only trusted when the max-rung identifiers agree (true
  // duplicate); a bare link match with different titles could be hub onset
  // and must stay in the collision set so the rung can detect it.
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

    // Link match: only exclude when max-rung identifiers agree (true duplicate).
    const incomingMaxKey = composeIdentifier(hashes, 'title')
    const existingMaxKey = composeIdentifier(toItemHashes(result.match), 'title')

    if (incomingMaxKey === existingMaxKey) {
      matchedExistingIds.add(result.match.id)
    }
  }

  const unmatchedExistingHashes = existingItems
    .filter((item) => !matchedExistingIds.has(item.id))
    .map(toItemHashes)

  // Dedup by max-rung identifier so identity-equivalent items (literal
  // duplicates, or same item with slightly different hash coverage) don't
  // cause false downgrades. Items with no ladder identity are skipped.
  const seenKeys = new Set<string>()
  const rungHashes = [...incomingHashes, ...unmatchedExistingHashes].filter((hashes) => {
    const maxKey = composeIdentifier(hashes, 'title')

    if (!maxKey) {
      return false
    }

    if (seenKeys.has(maxKey)) {
      return false
    }

    seenKeys.add(maxKey)
    return true
  })

  // Resolve min rung: validate/downgrade if provided, compute from data otherwise.
  const resolvedMinRung = computeMinRung(rungHashes, inputMinRung)
  const minRungChanged = inputMinRung !== undefined && resolvedMinRung !== inputMinRung

  // Build keyed items using ladder identity at the resolved min rung.
  const keyed = hashedItems.map((item) => ({
    ...item,
    identifier: composeIdentifier(item.hashes, resolvedMinRung),
  }))
  const identified = filterWithIdentifier(keyed)
  const deduplicated = deduplicateByIdentifier(identified)

  // Classify against existing items.
  const inserts: Array<InsertAction<TItem>> = []
  const updates: Array<UpdateAction<TItem>> = []

  for (const item of deduplicated) {
    const identifierHash = generateHash(item.identifier)
    const candidates = findCandidatesForItem(item.hashes, existingItems)

    // Reject candidates whose identifier differs from the incoming item.
    // This prevents matching (and merging) items that the ladder considers distinct.
    const rungFilteredCandidates = candidates.filter(
      (candidate) =>
        composeIdentifier(toItemHashes(candidate), resolvedMinRung) === item.identifier,
    )

    const result = selectMatch({
      hashes: item.hashes,
      candidates: rungFilteredCandidates,
      linkUniquenessRate: profile.linkUniquenessRate,
    })

    if (!result) {
      inserts.push({
        item: item.item,
        hashes: item.hashes,
        identifierHash,
      })
      continue
    }

    if (hasItemChanged(result.match, item.hashes)) {
      updates.push({
        item: item.item,
        hashes: item.hashes,
        identifierHash,
        existingItemId: result.match.id,
        identifierSource: result.identifierSource,
      })
    }

    // Otherwise, if matched and unchanged — omit from output.
  }

  return { inserts, updates, minRung: resolvedMinRung, minRungChanged }
}
