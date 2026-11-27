import { describe, expect, it } from "vitest";
import { DEFAULT_W, Rating, newCard, nextIntervalDays, pickDue, ratingFromOutcome, retrievability, review } from "../src/fsrs";

const DAY = 86_400_000;
const t0 = new Date("2026-11-01T10:00:00Z");
const at = (days: number) => new Date(t0.getTime() + days * DAY);

describe("FSRS update", () => {
  it("first review uses initial stability w[G-1] and bounded difficulty", () => {
    for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      const c = review(newCard(t0), g, t0);
      expect(c.stability).toBeCloseTo(DEFAULT_W[g - 1], 5);
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(10);
      expect(c.reps).toBe(1);
      expect(c.last_review).toBe(t0.toISOString());
    }
  });

  it("easier first ratings give lower difficulty", () => {
    const d = [1, 2, 3, 4].map((g) => review(newCard(t0), g as Rating, t0).difficulty);
    expect(d[0]).toBeGreaterThan(d[1]);
    expect(d[1]).toBeGreaterThan(d[2]);
    expect(d[2]).toBeGreaterThan(d[3]);
  });

  it("Good on time increases stability and pushes due further out", () => {
    const c1 = review(newCard(t0), Rating.Good, t0);
    const c2 = review(c1, Rating.Good, new Date(c1.due));
    expect(c2.stability).toBeGreaterThan(c1.stability);
    expect(new Date(c2.due).getTime() - new Date(c1.due).getTime()).toBeGreaterThan(new Date(c1.due).getTime() - t0.getTime());
  });

  it("Again after a gap lowers stability, counts a lapse and comes back in minutes", () => {
    const c1 = review(review(newCard(t0), Rating.Good, t0), Rating.Good, at(3));
    const lapsed = review(c1, Rating.Again, at(20));
    expect(lapsed.stability).toBeLessThan(c1.stability);
    expect(lapsed.lapses).toBe(1);
    expect(new Date(lapsed.due).getTime() - at(20).getTime()).toBe(10 * 60_000);
  });

  it("Hard < Good < Easy for the next stability", () => {
    const c1 = review(newCard(t0), Rating.Good, t0);
    const s = [Rating.Hard, Rating.Good, Rating.Easy].map((g) => review(c1, g, at(3)).stability);
    expect(s[0]).toBeLessThan(s[1]);
    expect(s[1]).toBeLessThan(s[2]);
  });

  it("same-day reviews use short-term stability", () => {
    const c1 = review(newCard(t0), Rating.Good, t0);
    const c2 = review(c1, Rating.Good, new Date(t0.getTime() + 3600_000));
    expect(c2.stability).toBeCloseTo(c1.stability * Math.exp(DEFAULT_W[17] * DEFAULT_W[18]), 5);
  });

  it("retrievability is 0.9 at t = S and interval = S at 90% retention", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
    expect(nextIntervalDays(10)).toBe(10);
    expect(nextIntervalDays(0.1)).toBe(1);
  });

  it("is pure (does not mutate the input card)", () => {
    const c = newCard(t0);
    const snap = JSON.stringify(c);
    review(c, Rating.Good, t0);
    expect(JSON.stringify(c)).toBe(snap);
  });
});

describe("helpers", () => {
  it("maps outcomes to ratings", () => {
    expect(ratingFromOutcome("missed")).toBe(Rating.Again);
    expect(ratingFromOutcome("helped")).toBe(Rating.Hard);
    expect(ratingFromOutcome("unaided", 3000)).toBe(Rating.Good);
    expect(ratingFromOutcome("unaided", 900)).toBe(Rating.Easy);
  });
  it("picks most overdue reviewed chunks first", () => {
    const mk = (id: string, due: Date, reviewed = true) => ({ chunk_id: id, fsrs: { ...newCard(t0), due: due.toISOString(), last_review: reviewed ? t0.toISOString() : null } });
    const items = [mk("a", at(2)), mk("b", at(-1)), mk("c", at(-5)), mk("d", at(-9), false), mk("e", at(0))];
    expect(pickDue(items, at(1), 3)).toEqual(["c", "b", "e"]);
  });
});
