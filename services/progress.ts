export type CardStatus = "new" | "learning" | "mastered";
export type ReviewAction = "hard" | "easy";

export type CardProgressInput = {
    reviewCount: number;
    status: CardStatus;
    totalStudySeconds: number;
};

export type CardProgressOutput = {
    reviewCount: number;
    status: CardStatus;
    lastReviewedAt: Date;
    totalStudySeconds: number;
};

export function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function computeUpdatedCardProgress(
    current: CardProgressInput,
    action: ReviewAction,
    studySeconds = 0,
    now = new Date()
): CardProgressOutput {
    const reviewCount = current.reviewCount + 1;
    const status: CardStatus = action === "easy" ? "mastered" : "learning";

    return {
        reviewCount,
        status,
        lastReviewedAt: now,
        totalStudySeconds: current.totalStudySeconds + Math.max(0, Math.round(studySeconds)),
    };
}

export function formatSecondsToClock(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}
