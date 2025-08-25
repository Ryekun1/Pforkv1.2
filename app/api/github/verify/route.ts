import { createClient } from "@/lib/supabase/server"
import { verifyRepoOwnership, fetchRepoDetails } from "@/lib/github"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { repoUrl } = await request.json()

    if (!repoUrl) {
      return NextResponse.json({ error: "Repository URL is required" }, { status: 400 })
    }

    // Parse GitHub URL to extract owner and repo name
    const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!urlMatch) {
      return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 })
    }

    const [, owner, repoName] = urlMatch

    // Get the user's GitHub access token
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.provider_token

    if (!accessToken) {
      return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 })
    }

    // Verify ownership
    const isOwner = await verifyRepoOwnership(owner, repoName, accessToken)
    if (!isOwner) {
      return NextResponse.json({ error: "You don't have permission to verify this repository" }, { status: 403 })
    }

    // Fetch repository details
    const repoDetails = await fetchRepoDetails(owner, repoName, accessToken)

    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("github_repo_url", repoUrl)
      .eq("user_id", user.id)
      .single()

    let project
    if (existingProject) {
      // Update existing project
      const { data: updatedProject, error: updateError } = await supabase
        .from("projects")
        .update({
          repo_name: repoDetails.name,
          repo_description: repoDetails.description,
          repo_stars: repoDetails.stargazers_count,
          repo_forks: repoDetails.forks_count,
          repo_language: repoDetails.language,
          repo_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProject.id)
        .select()
        .single()

      if (updateError) {
        console.error("[v0] Database update error:", updateError)
        return NextResponse.json({ error: "Failed to update repository information" }, { status: 500 })
      }
      project = updatedProject
    } else {
      // Insert new project
      const { data: newProject, error: insertError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          github_repo_url: repoUrl,
          repo_name: repoDetails.name,
          repo_description: repoDetails.description,
          repo_stars: repoDetails.stargazers_count,
          repo_forks: repoDetails.forks_count,
          repo_language: repoDetails.language,
          repo_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.error("[v0] Database insert error:", insertError)
        return NextResponse.json({ error: "Failed to save repository information" }, { status: 500 })
      }
      project = newProject
    }

    console.log("[v0] Repository verification successful:", { projectId: project.id, repoUrl })

    return NextResponse.json({
      success: true,
      project,
      repoDetails: {
        name: repoDetails.name,
        description: repoDetails.description,
        stars: repoDetails.stargazers_count,
        forks: repoDetails.forks_count,
        language: repoDetails.language,
      },
    })
  } catch (error) {
    console.error("[v0] Error verifying repository:", error)
    return NextResponse.json({ error: "Failed to verify repository" }, { status: 500 })
  }
}
