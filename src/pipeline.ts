import { buildBatchDedupKey, buildIdentifierKey, computeItemHashes } from './hashes.js'
import type {
  CollisionProfile,
  HashableItem,
  HashedFeedItem,
  IdentifiedFeedItem,
  ItemHashes,
  KeyedFeedItem,
} from './types.js'

// Hash weight for best-copy-wins scoring. Higher = stronger signal.
const hashWeights: Record<keyof ItemHashes, number> = {
  guidHash: 32,
  guidFragmentHash: 0,
  enclosureHash: 16,
  linkHash: 8,
  linkFragmentHash: 0,
  titleHash: 4,
  contentHash: 2,
  summaryHash: 1,
}

// Score an item by how many hash slots are populated, weighted by signal strength.
export const scoreItem = (hashes: ItemHashes): number => {
  let score = 0

  for (const [key, weight] of Object.entries(hashWeights)) {
    if (hashes[key as keyof ItemHashes]) {
      score += weight
    }
  }

  return score
}

// Step 1: Map each feed item to its computed hashes.
export const computeAllHashes = <TItem extends HashableItem>(
  feedItems: Array<TItem>,
): Array<HashedFeedItem<TItem>> => {
  return feedItems.map((feedItem) => {
    return { feedItem, hashes: computeItemHashes(feedItem) }
  })
}

type CollisionField = [keyof ItemHashes, keyof CollisionProfile]

const collisionFields: Array<CollisionField> = [
  ['guidHash', 'collidingGuids'],
  ['guidFragmentHash', 'collidingGuidFragments'],
  ['linkHash', 'collidingLinks'],
  ['linkFragmentHash', 'collidingLinkFragments'],
  ['enclosureHash', 'collidingEnclosures'],
  ['titleHash', 'collidingTitles'],
  ['contentHash', 'collidingContents'],
  ['summaryHash', 'collidingSummaries'],
]

// Step 2: Find hashes appearing >1 time per field.
export const detectCollisions = <TItem>(items: Array<HashedFeedItem<TItem>>): CollisionProfile => {
  const seen = {} as CollisionProfile
  const duplicates = {} as CollisionProfile

  for (const [, key] of collisionFields) {
    seen[key] = new Set()
    duplicates[key] = new Set()
  }

  for (const { hashes } of items) {
    for (const [field, key] of collisionFields) {
      const value = hashes[field]

      if (!value) {
        continue
      }

      const dupSet = duplicates[key]

      if (dupSet.has(value)) {
        continue
      }

      if (seen[key].has(value)) dupSet.add(value)
      else seen[key].add(value)
    }
  }

  return duplicates
}

// Step 3: Compute identifierKey and batchDedupKey for each item.
export const buildAllKeys = <TItem>(
  items: Array<HashedFeedItem<TItem>>,
  collisions: CollisionProfile,
): Array<KeyedFeedItem<TItem>> => {
  return items.map((item) => ({
    ...item,
    identifierKey: buildIdentifierKey(item.hashes),
    batchDedupKey: buildBatchDedupKey(item.hashes, collisions),
  }))
}

// Step 4: Remove items where identifierKey is undefined.
export const filterWithIdentifier = <TItem>(
  items: Array<KeyedFeedItem<TItem>>,
): Array<IdentifiedFeedItem<TItem>> => {
  return items.filter((item): item is IdentifiedFeedItem<TItem> => {
    return item.identifierKey !== undefined
  })
}

// Best-copy helper: keep the richer item (more hash slots populated).
// On tie, keep existing (earlier — deterministic).
const keepBest = <TItem>(
  map: Map<string, IdentifiedFeedItem<TItem>>,
  key: string,
  item: IdentifiedFeedItem<TItem>,
): void => {
  const existing = map.get(key)

  if (!existing || scoreItem(item.hashes) > scoreItem(existing.hashes)) {
    map.set(key, item)
  }
}

// Step 5: Two-pass best-copy-wins dedup.
// Pass 1: dedup by batchDedupKey (falls back to identifierKey when undefined).
// Pass 2: dedup survivors by identifierKey — catches items with different
// batch keys but same identifier (would hit DB unique constraint otherwise).
export const deduplicateByBatchKey = <TItem>(
  items: Array<IdentifiedFeedItem<TItem>>,
): Array<IdentifiedFeedItem<TItem>> => {
  // Pass 1: batch key dedup.
  const bestByBatchKey = new Map<string, IdentifiedFeedItem<TItem>>()

  for (const item of items) {
    keepBest(bestByBatchKey, item.batchDedupKey ?? item.identifierKey, item)
  }

  // Pass 2: identifier key dedup — collapse survivors sharing identifierKey.
  const bestByIdentifier = new Map<string, IdentifiedFeedItem<TItem>>()

  for (const item of bestByBatchKey.values()) {
    keepBest(bestByIdentifier, item.identifierKey, item)
  }

  return [...bestByIdentifier.values()]
}
