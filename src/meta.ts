import {
  normalizeEnclosureForHashing,
  normalizeGuidForHashing,
  normalizeGuidFragmentForHashing,
  normalizeHtmlForHashing,
  normalizeLinkForHashing,
  normalizeLinkFragmentForHashing,
  normalizeTextForHashing,
} from './normalize.js'
import type { HashableItem, ItemHashes } from './types.js'

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
  useAsIdentifier: IdentifierRule
  normalizeFn: (item: HashableItem) => string | undefined
}

// Single source of truth for hash key metadata.
// Order matches the identifier key output: g, gf, l, lf, e, t.
export const hashMeta: Array<HashMeta> = [
  {
    key: 'guidHash',
    tag: 'g',
    weight: 32,
    isStrongHash: true,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeGuidForHashing(item.guid),
  },
  {
    key: 'guidFragmentHash',
    tag: 'gf',
    weight: 0,
    isStrongHash: false,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeGuidFragmentForHashing(item.guid),
  },
  {
    key: 'linkHash',
    tag: 'l',
    weight: 8,
    isStrongHash: true,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeLinkForHashing(item.link),
  },
  {
    key: 'linkFragmentHash',
    tag: 'lf',
    weight: 0,
    isStrongHash: false,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeLinkFragmentForHashing(item.link),
  },
  {
    key: 'enclosureHash',
    tag: 'e',
    weight: 16,
    isStrongHash: true,
    useAsIdentifier: 'always',
    normalizeFn: (item) => normalizeEnclosureForHashing(item.enclosures),
  },
  {
    key: 'titleHash',
    tag: 't',
    weight: 4,
    isStrongHash: false,
    useAsIdentifier: 'onlyWhenNoStrong',
    normalizeFn: (item) => normalizeTextForHashing(item.title),
  },
  {
    key: 'contentHash',
    tag: 'c',
    weight: 2,
    isStrongHash: false,
    useAsIdentifier: 'never',
    normalizeFn: (item) => normalizeHtmlForHashing(item.content),
  },
  {
    key: 'summaryHash',
    tag: 's',
    weight: 1,
    isStrongHash: false,
    useAsIdentifier: 'never',
    normalizeFn: (item) => normalizeHtmlForHashing(item.summary),
  },
]

// All hash keys derived from hashMeta.
export const hashKeys: Array<HashKey> = hashMeta.map((meta) => meta.key)

// Collision map keyed by hash key.
export type CollisionMap = Record<HashKey, Set<string>>

// Empty collision map with no collisions. Shared default for tests and production.
export const emptyCollisions: CollisionMap = Object.fromEntries(
  hashKeys.map((key) => [key, new Set<string>()]),
) as CollisionMap
