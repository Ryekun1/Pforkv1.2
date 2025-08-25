"use client"
import { useEffect, useState, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useConnection } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey, Connection } from "@solana/web3.js"

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

    const fallbackEndpoints = [
      "https://rpc.helius.xyz/?api-key=public",
      "https://api.mainnet-beta.solana.com",
      "https://solana-api.projectserum.com",
      "https://rpc.ankr.com/solana",
    ]

    try {
      setLoading(true)
      setErr(null)
      console.log("[v0] Fetching SOL balance for:", publicKey.toBase58())

      let lamports: number | null = null
      let lastError: any = null

      // Try primary connection first
      try {
        lamports = await connection.getBalance(new PublicKey(publicKey), { commitment: "processed" })
        console.log("[v0] Primary connection successful, balance:", lamports)
      } catch (primaryError: any) {
        console.log("[v0] Primary connection failed:", primaryError.message)
        lastError = primaryError

        // Try fallback endpoints
        for (const endpoint of fallbackEndpoints) {
          try {
            console.log("[v0] Trying fallback endpoint:", endpoint)
            const fallbackConnection = new Connection(endpoint, "processed")
            lamports = await fallbackConnection.getBalance(new PublicKey(publicKey), { commitment: "processed" })
            console.log("[v0] Fallback connection successful, balance:", lamports)
            break
          } catch (fallbackError: any) {
            console.log("[v0] Fallback endpoint failed:", endpoint, fallbackError.message)
            lastError = fallbackError
          }
        }
      }

      if (lamports !== null) {
        const solBalance = lamports / LAMPORTS_PER_SOL
        setSol(solBalance)
        console.log("[v0] Final SOL balance:", solBalance)
      } else {
        throw lastError || new Error("All RPC endpoints failed")
      }
    } catch (e: any) {
      console.log("[v0] All balance fetch attempts failed:", e.message)
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
          className="rounded-md px-3 py-1 border hover:bg-gray-50 disabled:opacity-50"
          title="Refresh"
        >
          ↻
        </button>
      </div>
      {err && <div className="mt-2 text-xs text-red-600">Error: {err}</div>}
    </div>
  )
}
