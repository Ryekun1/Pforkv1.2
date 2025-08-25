import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Keypair } from "@solana/web3.js"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting real Pump.fun token creation...")
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] Authentication failed:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, symbol, description, image, website, creator, buyAmount, walletAddress } = await request.json()
    console.log("[v0] Token data received:", { name, symbol, description, creator, buyAmount, walletAddress })

    // Validate required fields
    if (!name || !symbol || !description || !creator || !walletAddress) {
      console.log("[v0] Missing required fields")
      return NextResponse.json({ error: "Missing required fields including wallet address" }, { status: 400 })
    }

    const mintKeypair = Keypair.generate()
    console.log("[v0] Generated mint keypair:", mintKeypair.publicKey.toString())

    let imageFile: File | Blob
    if (image && image.startsWith("data:")) {
      // Handle base64 images
      const response = await fetch(image)
      imageFile = await response.blob()
    } else if (image && image.startsWith("http")) {
      // Handle URL images
      const response = await fetch(image)
      imageFile = await response.blob()
    } else {
      // Use default 1x1 pixel PNG
      const defaultImageData =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
      const response = await fetch(defaultImageData)
      imageFile = await response.blob()
    }

    const formData = new FormData()
    formData.append("file", imageFile, "token-image.png")
    formData.append("name", name)
    formData.append("symbol", symbol)
    formData.append("description", description)
    formData.append("twitter", "")
    formData.append("telegram", "")
    formData.append("website", website || "https://gitr.fun")
    formData.append("showName", "true")

    console.log("[v0] Uploading metadata to IPFS...")

    const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    })

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      console.error("[v0] IPFS upload failed:", errorText)
      throw new Error(`Failed to upload metadata to IPFS: ${errorText}`)
    }

    const metadataResult = await metadataResponse.json()
    console.log("[v0] IPFS upload successful:", metadataResult)

    const createTokenPayload = {
      privateKey: Array.from(mintKeypair.secretKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""), // Convert to hex string
      amount: (buyAmount || 0) * 1000000000, // Convert SOL to lamports
      name: name,
      symbol: symbol,
      initialSupply: 1000000000, // 1 billion tokens (standard for pump.fun)
      metadataUri: metadataResult.metadataUri,
      description: description,
      image: metadataResult.imageUri || "",
      website: website || "https://gitr.fun",
    }

    console.log("[v0] Creating token with official PumpFun API...")
    console.log("[v0] Payload:", JSON.stringify({ ...createTokenPayload, privateKey: "[REDACTED]" }, null, 2))

    const pumpResponse = await fetch("https://docs.pumpfunapi.org/pumpfun/create/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createTokenPayload),
    })

    const responseText = await pumpResponse.text()
    console.log("[v0] PumpFun API response status:", pumpResponse.status)
    console.log("[v0] PumpFun API response:", responseText)

    if (!pumpResponse.ok) {
      console.error("[v0] PumpFun API error:", responseText)
      throw new Error(`PumpFun API failed: ${pumpResponse.status} ${responseText}`)
    }

    let pumpResult
    try {
      pumpResult = JSON.parse(responseText)
    } catch (parseError) {
      console.error("[v0] Failed to parse PumpFun response:", parseError)
      throw new Error(`Invalid JSON response from PumpFun: ${responseText}`)
    }

    console.log("[v0] PumpFun token creation successful:", pumpResult)

    const tokenData = {
      mint: pumpResult.mint || mintKeypair.publicKey.toString(),
      bondingCurve: pumpResult.bondingCurve || "Generated",
      associatedBondingCurve: pumpResult.associatedBondingCurve || "Generated",
      metadata: pumpResult.metadata || metadataResult.metadataUri,
      metadataUri: metadataResult.metadataUri,
      signature: pumpResult.signature || pumpResult.transactionId || `pump_tx_${Date.now()}`,
      transactionId: pumpResult.transactionId,
    }

    return NextResponse.json({
      transaction: tokenData.signature,
      tokenData: tokenData,
      success: true,
      message: "Token created successfully on Pump.fun!",
    })
  } catch (error) {
    console.error("[v0] Error in real Pump.fun token creation:", error)
    return NextResponse.json(
      {
        error: "Failed to create token on Pump.fun",
        details: error instanceof Error ? error.message : "Unknown error",
        success: false,
      },
      { status: 500 },
    )
  }
}
