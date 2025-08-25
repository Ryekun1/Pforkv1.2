// components/SolBalanceCard.tsx
"use client"
import { useEffect, useState, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useConnection } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"

function short(pk: string) {
  return pk.slice(0, 4) + "…" + pk.slice(-4)
}

export default function SolBalanceCard() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const [loading, setLoading] = useState(false)
  const [sol, setSol] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!connected || !publicKey) return
    try {
      setLoading(true)
      setErr(null)
      // Ensure we pass a PublicKey and query mainnet-beta
      const lamports = await connection.getBalance(new PublicKey(publicKey), { commitment: "processed" })
      setSol(lamports / LAMPORTS_PER_SOL)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setSol(null)
    } finally {
      setLoading(false)
    }
  }, [connected, publicKey, connection])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return (
    <div className="rounded-xl border p-4 bg-green-50">
      <div className="text-sm text-gray-600">SOL Balance {publicKey ? `(${short(publicKey.toBase58())})` : ""}</div>
      <div className="text-2xl font-semibold">
        {connected ? (sol !== null ? sol.toFixed(4) + " SOL" : loading ? "Loading…" : "—") : "Connect wallet"}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={fetchBalance}
          disabled={!connected || loading}
          className="rounded-md px-3 py-1 border"
          title="Refresh"
        >
          ↻
        </button>
      </div>
      {err && <div className="mt-2 text-xs text-red-600">Error: {err}</div>}
    </div>
  )
}
