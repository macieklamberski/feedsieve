import { computeItemHashes } from './hashes.js'
import { hashMeta } from './meta.js'
import type {
  HashableItem,
  HashedFeedItem,
  IdentifiedFeedItem,
  ItemHashes,
  KeyedFeedItem,
} from './types.js'

// Score an item by how many hash slots are populated, weighted by signal strength.
export const scoreItem = (hashes: ItemHashes): number => {
  let score = 0

  for (const { key, weight } of hashMeta) {
    if (hashes[key]) {
      score += weight
    }
  }

  return score
}

// Step 1: Map each feed item to its computed hashes.
export const computeAllHashes = <TItem extends HashableItem>(
  feedItems: Array<TItem>,
): Array<HashedFeedItem<TItem>> => {
  return feedItems.map((feedItem) => ({ feedItem, hashes: computeItemHashes(feedItem) }))
}

// Step 2: Remove items where identifierKey is undefined.
export const filterWithIdentifier = <TItem>(
  items: Array<KeyedFeedItem<TItem>>,
): Array<IdentifiedFeedItem<TItem>> => {
  return items.filter((item): item is IdentifiedFeedItem<TItem> => item.identifierKey !== undefined)
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

// Step 3: Best-copy-wins dedup by identifierKey.
export const deduplicateByIdentifierKey = <TItem>(
  items: Array<IdentifiedFeedItem<TItem>>,
): Array<IdentifiedFeedItem<TItem>> => {
  const bestByIdentifier = new Map<string, IdentifiedFeedItem<TItem>>()

  for (const item of items) {
    keepBest(bestByIdentifier, item.identifierKey, item)
  }

  return [...bestByIdentifier.values()]
}
