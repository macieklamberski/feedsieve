export const generateHash = (...values: Array<string | null | undefined>) => {
  return new Bun.CryptoHasher('sha256').update(values.join('\0')).digest('hex').slice(0, 32)
}

export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value != null
}
