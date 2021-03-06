import {FEEDBACK} from './filterFeedback';
import {CONFIG} from '../../env/env.json';

const THRESHOLDS = CONFIG.QUALITY_FILTER_SETTINGS;

export default function createQualityFilter() {
  let filters = [];

  for (let filter in THRESHOLDS) {
    filters.push(FILTER_MAP[filter]);
  }

  return filters;
}

export function minimumFaceSize(detectResult) {
  let rect = detectResult.faceRectangle;
  let faceArea = rect.width * rect.height;

  if (faceArea < THRESHOLDS.MINIMUM_FACEAREA) {
    return FEEDBACK.smallFace;
  }

  return FEEDBACK.none;
}

export function yaw(detectResult) {
  let yaw = detectResult.faceAttributes.headPose.yaw;

  if (yaw < THRESHOLDS.YAW.MIN || yaw > THRESHOLDS.YAW.MAX) {
    return FEEDBACK.yawOrRoll;
  }

  return FEEDBACK.none;
}

export function pitch(detectResult) {
  let pitch = detectResult.faceAttributes.headPose.pitch;

  if (pitch < THRESHOLDS.PITCH.MIN || pitch > THRESHOLDS.PITCH.MAX) {
    return FEEDBACK.pitch;
  }

  return FEEDBACK.none;
}

export function roll(detectResult) {
  let roll = detectResult.faceAttributes.headPose.roll;

  if (roll < THRESHOLDS.ROLL.MIN || roll > THRESHOLDS.ROLL.MAX) {
    return FEEDBACK.yawOrRoll;
  }

  return FEEDBACK.none;
}

export function occlusionForehead(detectResult) {
  if (detectResult.faceAttributes.occlusion.foreheadOccluded) {
    return FEEDBACK.occlusion;
  }

  return FEEDBACK.none;
}

export function occlusionEyes(detectResult) {
  if (detectResult.faceAttributes.occlusion.eyeOccluded) {
    return FEEDBACK.occlusion;
  }

  return FEEDBACK.none;
}

export function occlusionMouth(detectResult) {
  if (detectResult.faceAttributes.occlusion.mouthOccluded) {
    return FEEDBACK.occlusion;
  }

  return FEEDBACK.none;
}

export function exposure(detectResult) {
  let exposure = detectResult.faceAttributes.exposure.value;

  if (exposure < THRESHOLDS.EXPOSURE.UNDER) {
    return FEEDBACK.noiseOrExposure;
  }

  if (exposure > THRESHOLDS.EXPOSURE.OVER) {
    return FEEDBACK.noiseOrExposure;
  }

  return FEEDBACK.none;
}

export function blur(detectResult) {
  if (detectResult.faceAttributes.blur.value > THRESHOLDS.BLUR) {
    return FEEDBACK.blur;
  }

  return FEEDBACK.none;
}

export function noise(detectResult) {
  if (detectResult.faceAttributes.noise.value > THRESHOLDS.NOISE) {
    return FEEDBACK.noiseOrExposure;
  }

  return FEEDBACK.none;
}

export function sunglasses(detectResult) {
  let attributes = detectResult.faceAttributes;
  if (attributes.glasses == 'Sunglasses') {
    let sunglassesConfidence = 0;

    for (let accessorie of attributes.accessories) {
      if (accessorie.type == 'glasses') {
        sunglassesConfidence = accessorie.confidence;
      }
    }

    if (sunglassesConfidence >= THRESHOLDS.SUNGLASSES_CONFIDENCE) {
      return FEEDBACK.sunglassesOrMask;
    }
  }

  return FEEDBACK.none;
}

export function mask(detectResult) {
  let maskConfidence = 0;

  for (let accessorie of detectResult.faceAttributes.accessories) {
    if (accessorie.type == 'mask') {
      maskConfidence = accessorie.confidence;
    }

    if (maskConfidence >= THRESHOLDS.MASK_CONFIDENCE) {
      return FEEDBACK.sunglassesOrMask;
    }
  }

  return FEEDBACK.none;
}

// An object to map filter config name to filter function name
// used for creating filters array
export const FILTER_MAP = Object.freeze({
  MINIMUM_FACEAREA: minimumFaceSize,
  YAW: yaw,
  PITCH: pitch,
  ROLL: roll,
  OCCLUSION_FOREHEAD: occlusionForehead,
  OCCLUSION_EYES: occlusionEyes,
  OCCLUSION_MOUTH: occlusionMouth,
  EXPOSURE: exposure,
  BLUR: blur,
  NOISE: noise,
  SUNGLASSES_CONFIDENCE: sunglasses,
  MASK_CONFIDENCE: mask,
});
