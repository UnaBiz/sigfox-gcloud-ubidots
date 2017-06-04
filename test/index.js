//  Unit Test
/* global describe:true, it:true, beforeEach:true */
/* eslint-disable import/no-extraneous-dependencies, no-console, no-unused-vars, one-var,
 no-underscore-dangle */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const common = require('sigfox-gcloud');
const moduleTested = require('../index');  //  Module to be tested, i.e. the parent module.

const moduleName = 'sendToUbidots';
const should = chai.should();
chai.use(chaiAsPromised);

let req = {};

//  Test data
/* eslint-disable quotes, max-len */
const testDevice = '2C30EB';
const testData = {  //  Structured msgs with numbers and text fields.
  number: '920e06272731741db051e600',
  text: '8013e569a0138c15c013f929',
};
const testBody = (timestamp, data) => ({
  data,
  ctr: 123,
  lig: 456,
  tmp: 36.9,
  longPolling: false,
  device: testDevice,
  ack: false,
  station: "0000",
  avgSnr: 15.54,
  timestamp: `${timestamp}`,
  seqNumber: 1492,
  lat: 1,
  callbackTimestamp: timestamp,
  lng: 104,
  duplicate: false,
  datetime: "2017-05-07 14:30:51",
  baseStationTime: parseInt(timestamp / 1000, 10),
  snr: 18.86,
  seqNumberCheck: null,
  rssi: -123,
  uuid: "ab0d40bd-dbc5-4076-b684-3f610d96e621",
});
const testMessage = (timestamp, data) => ({
  history: [
    {
      duration: 0,
      end: timestamp,
      timestamp,
      function: "sigfoxCallback",
      latency: null,
    },
  ],
  query: {
    type: moduleName,
  },
  route: [],
  device: testDevice,
  body: testBody(timestamp, data),
  type: moduleName,
});
/*
const testEvent = {
  eventType: "providers/cloud.pubsub/eventTypes/topic.publish",
  resource: `projects/myproject/topics/sigfox.types.${moduleName}`,
  timestamp: "2017-05-07T14:30:53.014Z",
  data: {
    attributes: {
    },
    type: "type.googleapis.com/google.pubsub.v1.PubsubMessage",
    data: "eyJkZXZpY2UiOiIxQzhBN0UiLCJ0eXBlIjoiZGVjb2RlU3RydWN0dXJlZE1lc3NhZ2UiLCJib2R5Ijp7InV1aWQiOiJhYjBkNDBiZC1kYmM1LTQwNzYtYjY4NC0zZjYxMGQ5NmU2MjEiLCJkYXRldGltZSI6IjIwMTctMDUtMDcgMTQ6MzA6NTEiLCJjYWxsYmFja1RpbWVzdGFtcCI6MTQ5NDE2NzQ1MTI0MCwiZGV2aWNlIjoiMUM4QTdFIiwiZGF0YSI6IjkyMGUwNjI3MjczMTc0MWRiMDUxZTYwMCIsImR1cGxpY2F0ZSI6ZmFsc2UsInNuciI6MTguODYsInN0YXRpb24iOiIwMDAwIiwiYXZnU25yIjoxNS41NCwibGF0IjoxLCJsbmciOjEwNCwicnNzaSI6LTEyMywic2VxTnVtYmVyIjoxNDkyLCJhY2siOmZhbHNlLCJsb25nUG9sbGluZyI6ZmFsc2UsInRpbWVzdGFtcCI6IjE0NzY5ODA0MjYwMDAiLCJiYXNlU3RhdGlvblRpbWUiOjE0NzY5ODA0MjYsInNlcU51bWJlckNoZWNrIjpudWxsfSwicXVlcnkiOnsidHlwZSI6ImFsdGl0dWRlIn0sImhpc3RvcnkiOlt7InRpbWVzdGFtcCI6MTQ5NDE2NzQ1MTI0MCwiZW5kIjoxNDk0MTY3NDUxMjQyLCJkdXJhdGlvbiI6MCwibGF0ZW5jeSI6bnVsbCwic291cmNlIjpudWxsLCJmdW5jdGlvbiI6InNpZ2ZveENhbGxiYWNrIn0seyJ0aW1lc3RhbXAiOjE0OTQxNjc0NTI0NTQsImVuZCI6MTQ5NDE2NzQ1MjgzMywiZHVyYXRpb24iOjAuMywibGF0ZW5jeSI6MS4yLCJzb3VyY2UiOiJwcm9qZWN0cy91bmF0dW1ibGVyL3RvcGljcy9zaWdmb3guZGV2aWNlcy5hbGwiLCJmdW5jdGlvbiI6InJvdXRlTWVzc2FnZSJ9XSwicm91dGUiOlsibG9nVG9Hb29nbGVTaGVldHMiXX0=",
  },
  eventId: "121025758478243",
};
*/
/* eslint-enable quotes, max-len */

function startDebug() {
  //  Stub for setting breakpoints on exception.
  if (req.zzz) req.zzz += 1;  //  Will never happen.
}

function getTestMessage(type) {
  //  Return a copy of the test message with timestamp updated.
  const timestamp = Date.now();
  const msg = testMessage(timestamp, testData[type]);
  return msg;
}

describe(moduleName, () => {
  //  Test every exposed function in the module.

  beforeEach(() => {
    //  Erase the request object before every test.
    startDebug();
    req = {};
  });

  it('should send Sigfox message to Ubidots', () => {
    //  Every sigfox-gcloud processing step must have a task
    //  function that performs processing and returns a
    //  message for dispatching.
    const msg = getTestMessage('number');
    const body = msg.body;
    common.log(req, 'unittest', { testDevice, body, msg });
    const promise = moduleTested.task(req, testDevice, body, msg)
      .then((result) => {
        common.log(req, 'unittest', { result });
        debugger;
        return result;
      })
      .catch((error) => {
        common.error(req, 'unittest', { error });
        debugger;
        throw error;
      })
    ;
    return Promise.all([
      promise,
      // promise.should.eventually.have.deep.property('body.ctr').equals(999),
    ]);
  });
});
