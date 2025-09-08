import { describe, it, expect } from 'vitest'
import { parseItemName, inferConditionFromGrade, extractYear, parseMoney } from '../test-external-integration'

describe('parseItemName', () => {
  it('parses simple item with year, number, and set', () => {
    const r = parseItemName('1999 Base Set Charizard #4 Holo Pokemon')
    expect(r.name).toBe('Charizard Holo')
    expect(r.set?.toLowerCase()).toContain('base set')
    expect(r.number).toBe('4')
  })

  it('handles Japanese and accented Pokémon', () => {
    const r = parseItemName('1997 Japanese Pikachu #NA Pokémon')
    expect(r.name.toLowerCase()).toContain('pikachu')
    expect(r.set?.toLowerCase()).toContain('japanese')
  })

  it('detects variants like 1st Edition and Holo', () => {
    const r = parseItemName("1999 Base Set Charizard 1st Edition Holo #4 Pokemon")
    expect(r.variant?.toLowerCase()).toMatch(/(1st edition|holo)/i)
  })
})

describe('inferConditionFromGrade', () => {
  it('maps numeric 9.5+ to Mint', () => {
    expect(inferConditionFromGrade(undefined, 9.5)).toBe('Mint')
  })

  it('recognizes Gem Mint 10 as Mint', () => {
    expect(inferConditionFromGrade('Gem Mint 10')).toBe('Mint')
  })

  it('treats 8.* as Near Mint via string', () => {
    expect(inferConditionFromGrade('8.5')).toBe('Near Mint')
  })
})

describe('extractYear', () => {
  it('extracts a 4-digit year', () => {
    expect(extractYear('1999 Base Set Charizard')).toBe(1999)
  })

  it('returns undefined when no year is present', () => {
    expect(extractYear('Base Set Charizard')).toBeUndefined()
  })
})

describe('parseMoney', () => {
  it('parses currency strings with symbols and commas', () => {
    expect(parseMoney('$1,234.50')).toBeCloseTo(1234.5, 5)
  })

  it('returns undefined for non-numeric', () => {
    expect(parseMoney('N/A')).toBeUndefined()
  })
})

