import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceNavigation,
  freshNavigationFix,
  idleNavigation,
  observeNavigation,
  startNavigation,
  type NavigationFix,
} from "../src/lib/journey-navigation";

// Synthetic coordinates for arrival detection, never used as app destinations.
const stops = [
  { id: "first", coordinates: [1.21, -77.28] as [number, number] },
  { id: "second", coordinates: [1.213, -77.28] as [number, number] },
  { id: "third", coordinates: [1.216, -77.28] as [number, number] },
];
const fix = (
  index: number,
  timestamp: number,
  accuracy = 8,
): NavigationFix => ({
  coordinates: stops[index].coordinates,
  timestamp,
  accuracy,
});

test("arrival requires being within 20 metres with GPS accuracy of 20 metres or better", () => {
  let journey = startNavigation(stops, null, 100000);
  const outside = {
    ...fix(0, 100100),
    coordinates: [1.21027, -77.28] as [number, number],
  };
  journey = observeNavigation(journey, outside, 100100);
  journey = observeNavigation(
    journey,
    { ...outside, timestamp: 103200 },
    103200,
  );
  assert.equal(journey.index, 0);
  assert.equal(journey.candidateAt, null);
  assert.equal(freshNavigationFix(fix(0, 104000, 25), 104000), false);
  const inside = {
    ...fix(0, 105000),
    coordinates: [1.2101, -77.28] as [number, number],
  };
  journey = observeNavigation(journey, inside, 105000);
  journey = observeNavigation(
    journey,
    { ...inside, timestamp: 108100 },
    108100,
  );
  assert.equal(journey.index, 1);
});

test("a journey advances in order after sustained arrival and finishes without repeating a stop", () => {
  let journey = startNavigation(stops, [1.2, -77.28], 100000);
  journey = observeNavigation(journey, fix(0, 100100), 100100);
  assert.equal(journey.index, 0);
  journey = observeNavigation(journey, fix(0, 103100), 103100);
  assert.equal(journey.index, 1);
  assert.deepEqual(journey.origin, stops[0].coordinates);
  assert.equal(observeNavigation(journey, fix(0, 103100), 103100), journey);
  journey = observeNavigation(journey, fix(0, 109000), 109000);
  assert.equal(journey.index, 1);
  journey = observeNavigation(journey, fix(1, 112000), 112000);
  journey = observeNavigation(journey, fix(1, 115000), 115000);
  assert.equal(journey.index, 2);
  journey = observeNavigation(journey, fix(2, 120000), 120000);
  journey = observeNavigation(journey, fix(2, 123000), 123000);
  assert.equal(journey.status, "completed");
  assert.equal(journey.index, 3);
  assert.equal(observeNavigation(journey, fix(2, 130000), 130000), journey);
  assert.equal(advanceNavigation(journey, null, 131000), journey);
});

test("poor accuracy, old fixes and distant readings cannot confirm arrival", () => {
  let journey = startNavigation(stops, null, 100000);
  for (const reading of [
    fix(0, 100100, 200),
    fix(0, 70000),
    fix(1, 100200),
    fix(0, Number.NaN),
    fix(0, 999999999),
  ]) {
    journey = observeNavigation(journey, reading, 100300);
    assert.equal(journey.index, 0);
    assert.equal(journey.candidateAt, null);
  }
  journey = observeNavigation(journey, fix(0, 100400), 100400);
  journey = observeNavigation(journey, fix(0, 103500), 103500);
  assert.equal(journey.index, 1);
});

test("leaving the arrival area or losing precision restarts the confirmation interval", () => {
  let journey = startNavigation(stops, null, 100000);
  journey = observeNavigation(journey, fix(0, 100100), 100100);
  journey = observeNavigation(journey, fix(0, 101000, 100), 101000);
  journey = observeNavigation(journey, fix(0, 103200), 103200);
  assert.equal(journey.index, 0);
  journey = observeNavigation(journey, fix(1, 104000), 104000);
  journey = observeNavigation(journey, fix(0, 105000), 105000);
  assert.equal(journey.index, 0);
  journey = observeNavigation(journey, fix(0, 108100), 108100);
  assert.equal(journey.index, 1);
});

test("nearby stops require moving toward the next stop and cannot be skipped while stationary", () => {
  const nearby = [
    stops[0],
    { id: "nearby", coordinates: [1.2102, -77.28] as [number, number] },
  ];
  let journey = advanceNavigation(
    startNavigation(nearby, null, 100000),
    fix(0, 100100),
    100100,
  );
  journey = observeNavigation(journey, fix(0, 104000), 104000);
  journey = observeNavigation(journey, fix(0, 108000), 108000);
  assert.equal(journey.index, 1);
  assert.equal(journey.candidateAt, null);
  journey = observeNavigation(
    journey,
    { ...fix(0, 112000), coordinates: nearby[1].coordinates },
    112000,
  );
  journey = observeNavigation(
    journey,
    { ...fix(0, 115100), coordinates: nearby[1].coordinates },
    115100,
  );
  assert.equal(journey.status, "completed");
});

test("a GPS interruption requires new arrival confirmation after the signal returns", () => {
  let journey = startNavigation(stops, null, 100000);
  journey = observeNavigation(journey, fix(0, 100100), 100100);
  journey = observeNavigation(journey, fix(0, 130100), 130100);
  assert.equal(journey.index, 0);
  journey = observeNavigation(journey, fix(0, 133200), 133200);
  assert.equal(journey.index, 1);
});

test("manual arrival works without GPS and preserves a pause until the last stop", () => {
  const journey = {
    ...startNavigation(stops, [1.2, -77.28], 100000),
    status: "paused" as const,
  };
  assert.equal(observeNavigation(journey, fix(0, 105000), 105000), journey);
  const next = advanceNavigation(journey, null, 110000);
  assert.equal(next.status, "paused");
  assert.equal(next.originSource, "stop");
  assert.deepEqual(next.origin, stops[0].coordinates);
  assert.deepEqual(
    advanceNavigation(journey, fix(2, 110000), 110000).origin,
    stops[0].coordinates,
  );
  assert.equal(next.index, 1);
  const last = advanceNavigation(
    advanceNavigation(next, null, 120000),
    null,
    130000,
  );
  assert.equal(last.status, "completed");
  assert.equal(startNavigation([], null, 100000), idleNavigation);
});

test("GPS movement updates the marker input without changing the route origin on every fix", () => {
  let journey = startNavigation(stops, null, 100000);
  journey = observeNavigation(journey, fix(2, 100100), 100100);
  const origin = journey.origin;
  journey = observeNavigation(journey, fix(1, 101100), 101100);
  assert.equal(journey.origin, origin);
  assert.equal(
    freshNavigationFix(
      { ...fix(0, 103000), coordinates: [Number.NaN, -77.28] },
      103000,
    ),
    false,
  );
});
