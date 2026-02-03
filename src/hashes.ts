import { generateHash } from './helpers.js'
import { hashMeta, identityLadder } from './meta.js'
import type { HashableItem, ItemHashes, LadderRung } from './types.js'

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

// Build a tagged identifier key using the ladder prefix up to and including
// the given floor rung. Returns undefined when no hashes exist in the prefix.
export const buildIdentifierKeyLadder = (
  hashes: ItemHashes,
  floorKey: LadderRung,
): string | undefined => {
  const floorIndex = identityLadder.findIndex((entry) => entry.rung === floorKey)
  const prefix = identityLadder.slice(0, floorIndex + 1)

  const hasAny = prefix.some((entry) => hashes[entry.key])

  if (!hasAny) {
    return
  }

  return prefix.map((entry) => `${entry.tag}:${hashes[entry.key] ?? ''}`).join('|')
}

// Compute the optimal floor rung for a set of item hashes. Finds the strongest
// rung where buildIdentifierKeyLadder produces zero collisions and full coverage
// (every identifiable item produces a key). When a currentFloor is provided and
// is valid it is returned unchanged; if it collides or loses coverage, only
// weaker rungs are considered (fast downgrade, never upgrades).
export const computeFloorKey = (
  allItemHashes: Array<ItemHashes>,
  currentFloor?: LadderRung,
): LadderRung => {
  // Count items identifiable at max rung (title). A valid rung must identify
  // the same number — otherwise some items become unidentifiable.
  const maxRung = identityLadder[identityLadder.length - 1].rung
  const maxIdentifiable = allItemHashes.filter((hashes) => {
    return buildIdentifierKeyLadder(hashes, maxRung) !== undefined
  }).length

  if (maxIdentifiable === 0) {
    return currentFloor ?? 'title'
  }

  const startIndex = currentFloor
    ? identityLadder.findIndex((entry) => entry.rung === currentFloor)
    : 0

  for (let index = startIndex; index < identityLadder.length; index++) {
    const rung = identityLadder[index].rung
    const keys = new Set<string>()
    let hasCollision = false

    for (const hashes of allItemHashes) {
      const key = buildIdentifierKeyLadder(hashes, rung)

      if (!key) {
        continue
      }

      if (keys.has(key)) {
        hasCollision = true
        break
      }

      keys.add(key)
    }

    // Valid rung: no collisions AND full coverage of identifiable items.
    if (!hasCollision && keys.size >= maxIdentifiable) {
      return rung
    }
  }

  // Even title collides — return weakest possible rung.
  return 'title'
}

// Compute all available hashes for a feed item. Returns only the hashes
// that can be computed (undefined fields omitted).
export const computeItemHashes = <TItem extends HashableItem>(feedItem: TItem): ItemHashes => {
  const hashes: ItemHashes = {}

  for (const meta of hashMeta) {
    const normalized = meta.normalizeFn(feedItem)

    if (normalized) {
      hashes[meta.key] = generateHash(normalized)
    }
  }

  return hashes
}
