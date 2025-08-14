import { Objective } from "@/types";

/**
 * Calculate points for an objective, optionally capping at the target value
 * @param objective The objective to calculate points for
 * @param currentValue The current progress value
 * @param capedPoints Whether points should be capped at the target value
 * @returns The calculated points
 */
export function calculatePoints(
  objective: Objective,
  currentValue: number,
  capedPoints: boolean = false
): number {
  if (capedPoints) {
    // Cap the current value at the target value
    const cappedValue = Math.min(currentValue, objective.targetValue);
    return cappedValue * objective.pointsPerUnit;
  } else {
    // No capping - allow unlimited points
    return currentValue * objective.pointsPerUnit;
  }
}

/**
 * Calculate total points for multiple objectives
 * @param objectives Array of objectives
 * @param progress Array of progress data
 * @param capedPoints Whether points should be capped at the target value
 * @returns The total calculated points
 */
export function calculateTotalPoints(
  objectives: Objective[],
  progress: Array<{ objectiveId: string; currentValue: number }>,
  capedPoints: boolean = false
): number {
  return progress.reduce((sum, progressItem) => {
    const objective = objectives.find((o) => o.id === progressItem.objectiveId);
    if (objective) {
      return sum + calculatePoints(objective, progressItem.currentValue, capedPoints);
    }
    return sum;
  }, 0);
} 