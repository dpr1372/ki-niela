export type ScoreResult = {
  points: number
  reason: 'Marcador exacto' | 'Ganador correcto' | 'Empate correcto' | 'Sin acierto'
}

// For knockouts: result is based on 90' or 120' score, penalties excluded.
// If after 120' it's a draw, it counts as draw regardless of penalty winner.
export function calculateScore(
  predictedHome: number,
  predictedAway: number,
  officialHome: number,
  officialAway: number,
  isStar: boolean,
): ScoreResult {
  const exactPoints = isStar ? 5 : 3
  const winnerPoints = isStar ? 3 : 1
  const drawPoints = isStar ? 3 : 1

  const exactMatch = predictedHome === officialHome && predictedAway === officialAway

  if (exactMatch) {
    return { points: exactPoints, reason: 'Marcador exacto' }
  }

  const predictedWinner = getWinner(predictedHome, predictedAway)
  const officialWinner = getWinner(officialHome, officialAway)

  if (predictedWinner === 'draw' && officialWinner === 'draw') {
    return { points: drawPoints, reason: 'Empate correcto' }
  }

  if (predictedWinner !== 'draw' && predictedWinner === officialWinner) {
    return { points: winnerPoints, reason: 'Ganador correcto' }
  }

  return { points: 0, reason: 'Sin acierto' }
}

function getWinner(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}
