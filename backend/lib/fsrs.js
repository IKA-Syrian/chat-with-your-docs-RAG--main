/**
 * Minimal FSRS (Free Spaced Repetition Scheduler) implementation.
 *
 * Based on FSRS-4.5 with the default weights from the open-source reference.
 * Implements the bare minimum needed for daily review scheduling — no optimizer,
 * no fuzz factor, no leech detection. Good enough for v1; can swap in a tuned
 * weight set later without touching callers.
 *
 * Ratings:
 *   1 = Again  (forgot)
 *   2 = Hard
 *   3 = Good
 *   4 = Easy
 *
 * State machine:
 *   0 = New    -> after first rating becomes Learning (1)
 *   1 = Learning
 *   2 = Review
 *   3 = Relearning (entered when a Review card gets Again)
 */

// Default FSRS-4.5 weights (open-source reference).
const DEFAULT_W = [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
    0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
    0.6567
];

const REQUEST_RETENTION = 0.9;
const MAXIMUM_INTERVAL = 365 * 5;          // cap at 5 years

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Initial difficulty after the first rating.
const initDifficulty = (rating, w) => clamp(w[4] - (rating - 3) * w[5], 1, 10);

// Initial stability after the first rating.
const initStability = (rating, w) => Math.max(0.1, w[rating - 1]);

// Mean reversion towards the initial difficulty.
const meanReversion = (init, current, w) => w[7] * init + (1 - w[7]) * current;

const nextDifficulty = (d, rating, w) => {
    const dPrime = d - w[6] * (rating - 3);
    return clamp(meanReversion(initDifficulty(3, w), dPrime, w), 1, 10);
};

const forgettingCurve = (elapsedDays, stability) => Math.exp((Math.log(0.9) * elapsedDays) / stability);

const nextRecallStability = (d, s, r, rating, w) => {
    const hardPenalty = rating === 2 ? w[15] : 1;
    const easyBonus = rating === 4 ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
};

const nextForgetStability = (d, s, r, w) => {
    return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
};

const intervalDays = (stability) =>
    Math.min(MAXIMUM_INTERVAL, Math.max(1, Math.round((stability / Math.log(0.9)) * Math.log(REQUEST_RETENTION))));

/**
 * Update FSRS state given a rating.
 *
 * @param {Object} state - existing review row (or empty defaults for new card)
 * @param {1|2|3|4} rating
 * @param {Date}    [now=new Date()]
 * @param {number[]} [weights=DEFAULT_W]
 * @returns {{ stability, difficulty, due_at, state, reps, lapses, last_review, last_rating }}
 */
export function updateFSRS(state = {}, rating, now = new Date(), weights = DEFAULT_W) {
    if (rating < 1 || rating > 4 || !Number.isInteger(rating)) {
        throw new Error(`Invalid rating ${rating} — must be 1..4`);
    }

    const prevState = state.state ?? 0;
    const prevReps = state.reps ?? 0;
    const prevLapses = state.lapses ?? 0;

    let stability = state.stability ?? 0;
    let difficulty = state.difficulty ?? 0;
    let nextState;
    let lapses = prevLapses;

    if (prevState === 0 || prevReps === 0) {
        // First review.
        difficulty = initDifficulty(rating, weights);
        stability = initStability(rating, weights);
        nextState = rating === 1 ? 1 : (rating === 4 ? 2 : 1);
    } else {
        const elapsed = state.last_review
            ? Math.max(0, (now.getTime() - new Date(state.last_review).getTime()) / 86_400_000)
            : 0;
        const retrievability = stability > 0 ? forgettingCurve(elapsed, stability) : 0;

        difficulty = nextDifficulty(difficulty, rating, weights);

        if (rating === 1) {
            stability = nextForgetStability(difficulty, stability, retrievability, weights);
            lapses += 1;
            nextState = 3; // relearning
        } else {
            stability = nextRecallStability(difficulty, stability, retrievability, rating, weights);
            nextState = 2; // review
        }
    }

    const interval = intervalDays(stability);
    const dueAt = new Date(now.getTime() + interval * 86_400_000);

    return {
        stability: Number(stability.toFixed(4)),
        difficulty: Number(difficulty.toFixed(4)),
        due_at: dueAt.toISOString(),
        state: nextState,
        reps: prevReps + 1,
        lapses,
        last_review: now.toISOString(),
        last_rating: rating
    };
}

export const FSRS_RATINGS = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });

export default { updateFSRS, FSRS_RATINGS };
