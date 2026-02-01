import { generateChecksum128 } from './helpers.js'
import { type CollisionMap, emptyCollisions, hashMeta } from './meta.js'
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
  const hasStrongHash = hashMeta.some((meta) => meta.isStrongHash && hashes[meta.key])

  if (!hasStrongHash && !hashes.titleHash) {
    return
  }

  // Output example: "g:g1|gf:|l:l1|lf:|e:|t:".
  const parts = hashMeta
    .filter((meta) => meta.useAsIdentifier !== 'never')
    .map((meta) => {
      const value =
        meta.useAsIdentifier === 'onlyWhenNoStrong' && hasStrongHash ? '' : (hashes[meta.key] ?? '')
      return `${meta.tag}:${value}`
    })

  return parts.join('|')
}

// Check if a hash is present and not colliding (safe to use as splitter).
const isSafeSplitter = (hash: string | undefined, collidingSet: Set<string>): boolean => {
  return !!hash && !collidingSet.has(hash)
}

// Build a tagged key for within-batch dedup using nested collision refinement.
// Starts with the strongest signal, only adds splitters when the current level
// collides. Never uses a splitter that is itself colliding (conservative).
// Returns undefined when no safe key can be built — item falls back to identifierKey in dedup.
export const buildBatchDedupKey = (
  hashes: ItemHashes,
  collisions: CollisionMap = emptyCollisions,
): string | undefined => {
  // GUID path: strongest signal.
  if (hashes.guidHash) {
    if (!collisions.guidHash.has(hashes.guidHash)) {
      return `g:${hashes.guidHash}`
    }

    if (isSafeSplitter(hashes.guidFragmentHash, collisions.guidFragmentHash)) {
      return `g:${hashes.guidHash}|gf:${hashes.guidFragmentHash}`
    }

    if (isSafeSplitter(hashes.enclosureHash, collisions.enclosureHash)) {
      return `g:${hashes.guidHash}|e:${hashes.enclosureHash}`
    }

    if (isSafeSplitter(hashes.linkHash, collisions.linkHash)) {
      return `g:${hashes.guidHash}|l:${hashes.linkHash}`
    }

    if (isSafeSplitter(hashes.linkFragmentHash, collisions.linkFragmentHash)) {
      return `g:${hashes.guidHash}|lf:${hashes.linkFragmentHash}`
    }

    if (isSafeSplitter(hashes.titleHash, collisions.titleHash)) {
      return `g:${hashes.guidHash}|t:${hashes.titleHash}`
    }

    return
  }

  // Link path.
  if (hashes.linkHash) {
    if (!collisions.linkHash.has(hashes.linkHash)) {
      return `l:${hashes.linkHash}`
    }

    if (isSafeSplitter(hashes.linkFragmentHash, collisions.linkFragmentHash)) {
      return `l:${hashes.linkHash}|lf:${hashes.linkFragmentHash}`
    }

    if (isSafeSplitter(hashes.enclosureHash, collisions.enclosureHash)) {
      return `l:${hashes.linkHash}|e:${hashes.enclosureHash}`
    }

    if (isSafeSplitter(hashes.titleHash, collisions.titleHash)) {
      return `l:${hashes.linkHash}|t:${hashes.titleHash}`
    }

    return
  }

  // Enclosure-only path (no guid, no link).
  if (hashes.enclosureHash) {
    if (!collisions.enclosureHash.has(hashes.enclosureHash)) {
      return `e:${hashes.enclosureHash}`
    }

    return
  }

  // Title path (no strong IDs).
  if (hashes.titleHash) {
    if (!collisions.titleHash.has(hashes.titleHash)) {
      return `t:${hashes.titleHash}`
    }

    if (isSafeSplitter(hashes.contentHash, collisions.contentHash)) {
      return `t:${hashes.titleHash}|c:${hashes.contentHash}`
    }

    if (isSafeSplitter(hashes.summaryHash, collisions.summaryHash)) {
      return `t:${hashes.titleHash}|s:${hashes.summaryHash}`
    }

    return
  }

  // Content-only (last resort).
  if (hashes.contentHash) {
    return `c:${hashes.contentHash}`
  }

  // Summary-only (last resort).
  if (hashes.summaryHash) {
    return `s:${hashes.summaryHash}`
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
