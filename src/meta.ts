import {
  normalizeEnclosureForHashing,
  normalizeGuidForHashing,
  normalizeGuidFragmentForHashing,
  normalizeHtmlForHashing,
  normalizeLinkForHashing,
  normalizeLinkFragmentForHashing,
  normalizeTextForHashing,
} from './normalize.js'
import type { HashableItem, IdentityDepth, ItemHashes } from './types.js'

// Hash key from ItemHashes.
export type HashKey = keyof ItemHashes

// Metadata for a single hash key.
export type HashMeta = {
  key: HashKey
  tag: string
  weight: number
  isStrongHash: boolean
  isMatchable: boolean
  isContent: boolean
  normalizeFn: (item: HashableItem) => string | undefined
  depth?: IdentityDepth
}

// Single source of truth for hash key metadata.
// Order determines identityLevels derivation order.
export const hashMeta: Array<HashMeta> = [
  {
    key: 'guidHash',
    tag: 'g',
    weight: 32,
    isStrongHash: true,
    isMatchable: true,
    isContent: false,
    normalizeFn: (item) => normalizeGuidForHashing(item.guid),
    depth: 'guid',
  },
  {
    key: 'guidFragmentHash',
    tag: 'gf',
    weight: 0,
    isStrongHash: false,
    isMatchable: false,
    isContent: false,
    normalizeFn: (item) => normalizeGuidFragmentForHashing(item.guid),
    depth: 'guidFragment',
  },
  {
    key: 'linkHash',
    tag: 'l',
    weight: 8,
    isStrongHash: true,
    isMatchable: true,
    isContent: false,
    normalizeFn: (item) => normalizeLinkForHashing(item.link),
    depth: 'link',
  },
  {
    key: 'linkFragmentHash',
    tag: 'lf',
    weight: 0,
    isStrongHash: false,
    isMatchable: false,
    isContent: false,
    normalizeFn: (item) => normalizeLinkFragmentForHashing(item.link),
    depth: 'linkFragment',
  },
  {
    key: 'enclosureHash',
    tag: 'e',
    weight: 16,
    isStrongHash: true,
    isMatchable: true,
    isContent: true,
    normalizeFn: (item) => normalizeEnclosureForHashing(item.enclosures),
    depth: 'enclosure',
  },
  {
    key: 'titleHash',
    tag: 't',
    weight: 4,
    isStrongHash: false,
    isMatchable: true,
    isContent: true,
    normalizeFn: (item) => normalizeTextForHashing(item.title),
    depth: 'title',
  },
  {
    key: 'contentHash',
    tag: 'c',
    weight: 2,
    isStrongHash: false,
    isMatchable: false,
    isContent: true,
    normalizeFn: (item) => normalizeHtmlForHashing(item.content),
  },
  {
    key: 'summaryHash',
    tag: 's',
    weight: 1,
    isStrongHash: false,
    isMatchable: false,
    isContent: true,
    normalizeFn: (item) => normalizeHtmlForHashing(item.summary),
  },
]

// Check if any strong hash (guid/link/enclosure) is present.
export const hasStrongHash = (hashes: ItemHashes): boolean => {
  return hashMeta.some((meta) => meta.isStrongHash && hashes[meta.key])
}

// Identity levels ordered strongest → weakest. Each level maps to a HashKey and tag.
export type IdentityLevel = {
  depth: IdentityDepth
  key: HashKey
  tag: string
}

// Derived from hashMeta — entries with depth form the identity levels.
export const identityLevels: Array<IdentityLevel> = hashMeta
  .filter((meta): meta is HashMeta & { depth: IdentityDepth } => {
    return meta.depth !== undefined
  })
  .map((meta) => {
    return { depth: meta.depth, key: meta.key, tag: meta.tag }
  })

// All hash keys derived from hashMeta.
export const hashKeys: Array<HashKey> = hashMeta.map((meta) => meta.key)
