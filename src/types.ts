export type TournamentType = 'classic' | 'mixed' | 'team'
export type TournamentStatus = 'setup' | 'active' | 'completed'
export type Gender = 'male' | 'female'
export type PointsPerMatch = 16 | 21 | 24 | 32

export interface Player {
  id: string
  name: string
  gender?: Gender
  rating?: number
}

export interface Team {
  id: string
  name: string
  playerIds: string[]
}

export interface Match {
  id: string
  courtNumber: number
  team1PlayerIds: string[]
  team2PlayerIds: string[]
  score1?: number
  score2?: number
  status: 'scheduled' | 'completed'
}

export interface Round {
  id: string
  roundNumber: number
  matches: Match[]
  restPlayerIds: string[]
}

export interface Tournament {
  id: string
  name: string
  venue: string
  date: string
  type: TournamentType
  courts: number
  pointsPerMatch: PointsPerMatch
  numberOfRounds: number
  players: Player[]
  teams?: Team[]
  rounds: Round[]
  status: TournamentStatus
  createdAt: string
  updatedAt: string
}

export interface Standing {
  id: string
  name: string
  memberNames?: string[]
  points: number
  matches: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
}
