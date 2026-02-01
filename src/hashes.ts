import { defaultStrippedParams, type NormalizeOptions, normalizeUrl } from 'feedcanon'
import { generateChecksum128 } from './helpers.js'
import type { CollisionProfile, HashableItem, ItemHashes } from './types.js'

const normalizeOptions: NormalizeOptions = {
  stripProtocol: true,
  stripAuthentication: true,
  stripWww: true,
  stripTrailingSlash: true,
  stripHash: true,
  sortQueryParams: true,
  stripQueryParams: defaultStrippedParams,
  stripEmptyQuery: true,
  normalizeEncoding: true,
  normalizeUnicode: true,
}

// Same as normalizeOptions but keeps fragments. Used for linkFragmentHash
// where the fragment is the sole differentiator between items
// (e.g. haveibeenpwned.com/PwnedWebsites#Earth2 vs #LimeVPN).
const normalizeWithFragmentOptions: NormalizeOptions = {
  ...normalizeOptions,
  stripHash: false,
}

// Trim + normalize URL. Feeds often contain whitespace-only strings that
// feedcanon returns as-is (garbage). Guard against that with a trim check.
const safeNormalizeUrl = (value: string): string | undefined => {
  const trimmed = value.trim()

  if (trimmed === '') {
    return
  }

  return normalizeUrl(trimmed, normalizeOptions)
}

// Normalize link for hashing to prevent duplicates from URL variations like
// http vs https, trailing slashes, www prefix, UTM params, etc.
export const normalizeLinkForHashing = (link: string | undefined): string | undefined => {
  if (!link) {
    return
  }

  return safeNormalizeUrl(link)
}

// Normalize link preserving fragment for disambiguation. Only called when
// link contains '#'. Applies same normalization as normalizeLinkForHashing
// but keeps the fragment intact.
export const normalizeLinkWithFragmentForHashing = (
  link: string | undefined,
): string | undefined => {
  if (!link) {
    return
  }

  const trimmed = link.trim()

  if (trimmed === '') {
    return
  }

  return normalizeUrl(trimmed, normalizeWithFragmentOptions)
}

// Normalize GUID for hashing. 70% of GUIDs are URLs — normalize those
// the same way as links. Non-URL GUIDs are opaque strings, just trimmed.
export const normalizeGuidForHashing = (guid: string | undefined): string | undefined => {
  if (!guid) {
    return
  }

  const trimmed = guid.trim()

  if (trimmed === '') {
    return
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return normalizeLinkForHashing(trimmed) || trimmed
  }

  return trimmed
}

// Select preferred enclosure (isDefault first, then first with URL) and normalize
// for hashing. Keeps non-tracking query params (identity can live there).
// TODO: Improve stability by normalizing+sorting all enclosure URLs instead of
// picking one. Current approach changes hash if feed reorders enclosures or
// toggles isDefault between scans, causing false duplicates over time.
export const normalizeEnclosureForHashing = (
  enclosures: Array<{ url?: string; isDefault?: boolean }> | undefined,
): string | undefined => {
  if (!enclosures?.length) {
    return
  }

  const defaultEnclosure = enclosures.find((enclosure) => enclosure.isDefault && enclosure.url)
  const firstEnclosure = enclosures.find((enclosure) => enclosure.url)
  const url = defaultEnclosure?.url ?? firstEnclosure?.url

  if (!url) {
    return
  }

  return safeNormalizeUrl(url)
}

// Collapse whitespace and lowercase for text-based hashing (title).
export const normalizeTextForHashing = (text: string | undefined): string | undefined => {
  if (!text) {
    return
  }

  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase()

  if (normalized === '') {
    return
  }

  return normalized
}

// Normalize HTML content for hashing (summary, content).
// TODO: Strip HTML tags → plain text before normalizing. Currently delegates
// to normalizeTextForHashing which only handles whitespace/case. A proper
// implementation would strip tags so that markup-only changes (different
// wrapper elements, whitespace in tags, ad markup) don't affect the hash.
export const normalizeHtmlForHashing = (html: string | undefined): string | undefined => {
  return normalizeTextForHashing(html)
}

// Build a tagged key for the DB insert guard (identifierHash). Excludes
// titleHash when any strong hash (guid/link/enclosure) exists, as title edits
// should not change the insert key. Includes fragment hashes so items
// differing only by fragment (e.g. #Earth2 vs #LimeVPN) get distinct
// identities. Returns undefined when no hashes exist.
export const buildIdentifierKey = (hashes: ItemHashes): string | undefined => {
  const hasStrongHash = hashes.guidHash || hashes.linkHash || hashes.enclosureHash

  if (!hasStrongHash && !hashes.titleHash) {
    return
  }

  return [
    `g:${hashes.guidHash ?? ''}`,
    `gf:${hashes.guidFragmentHash ?? ''}`,
    `l:${hashes.linkHash ?? ''}`,
    `lf:${hashes.linkFragmentHash ?? ''}`,
    `e:${hashes.enclosureHash ?? ''}`,
    `t:${hasStrongHash ? '' : (hashes.titleHash ?? '')}`,
  ].join('|')
}

const emptyCollisions: CollisionProfile = {
  collidingGuids: new Set(),
  collidingGuidFragments: new Set(),
  collidingLinks: new Set(),
  collidingLinkFragments: new Set(),
  collidingEnclosures: new Set(),
  collidingTitles: new Set(),
  collidingContents: new Set(),
  collidingSummaries: new Set(),
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
  collisions: CollisionProfile = emptyCollisions,
): string | undefined => {
  // GUID path: strongest signal.
  if (hashes.guidHash) {
    if (!collisions.collidingGuids.has(hashes.guidHash)) {
      return `g:${hashes.guidHash}`
    }

    if (isSafeSplitter(hashes.guidFragmentHash, collisions.collidingGuidFragments)) {
      return `g:${hashes.guidHash}|gf:${hashes.guidFragmentHash}`
    }

    if (isSafeSplitter(hashes.enclosureHash, collisions.collidingEnclosures)) {
      return `g:${hashes.guidHash}|e:${hashes.enclosureHash}`
    }

    if (isSafeSplitter(hashes.linkHash, collisions.collidingLinks)) {
      return `g:${hashes.guidHash}|l:${hashes.linkHash}`
    }

    if (isSafeSplitter(hashes.linkFragmentHash, collisions.collidingLinkFragments)) {
      return `g:${hashes.guidHash}|lf:${hashes.linkFragmentHash}`
    }

    if (isSafeSplitter(hashes.titleHash, collisions.collidingTitles)) {
      return `g:${hashes.guidHash}|t:${hashes.titleHash}`
    }

    return
  }

  // Link path.
  if (hashes.linkHash) {
    if (!collisions.collidingLinks.has(hashes.linkHash)) {
      return `l:${hashes.linkHash}`
    }

    if (isSafeSplitter(hashes.linkFragmentHash, collisions.collidingLinkFragments)) {
      return `l:${hashes.linkHash}|lf:${hashes.linkFragmentHash}`
    }

    if (isSafeSplitter(hashes.enclosureHash, collisions.collidingEnclosures)) {
      return `l:${hashes.linkHash}|e:${hashes.enclosureHash}`
    }

    if (isSafeSplitter(hashes.titleHash, collisions.collidingTitles)) {
      return `l:${hashes.linkHash}|t:${hashes.titleHash}`
    }

    return
  }

  // Enclosure-only path (no guid, no link).
  if (hashes.enclosureHash) {
    if (!collisions.collidingEnclosures.has(hashes.enclosureHash)) {
      return `e:${hashes.enclosureHash}`
    }

    return
  }

  // Title path (no strong IDs).
  if (hashes.titleHash) {
    if (!collisions.collidingTitles.has(hashes.titleHash)) {
      return `t:${hashes.titleHash}`
    }

    if (isSafeSplitter(hashes.contentHash, collisions.collidingContents)) {
      return `t:${hashes.titleHash}|c:${hashes.contentHash}`
    }

    if (isSafeSplitter(hashes.summaryHash, collisions.collidingSummaries)) {
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
  const normalizedGuid = normalizeGuidForHashing(feedItem.guid)
  const normalizedLink = normalizeLinkForHashing(feedItem.link)
  const normalizedEnclosure = normalizeEnclosureForHashing(feedItem.enclosures)
  const normalizedTitle = normalizeTextForHashing(feedItem.title)
  const normalizedSummary = normalizeHtmlForHashing(feedItem.summary)
  const normalizedContent = normalizeHtmlForHashing(feedItem.content)

  // Only compute guid fragment hash when GUID is a URL containing '#'.
  // Non-URL GUIDs don't strip fragments during normalization, so the
  // fragment is already part of guidHash — no separate hash needed.
  const isGuidUrl =
    feedItem.guid?.trim().startsWith('http://') || feedItem.guid?.trim().startsWith('https://')
  const normalizedGuidWithFragment =
    isGuidUrl && feedItem.guid?.includes('#')
      ? normalizeLinkWithFragmentForHashing(feedItem.guid)
      : undefined

  // Only compute fragment hash when link contains '#'. Without a fragment,
  // normalization produces the same string as linkHash — wasteful.
  const normalizedLinkWithFragment = feedItem.link?.includes('#')
    ? normalizeLinkWithFragmentForHashing(feedItem.link)
    : undefined

  return {
    guidHash: normalizedGuid ? generateChecksum128(normalizedGuid) : undefined,
    guidFragmentHash: normalizedGuidWithFragment
      ? generateChecksum128(normalizedGuidWithFragment)
      : undefined,
    linkHash: normalizedLink ? generateChecksum128(normalizedLink) : undefined,
    linkFragmentHash: normalizedLinkWithFragment
      ? generateChecksum128(normalizedLinkWithFragment)
      : undefined,
    enclosureHash: normalizedEnclosure ? generateChecksum128(normalizedEnclosure) : undefined,
    titleHash: normalizedTitle ? generateChecksum128(normalizedTitle) : undefined,
    summaryHash: normalizedSummary ? generateChecksum128(normalizedSummary) : undefined,
    contentHash: normalizedContent ? generateChecksum128(normalizedContent) : undefined,
  }
}
