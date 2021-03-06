
import test from 'tape-catch';
import destination from '@turf/destination';
import {toLowPrecision} from '../utils/test-utils';

import {
  lngLatToWorld,
  worldToLngLat,
  getMeterZoom,
  getDistanceScales,
  getWorldPosition,
  getUncenteredViewMatrix,
  getViewMatrix,
  getProjectionMatrix,
  worldToPixels,
  pixelsToWorld
} from 'viewport-mercator-project';

import VIEWPORT_PROPS from '../utils/sample-viewports';

const DISTANCE_TOLERANCE = 0.0005;
const DISTANCE_TOLERANCE_PIXELS = 2;
const DISTANCE_SCALE_TEST_ZOOM = 12;

test('Viewport#imports', t => {
  t.ok(lngLatToWorld, 'lngLatToWorld imports OK');
  t.ok(worldToLngLat, 'worldToLngLat imports OK');
  t.ok(getMeterZoom, 'getMeterZoom imports OK');
  t.ok(getWorldPosition, 'getWorldPosition imports OK');
  t.ok(getViewMatrix, 'getViewMatrix imports OK');
  t.ok(getUncenteredViewMatrix,
    'getUncenteredViewMatrix imports OK');
  t.ok(getProjectionMatrix, 'getProjectionMatrix imports OK');
  t.ok(worldToPixels, 'worldToPixels imports OK');
  t.ok(pixelsToWorld, 'pixelsToWorld imports OK');
  t.end();
});

test('getDistanceScales', t => {
  for (const vc in VIEWPORT_PROPS) {
    const props = VIEWPORT_PROPS[vc];
    const {
      metersPerPixel, pixelsPerMeter, degreesPerPixel, pixelsPerDegree
    } = getDistanceScales(props);

    t.deepEqual([
      toLowPrecision(metersPerPixel[0] * pixelsPerMeter[0]),
      toLowPrecision(metersPerPixel[1] * pixelsPerMeter[1]),
      toLowPrecision(metersPerPixel[2] * pixelsPerMeter[2])
    ], [1, 1, 1], 'metersPerPixel checks with pixelsPerMeter');

    t.deepEqual([
      toLowPrecision(degreesPerPixel[0] * pixelsPerDegree[0]),
      toLowPrecision(degreesPerPixel[1] * pixelsPerDegree[1]),
      toLowPrecision(degreesPerPixel[2] * pixelsPerDegree[2])
    ], [1, 1, 1], 'degreesPerPixel checks with pixelsPerDegree');
  }
  t.end();
});

test('getDistanceScales#pixelsPerDegree', t => {
  const scale = Math.pow(2, DISTANCE_SCALE_TEST_ZOOM);
  const z = 1000;

  for (const vc in VIEWPORT_PROPS) {
    t.comment(vc);
    const props = VIEWPORT_PROPS[vc];
    const {longitude, latitude} = props;
    const {pixelsPerDegree, pixelsPerDegree2} =
      getDistanceScales({longitude, latitude, scale, highPrecision: true});

    // Test degree offsets
    for (const delta of [0.001, 0.01, 0.05, 0.1, 0.3]) {
      t.comment(`R = ${delta} degrees`);

      // To pixels
      const coords = [
        delta * pixelsPerDegree[0],
        delta * pixelsPerDegree[1],
        z * pixelsPerDegree[2]
      ];
      const coordsAdjusted = [
        delta * (pixelsPerDegree[0] + pixelsPerDegree2[0] * delta),
        delta * (pixelsPerDegree[1] + pixelsPerDegree2[1] * delta),
        z * (pixelsPerDegree[2] + pixelsPerDegree2[2] * delta)
      ];

      const pt = [longitude + delta, latitude + delta];

      const realCoords = [
        lngLatToWorld(pt, scale)[0] - lngLatToWorld([longitude, latitude], scale)[0],
        -(lngLatToWorld(pt, scale)[1] - lngLatToWorld([longitude, latitude], scale)[1]),
        z * getDistanceScales({longitude: pt[0], latitude: pt[1], scale}).pixelsPerMeter[2]
      ];

      const diff = getDiff(coords, realCoords);
      const diffAdjusted = getDiff(coordsAdjusted, realCoords);

      t.comment(`unadjusted: ${diff.message}`);
      t.comment(`adjusted: ${diffAdjusted.message}`);

      t.ok(diffAdjusted.error.every(e => e < DISTANCE_TOLERANCE),
        'Error within ratio tolerance');
      t.ok(diffAdjusted.errorPixels.every(p => p < DISTANCE_TOLERANCE_PIXELS),
        'Error within pixel tolerance');
    }
  }
  t.end();
});

test('getDistanceScales#pixelsPerMeter', t => {
  const scale = Math.pow(2, DISTANCE_SCALE_TEST_ZOOM);
  const z = 1000;

  for (const vc in VIEWPORT_PROPS) {
    t.comment(vc);
    const props = VIEWPORT_PROPS[vc];
    const {longitude, latitude} = props;
    const {pixelsPerMeter, pixelsPerMeter2} =
      getDistanceScales({latitude, longitude, scale, highPrecision: true});

    // Test degree offsets
    for (const delta of [10, 100, 1000, 5000, 10000, 30000]) {
      t.comment(`R = ${delta} meters`);

      // To pixels
      const coords = [
        delta * pixelsPerMeter[0],
        delta * pixelsPerMeter[1],
        z * pixelsPerMeter[2]
      ];
      const coordsAdjusted = [
        delta * (pixelsPerMeter[0] + pixelsPerMeter2[0] * delta),
        delta * (pixelsPerMeter[1] + pixelsPerMeter2[1] * delta),
        z * (pixelsPerMeter[2] + pixelsPerMeter2[2] * delta)
      ];

      let pt = [longitude, latitude];
      // turf unit is kilometers
      pt = destination(pt, delta / 1000 * Math.sqrt(2), 45);
      pt = pt.geometry.coordinates;

      const realCoords = [
        lngLatToWorld(pt, scale)[0] - lngLatToWorld([longitude, latitude], scale)[0],
        -(lngLatToWorld(pt, scale)[1] - lngLatToWorld([longitude, latitude], scale)[1]),
        z * getDistanceScales({longitude: pt[0], latitude: pt[1], scale}).pixelsPerMeter[2]
      ];

      const diff = getDiff(coords, realCoords);
      const diffAdjusted = getDiff(coordsAdjusted, realCoords);

      t.comment(`unadjusted: ${diff.message}`);
      t.comment(`adjusted: ${diffAdjusted.message}`);

      t.ok(diffAdjusted.error.every(e => e < DISTANCE_TOLERANCE),
        'Error within ratio tolerance');
      t.ok(diffAdjusted.errorPixels.every(p => p < DISTANCE_TOLERANCE_PIXELS),
        'Error within pixel tolerance');
    }
  }
  t.end();
});

function getDiff(value, baseValue) {
  const errorPixels = value.map((v, i) => Math.abs(v - baseValue[i]));
  const error = value.map((v, i) =>
    Math.abs(v - baseValue[i]) / Math.min(Math.abs(v), Math.abs(baseValue[i])));

  return {
    errorPixels,
    error,
    message: `off by \
      (${errorPixels.map(d => d.toFixed(3)).join(', ')}) pixels, \
      (${error.map(d => `${(d * 100).toFixed(3)}%`).join(', ')})`
  };
}
