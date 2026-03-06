/**
 * Algorithmic Bidding & Matchmaking Engine
 * Ranks provider bids for the Client based on provider track record and bid details.
 */

export type ProviderStats = {
  completionRate: number;   // 0–100, % of assigned projects completed
  avgReviewScore: number;   // 0–5
  disputeCount: number;     // total disputes (lower is better)
  completedProjectsCount: number;
};

export type BidDetails = {
  bidAmount: number;
  materialEstimate: number | null;
  timeToCompletionDays: number | null;
  clientBudget?: number;    // optional, for budget adherence scoring
};

/**
 * Computes a single comparable score for a bid (higher = better for client).
 * Weights: completion rate (trust), review score (quality), low disputes (reliability),
 * budget adherence, and reasonable timeline.
 */
export function calculateBidScore(
  providerStats: ProviderStats,
  bidDetails: BidDetails
): number {
  const {
    completionRate,
    avgReviewScore,
    disputeCount,
    completedProjectsCount,
  } = providerStats;
  const { bidAmount, materialEstimate, timeToCompletionDays, clientBudget } = bidDetails;

  // Normalize completion rate 0–100 → 0–1
  const completionScore = Math.min(100, Math.max(0, completionRate)) / 100;

  // Review score 0–5 → 0–1
  const reviewScore = Math.min(5, Math.max(0, avgReviewScore)) / 5;

  // Dispute penalty: 0 disputes = 1, each dispute reduces score
  const disputePenalty = Math.max(0, 1 - disputeCount * 0.15);

  // Experience bonus: more completed projects = slight boost (capped)
  const experienceBonus = Math.min(0.15, completedProjectsCount * 0.03);

  // Budget adherence: under or at client budget is good; over budget penalized
  let budgetScore = 1;
  if (clientBudget != null && clientBudget > 0) {
    const ratio = bidAmount / clientBudget;
    if (ratio <= 1) budgetScore = 0.85 + 0.15 * (1 - ratio); // under budget: small bonus
    else budgetScore = Math.max(0.2, 1 - (ratio - 1));      // over budget: penalty
  }

  // Timeline reasonableness: 1–90 days is fine; no data = neutral
  let timelineScore = 1;
  if (timeToCompletionDays != null && timeToCompletionDays > 0) {
    if (timeToCompletionDays <= 0 || timeToCompletionDays > 365) timelineScore = 0.5;
    else timelineScore = 0.7 + 0.3 * Math.min(1, 90 / timeToCompletionDays);
  }

  // Weighted composite (trust and quality dominate)
  const score =
    completionScore * 0.30 +
    reviewScore * 0.25 +
    disputePenalty * 0.20 +
    budgetScore * 0.15 +
    timelineScore * 0.05 +
    experienceBonus;

  return Math.round(score * 1000) / 1000;
}

/**
 * Ranks applications by score (descending). Returns applications with score attached.
 */
export function rankBids<T extends { provider_id: string; bid_amount?: number; material_estimate?: number | null; time_to_completion_days?: number | null }>(
  applications: T[],
  getProviderStats: (providerId: string) => ProviderStats | null,
  clientBudget?: number
): (T & { bidScore: number })[] {
  const withScores = applications.map((app) => {
    const stats = getProviderStats(app.provider_id);
    const providerStats: ProviderStats = stats ?? {
      completionRate: 0,
      avgReviewScore: 0,
      disputeCount: 0,
      completedProjectsCount: 0,
    };
    const score = calculateBidScore(providerStats, {
      bidAmount: Number(app.bid_amount) || 0,
      materialEstimate: app.material_estimate != null ? Number(app.material_estimate) : null,
      timeToCompletionDays: app.time_to_completion_days != null ? Number(app.time_to_completion_days) : null,
      clientBudget,
    });
    return { ...app, bidScore: score };
  });
  return withScores.sort((a, b) => b.bidScore - a.bidScore);
}
