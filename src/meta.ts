import type { ItemHashes } from './types.js'

// Hash key from ItemHashes.
export type HashKey = keyof ItemHashes

// Rule for whether a hash participates in identifierKey.
export type IdentifierRule = 'always' | 'onlyWhenNoStrong' | 'never'

// Metadata for a single hash key.
export type HashMeta = {
  key: HashKey
  tag: string
  weight: number
  strong: boolean
  identifier: IdentifierRule
}

// Single source of truth for hash key metadata.
// Order matches the identifier key output: g, gf, l, lf, e, t.
export const hashMeta: Array<HashMeta> = [
  { key: 'guidHash', tag: 'g', weight: 32, strong: true, identifier: 'always' },
  { key: 'guidFragmentHash', tag: 'gf', weight: 0, strong: false, identifier: 'always' },
  { key: 'linkHash', tag: 'l', weight: 8, strong: true, identifier: 'always' },
  { key: 'linkFragmentHash', tag: 'lf', weight: 0, strong: false, identifier: 'always' },
  { key: 'enclosureHash', tag: 'e', weight: 16, strong: true, identifier: 'always' },
  { key: 'titleHash', tag: 't', weight: 4, strong: false, identifier: 'onlyWhenNoStrong' },
  { key: 'contentHash', tag: 'c', weight: 2, strong: false, identifier: 'never' },
  { key: 'summaryHash', tag: 's', weight: 1, strong: false, identifier: 'never' },
]

// All hash keys derived from hashMeta.
export const hashKeys: Array<HashKey> = hashMeta.map((meta) => meta.key)

// Collision map keyed by hash key.
export type CollisionMap = Record<HashKey, Set<string>>

// Empty collision map with no collisions. Shared default for tests and production.
export const emptyCollisions: CollisionMap = Object.fromEntries(
  hashKeys.map((key) => [key, new Set<string>()]),
) as CollisionMap
