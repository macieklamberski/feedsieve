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

// Metadata for a single hash key.
export type HashMeta = {
  key: HashKey
  tag: string
  weight: number
  isStrongHash: boolean
  isMatchable: boolean
  isContent: boolean
  normalizeFn: (item: HashableItem) => string | undefined
  ladderRung?: LadderRung
}

// Single source of truth for hash key metadata.
// Order determines identityLadder derivation order.
export const hashMeta: Array<HashMeta> = [
  {
    key: 'guidHash',
    tag: 'g',
    weight: 32,
    isStrongHash: true,
    isMatchable: true,
    isContent: false,
    normalizeFn: (item) => normalizeGuidForHashing(item.guid),
    ladderRung: 'guidBase',
  },
  {
    key: 'guidFragmentHash',
    tag: 'gf',
    weight: 0,
    isStrongHash: false,
    isMatchable: false,
    isContent: false,
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
    normalizeFn: (item) => normalizeLinkForHashing(item.link),
    ladderRung: 'linkBase',
  },
  {
    key: 'linkFragmentHash',
    tag: 'lf',
    weight: 0,
    isStrongHash: false,
    isMatchable: false,
    isContent: false,
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
    normalizeFn: (item) => normalizeEnclosureForHashing(item.enclosures),
    ladderRung: 'enclosure',
  },
  {
    key: 'titleHash',
    tag: 't',
    weight: 4,
    isStrongHash: false,
    isMatchable: true,
    isContent: true,
    normalizeFn: (item) => normalizeTextForHashing(item.title),
    ladderRung: 'title',
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

// All hash keys derived from hashMeta.
export const hashKeys: Array<HashKey> = hashMeta.map((meta) => meta.key)
