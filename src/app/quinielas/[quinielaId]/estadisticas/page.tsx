'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { PredictionMatrix } from '@/components/quiniela/PredictionMatrix'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BallLoader } from '@/components/ui/BallLoader'

type Stats = {
  totalPoints: number
  exactCount: number
  winnerCount: number
  drawCount: number
  missCount: number
  botCount: number
  manualCount: number
  totalPredictions: number
  totalScored: number
}

type MatrixData = {
  matches: Array<{
    id: string
    homeTeam: string
    awayTeam: string
    homeFifa?: string | null
    awayFifa?: string | null
    officialHome?: number | null
    officialAway?: number | null
    status: string
    isStar: boolean
  }>
  rows: Array<{
    userId: string
    name: string
    isMe: boolean
    cells: Array<{
      matchId: string
      prediction: { home: number; away: number; isBot: boolean } | null
      points: number | null
      reason: string | null
    }>
  }>
}

export default function EstadisticasPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const [tab, setTab] = useState('resumen')

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['stats', quinielaId],
    queryFn: async () => {
      const res = await fetch(`/api/quinielas/${quinielaId}/stats`)
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    refetchInterval: 60_000,
  })

  const { data: matrix, isLoading: matrixLoading } = useQuery<MatrixData>({
    queryKey: ['matrix', quinielaId],
    queryFn: async () => {
      const res = await fetch(`/api/quinielas/${quinielaId}/prediction-matrix`)
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    enabled: tab === 'matriz',
    refetchInterval: 60_000,
  })

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-4">
        <h1 className="text-3xl font-black text-pitch-dark">📊 Estadísticas</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-gray-100 p-1 rounded-xl">
            <TabsTrigger value="resumen" className="text-xs px-3 py-1.5 rounded-lg">Resumen</TabsTrigger>
            <TabsTrigger value="matriz" className="text-xs px-3 py-1.5 rounded-lg">Matriz</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            {statsLoading && <BallLoader label="Cargando estadísticas…" />}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                <StatCard label="Puntos totales" value={stats.totalPoints} color="blue" />
                <StatCard label="Marcadores exactos" value={stats.exactCount} color="green" />
                <StatCard label="Ganador correcto" value={stats.winnerCount} color="sky" />
                <StatCard label="Empates correctos" value={stats.drawCount} color="sky" />
                <StatCard label="Sin acierto" value={stats.missCount} color="red" />
                <StatCard label="Predicciones manuales" value={stats.manualCount} color="gray" />
                <StatCard label="Predicciones bot" value={stats.botCount} color="purple" />
                <StatCard label="Total predicciones" value={stats.totalPredictions} color="gray" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="matriz">
            {matrixLoading && <BallLoader label="Cargando matriz…" />}
            {matrix && <PredictionMatrix matches={matrix.matches} rows={matrix.rows} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-800',
    green: 'bg-green-50 text-green-800',
    sky: 'bg-sky-50 text-sky-800',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-50 text-gray-700',
    purple: 'bg-purple-50 text-purple-800',
  }
  return (
    <div className={`card-pitch rounded-xl p-4 ${colorMap[color] ?? 'bg-gray-50'}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">{label}</p>
      <p className="text-3xl font-black mt-1 tabular-nums">{value}</p>
    </div>
  )
}
