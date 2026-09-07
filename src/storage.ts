import type { Tournament } from './types'

const STORAGE_KEY = 'padel_tournaments'

export function loadTournaments(): Tournament[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Tournament[]
  } catch {
    return []
  }
}

export function saveTournaments(tournaments: Tournament[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments))
}
