import { generateChecksum128 } from './helpers.js'
import {
  type CollisionMap,
  dedupPaths,
  emptyCollisions,
  hashMeta,
  hasStrongHash,
  tagByKey,
} from './meta.js'
import type { HashableItem, ItemHashes } from './types.js'

export {
  normalizeEnclosureForHashing,
  normalizeGuidForHashing,
  normalizeGuidFragmentForHashing,
  normalizeHtmlForHashing,
  normalizeLinkForHashing,
  normalizeLinkFragmentForHashing,
  normalizeLinkWithFragmentForHashing,
  normalizeTextForHashing,
} from './normalize.js'

// Build a tagged key for the DB insert guard (identifierHash). Excludes
// titleHash when any strong hash (guid/link/enclosure) exists, as title edits
// should not change the insert key. Includes fragment hashes so items
// differing only by fragment (e.g. #Earth2 vs #LimeVPN) get distinct
// identities. Returns undefined when no hashes exist.
export const buildIdentifierKey = (hashes: ItemHashes): string | undefined => {
  if (!hasStrongHash(hashes) && !hashes.titleHash) {
    return
  }

  // Output example: "g:g1|gf:|l:l1|lf:|e:|t:".
  const parts = hashMeta
    .filter((meta) => meta.useAsIdentifier !== 'never')
    .map((meta) => {
      if (meta.useAsIdentifier === 'onlyWhenNoStrong' && hasStrongHash(hashes)) {
        return `${meta.tag}:`
      }

      return `${meta.tag}:${hashes[meta.key] ?? ''}`
    })

  return parts.join('|')
}

// Check if a hash is present and not colliding (safe to use as splitter).
const isSafeSplitter = (hash: string | undefined, collidingSet: Set<string>): boolean => {
  return !!hash && !collidingSet.has(hash)
}

// Build a tagged key for within-batch dedup using nested collision refinement.
// Walks dedupPaths in priority order. For each path, if the primary hash exists
// but collides, tries splitters in order. Never uses a splitter that is itself
// colliding (conservative). Returns undefined when no safe key can be built —
// item falls back to identifierKey in dedup.
export const buildBatchDedupKey = (
  hashes: ItemHashes,
  collisions: CollisionMap = emptyCollisions,
): string | undefined => {
  for (const { primaryKey, splitterKeys } of dedupPaths) {
    const primaryHash = hashes[primaryKey]

    if (!primaryHash) {
      continue
    }

    const primaryTag = tagByKey[primaryKey]

    if (!collisions[primaryKey].has(primaryHash)) {
      return `${primaryTag}:${primaryHash}`
    }

    for (const splitterKey of splitterKeys) {
      if (isSafeSplitter(hashes[splitterKey], collisions[splitterKey])) {
        return `${primaryTag}:${primaryHash}|${tagByKey[splitterKey]}:${hashes[splitterKey]}`
      }
    }

    return
  }

  return
}

// Compute all available hashes for a feed item. Returns only the hashes
// that can be computed (undefined fields omitted).
export const computeItemHashes = <TItem extends HashableItem>(feedItem: TItem): ItemHashes => {
  const hashes: ItemHashes = {}

  for (const meta of hashMeta) {
    const normalized = meta.normalizeFn(feedItem)

    if (normalized) {
      hashes[meta.key] = generateChecksum128(normalized)
    }
  }

  return hashes
}
