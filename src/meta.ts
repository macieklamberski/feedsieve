import {
  normalizeEnclosureForHashing,
  normalizeGuidForHashing,
  normalizeGuidFragmentForHashing,
  normalizeHtmlForHashing,
  normalizeLinkForHashing,
  normalizeLinkFragmentForHashing,
  normalizeTextForHashing,
} from './normalize.js'
import type { HashableItem, ItemHashes, LadderRung } from './types.js'

// Hash key from ItemHashes.
export type HashKey = keyof ItemHashes

// Rule for whether a hash participates in identifierKey.
export type IdentifierRule = 'always' | 'onlyWhenNoStrong' | 'never'

// Metadata for a single hash key.
export type HashMeta = {
  key: HashKey
  tag: string
  weight: number
  isStrongHash: boolean
  isMatchable: boolean
  isContent: boolean
  useAsIdentifier: IdentifierRule
  normalizeFn: (item: HashableItem) => string | undefined
  ladderRung?: LadderRung
  dedupSplitters?: Array<HashKey>
}

// Single source of truth for hash key metadata.
// Order determines identityLadder and dedupPaths derivation order.
export const hashMeta: Array<HashMeta> = [
  {
    key: 'guidHash',
    tag: 'g',
    weight: 32,
    isStrongHash: true,
    isMatchable: true,
    isContent: false,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeGuidForHashing(item.guid),
    ladderRung: 'guidBase',
    dedupSplitters: [
      'guidFragmentHash',
      'enclosureHash',
      'linkHash',
      'linkFragmentHash',
      'titleHash',
    ],
  },
  {
    key: 'guidFragmentHash',
    tag: 'gf',
    weight: 0,
    isStrongHash: false,
    isMatchable: false,
    isContent: false,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeGuidFragmentForHashing(item.guid),
    ladderRung: 'guidWithFragment',
  },
  {
    key: 'linkHash',
    tag: 'l',
    weight: 8,
    isStrongHash: true,
    isMatchable: true,
    isContent: false,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeLinkForHashing(item.link),
    ladderRung: 'linkBase',
    dedupSplitters: ['linkFragmentHash', 'enclosureHash', 'titleHash'],
  },
  {
    key: 'linkFragmentHash',
    tag: 'lf',
    weight: 0,
    isStrongHash: false,
    isMatchable: false,
    isContent: false,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeLinkFragmentForHashing(item.link),
    ladderRung: 'linkWithFragment',
  },
  {
    key: 'enclosureHash',
    tag: 'e',
    weight: 16,
    isStrongHash: true,
    isMatchable: true,
    isContent: true,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeEnclosureForHashing(item.enclosures),
    ladderRung: 'enclosure',
    dedupSplitters: [],
  },
  {
    key: 'titleHash',
    tag: 't',
    weight: 4,
    isStrongHash: false,
    isMatchable: true,
    isContent: true,
    useAsIdentifier: 'onlyWhenNoStrong',
    normalizeFn: (item) => normalizeTextForHashing(item.title),
    ladderRung: 'title',
    dedupSplitters: ['contentHash', 'summaryHash'],
  },
  {
    key: 'contentHash',
    tag: 'c',
    weight: 2,
    isStrongHash: false,
    isMatchable: false,
    isContent: true,
    useAsIdentifier: 'never',
    normalizeFn: (item) => normalizeHtmlForHashing(item.content),
    dedupSplitters: [],
  },
  {
    key: 'summaryHash',
    tag: 's',
    weight: 1,
    isStrongHash: false,
    isMatchable: false,
    isContent: true,
    useAsIdentifier: 'never',
    normalizeFn: (item) => normalizeHtmlForHashing(item.summary),
    dedupSplitters: [],
  },
]

// Check if any strong hash (guid/link/enclosure) is present.
export const hasStrongHash = (hashes: ItemHashes): boolean => {
  return hashMeta.some((meta) => meta.isStrongHash && hashes[meta.key])
}

// Tag lookup by hash key for O(1) access in buildBatchDedupKey.
export const tagByKey: Record<HashKey, string> = Object.fromEntries(
  hashMeta.map((meta) => [meta.key, meta.tag]),
) as Record<HashKey, string>

// Ladder rungs ordered strongest → weakest. Each rung maps to a HashKey and tag.
export type LadderEntry = {
  rung: LadderRung
  key: HashKey
  tag: string
}

// Derived from hashMeta — entries with ladderRung form the identity ladder.
export const identityLadder: Array<LadderEntry> = hashMeta
  .filter((meta): meta is HashMeta & { ladderRung: LadderRung } => {
    return meta.ladderRung !== undefined
  })
  .map((meta) => {
    return { rung: meta.ladderRung, key: meta.key, tag: meta.tag }
  })

// Splitter order per primary hash in buildBatchDedupKey.
// Each entry: try the primary hash first, then try splitters in order.
export type DedupPath = {
  primaryKey: HashKey
  splitterKeys: Array<HashKey>
}

// Derived from hashMeta — entries with dedupSplitters form dedup paths.
export const dedupPaths: Array<DedupPath> = hashMeta
  .filter((meta): meta is HashMeta & { dedupSplitters: Array<HashKey> } => {
    return meta.dedupSplitters !== undefined
  })
  .map((meta) => {
    return { primaryKey: meta.key, splitterKeys: meta.dedupSplitters }
  })

// All hash keys derived from hashMeta.
export const hashKeys: Array<HashKey> = hashMeta.map((meta) => meta.key)

// Collision map keyed by hash key.
export type CollisionMap = Record<HashKey, Set<string>>

// Empty collision map with no collisions. Shared default for tests and production.
export const emptyCollisions: CollisionMap = Object.fromEntries(
  hashKeys.map((key) => [key, new Set<string>()]),
) as CollisionMap
