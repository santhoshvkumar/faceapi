import {getLargestFace, getTargetFace, sleep} from '../../shared/helper';
import {enrollFeedbackAction} from '../feedback/enrollFeedbackAction';
import {CONFIG} from '../../env/env.json';
import * as constants from '../../shared/constants';
import {filterFaceAction} from '../filtering/qualityFilteringAction';
import {FEEDBACK} from '../filtering/filterFeedback';

// Detects and Filters faces
export const getFilteredFaceAction = (frameData) => {
  return async (dispatch) => {
    let face = await dispatch(detectFaceAction(frameData));

    if (face.faceId) {
      let passedFilters = dispatch(filterFaceAction(face));
      return passedFilters ? face : {};
    }

    return {};
  };
};

// Detects a face
export const detectFaceAction = (frameData) => {
  return async (dispatch) => {
    // Detect face
    let detectEndpoint =
      constants.FACEAPI_ENDPOINT +
      constants.DETECT_ENDPOINT +
      '?' +
      constants.FACE_ATTRIBUTES +
      '&' +
      constants.REC_MODEL;

    let response = await fetch(detectEndpoint, {
      method: 'POST',
      headers: {
        'User-Agent': constants.USER_AGENT,
        'Content-Type': 'application/octet-stream',
        Accept: 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': constants.FACEAPI_KEY,
      },
      body: frameData,
    });

    if (response.status == '200') {
      let result = await response.text();
      let detectResult = JSON.parse(result);
      let faceToEnroll = getLargestFace(detectResult);

      // If no face, report no face detected
      if (!faceToEnroll.faceId) {
        // dispatch no face detected message
        dispatch(enrollFeedbackAction(FEEDBACK.noFaceDetected));
        // return empty face object
        console.log('No face detected');
        return {};
      } else {
        console.log('Face found');
        return faceToEnroll;
      }
    } else {
      console.log('Detect failure: ', response);
      // return empty face object
      return {};
    }
  };
};

// Enrolls a face
export const processFaceAction = (face, frameData) => {
  return async (dispatch, getState) => {
    // If re-enrollment, use the new personId
    let newPersonId = getState().newEnrollment.newRgbPersonId;
    let personId =
      newPersonId && newPersonId != ''
        ? newPersonId
        : getState().userInfo.rgbPersonId;

    // Add face
    let addFaceEndpoint =
      constants.FACEAPI_ENDPOINT +
      constants.ADD_FACE_ENDPOINT(CONFIG.PERSONGROUP_RGB, personId) +
      '?targetFace=' +
      getTargetFace(face);

    let response = await fetch(addFaceEndpoint, {
      method: 'POST',
      headers: {
        'User-Agent': constants.USER_AGENT,
        'Content-Type': 'application/octet-stream',
        Accept: 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': constants.FACEAPI_KEY,
      },
      body: frameData,
    });

    console.log('AddFace status', response.status);
    if (response.status == '200') {
      return true;
    } else {
      let result = await response.text();
      console.log('AddFace Failure', result);
      dispatch(enrollFeedbackAction("Couldn't enroll photo"));
      return false;
    }
  };
};

// Verfies a face
export const verifyFaceAction = (face) => {
  return async (dispatch, getState) => {
    dispatch(enrollFeedbackAction(FEEDBACK.verifying));

    // If re-enrollment, use the new personId
    let newPersonId = getState().newEnrollment.newRgbPersonId;
    let personId =
      newPersonId && newPersonId != ''
        ? newPersonId
        : getState().userInfo.rgbPersonId;

    // Verify
    let verifyEndpoint = constants.FACEAPI_ENDPOINT + constants.VERIFY_ENDPOINT;

    let requestBody = {
      faceId: face.faceId,
      personId: personId,
      largePersonGroupId: CONFIG.PERSONGROUP_RGB,
    };

    let response = await fetch(verifyEndpoint, {
      method: 'POST',
      headers: {
        'User-Agent': constants.USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': constants.FACEAPI_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Verify response', response);

    if (response.status == '200') {
      let result = await response.text();
      let verifyResult = JSON.parse(result);

      if (
        verifyResult.isIdentical == true &&
        verifyResult.confidence >= CONFIG.ENROLL_SETTINGS.VERIFY_CONFIDENCE
      ) {
        return true;
      }
    }

    dispatch(enrollFeedbackAction("Couldn't verify photo"));
    return false;
  };
};

// Trains person group
export const trainAction = () => {
  return async (dispatch, getState) => {
    let maxAttempts = CONFIG.ENROLL_SETTINGS.TRAIN_ATTEMPTS;
    const maxStatusChecks = 50;

    for (let trainAttempts = 0; trainAttempts < maxAttempts; trainAttempts++) {
      console.log('train attempt ', trainAttempts);
      // Train
      let tainEndpoint =
        constants.FACEAPI_ENDPOINT +
        constants.TRAIN_ENDPOINT(CONFIG.PERSONGROUP_RGB);

      let response = await fetch(tainEndpoint, {
        method: 'POST',
        headers: {
          'User-Agent': constants.USER_AGENT,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Ocp-Apim-Subscription-Key': constants.FACEAPI_KEY,
        },
      });

      // If train was accepted, check status
      if (response.status == '202') {
        let trainFailed = false;
        for (
          let statusAttempts = 0;
          statusAttempts < maxStatusChecks && trainFailed == false;
          statusAttempts++
        ) {
          console.log('train status attempt ', statusAttempts);

          // Get training status
          let tainStatusEndpoint =
            constants.FACEAPI_ENDPOINT +
            constants.TRAIN_STATUS_ENDPOINT(CONFIG.PERSONGROUP_RGB);

          let response = await fetch(tainStatusEndpoint, {
            method: 'GET',
            headers: {
              'User-Agent': constants.USER_AGENT,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Ocp-Apim-Subscription-Key': constants.FACEAPI_KEY,
            },
          });

          if (response.status == '200') {
            let result = await response.text();
            let trainingResult = JSON.parse(result);
            if (trainingResult.status == 'succeeded') {
              // Training finished and succeeded
              return true;
            }

            trainFailed = trainingResult.status == 'failed';
          }
          // Wait between status checks
          await sleep(100);
        }
      }

      // Wait between train attempts
      await sleep(100);
    }

    // Training has failed
    return false;
  };
};
