export type CardStatus = "new" | "learning" | "mastered";
export type ReviewGrade = "hard" | "good" | "easy";

export type CardProgressInput = {
    reviewCount: number;
    easeFactor: number;
    intervalDays: number;
    status: CardStatus;
    totalStudySeconds: number;
};

export type CardProgressOutput = {
    reviewCount: number;
    easeFactor: number;
    intervalDays: number;
    status: CardStatus;
    nextReviewAt: Date;
    lastReviewedAt: Date;
    lastResult: ReviewGrade;
    totalStudySeconds: number;
};

function clampEaseFactor(value: number): number {
    if (value < 1.3) return 1.3;
    if (value > 3.2) return 3.2;
    return Number(value.toFixed(2));
}

export function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function computeNextCardProgress(
    current: CardProgressInput,
    grade: ReviewGrade,
    studySeconds = 0,
    now = new Date()
): CardProgressOutput {
    const currentInterval = current.intervalDays > 0 ? current.intervalDays : 0;
    const currentEase = current.easeFactor > 0 ? current.easeFactor : 2.5;

    let nextEase = currentEase;
    let nextInterval = currentInterval;

    if (current.reviewCount === 0) {
        if (grade === "hard") {
            nextInterval = 1;
            nextEase = currentEase - 0.2;
        } else if (grade === "good") {
            nextInterval = 2;
            nextEase = currentEase;
        } else {
            nextInterval = 4;
            nextEase = currentEase + 0.1;
        }
    } else {
        if (grade === "hard") {
            nextInterval = Math.max(1, Math.round(Math.max(1, currentInterval) * 0.6));
            nextEase = currentEase - 0.2;
        } else if (grade === "good") {
            nextInterval = Math.max(1, Math.round(Math.max(1, currentInterval) * currentEase));
            nextEase = currentEase + 0.05;
        } else {
            nextInterval = Math.max(2, Math.round(Math.max(1, currentInterval) * currentEase * 1.3));
            nextEase = currentEase + 0.1;
        }
    }

    const reviewCount = current.reviewCount + 1;
    const easeFactor = clampEaseFactor(nextEase);

    let status: CardStatus = "learning";
    if (reviewCount <= 1 && grade === "hard") {
        status = "new";
    } else if (nextInterval >= 21 || reviewCount >= 8) {
        status = "mastered";
    }

    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

    return {
        reviewCount,
        easeFactor,
        intervalDays: nextInterval,
        status,
        nextReviewAt,
        lastReviewedAt: now,
        lastResult: grade,
        totalStudySeconds: current.totalStudySeconds + Math.max(0, Math.round(studySeconds)),
    };
}

export function getDifficultyLabel(easeFactor: number): "hard" | "medium" | "easy" {
    if (easeFactor < 2) return "hard";
    if (easeFactor < 2.6) return "medium";
    return "easy";
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
