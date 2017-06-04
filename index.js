//  Google Cloud Function sendToUbidots is triggered when a
//  Sigfox message is sent to the PubSub message queue
//  sigfox.types.sendToUbidots.
//  We call the Ubidots API to send the Sigfox message to Ubidots.

//  //////////////////////////////////////////////////////////////////////////////////////////
//  Begin Common Declarations

/* eslint-disable camelcase, no-console, no-nested-ternary, import/no-dynamic-require,
 import/newline-after-import, import/no-unresolved, global-require, max-len */
if (process.env.FUNCTION_NAME) {
  //  Load the Google Cloud Trace and Debug Agents before any require().
  //  Only works in Cloud Function.
  require('@google-cloud/trace-agent').start();
  require('@google-cloud/debug-agent').start();
}
const sgcloud = require('sigfox-gcloud'); //  sigfox-gcloud Framework
const ubidots = require('ubidots');       //  Ubidots API
const config = require('../config.json');  //  Ubidots API Key

//  End Common Declarations
//  //////////////////////////////////////////////////////////////////////////////////////////

//  //////////////////////////////////////////////////////////////////////////////////////////
//  Begin Message Processing Code

const apiKey = config['ubidots-api-key'];
if (!apiKey || apiKey.indexOf('YOUR_') === 0) {  //  Halt if we see YOUR_API_KEY.
  throw new Error('ubidots-api-key is missing from config.json');
}
let client = null;  //  Ubidots API client.

function debug(res) {
  //  Debug the result of a promise.  Return the same promise to the next in chain.
  console.log(JSON.stringify({ res }, null, 2));
  debugger;
  return res;
}

function promisfy(func) {
  //  Convert the callback-style function in func and return as a promise.
  return new Promise((resolve, reject) =>
    func((err, res) => (err ? reject(err) : resolve(res))))
    .catch((error) => { throw error; });
}

function init(req) {
  //  This function is called to initialise the Ubidots API client.
  //  If already initialised, quit.  Returns a promise for the client.
  if (client) return Promise.resolve(client);
  const datasourceName = '???';
  const variableName = '???';
  const newValue = 123;
  let allDatasources = null;
  let datasource = null;
  let datasourceDetails = null;
  let allVariables = null;
  let variable = null;
  let variableDetails = null;
  let value = null;

  //  Create the Ubidots API client and authenticate with Ubidots.
  client = ubidots.createClient(apiKey);
  //  Must bind so that "this" is correct.
  return promisfy(client.auth.bind(client))
    .then(debug)
    .then(res => promisfy(client.getDatasources.bind(client)))
    .then(debug)
    .then(res => { allDatasources = res; })
    .then(res => client.getDatasource(() => datasourceName))
    .then(debug)
    .then(res => { datasource = res; })
    .then(res => promisfy(datasource.getVariables.bind(datasource)))
    .then(debug)
    .then(res => { allVariables = res; })
    .then(res => promisfy(datasource.getDetails.bind(datasource)))
    .then(debug)
    .then(res => { datasourceDetails = res; })
    .then(res => client.getVariable(variableName))
    .then(debug)
    .then(res => { variable = res; })
    .then(res => promisfy(variable.getDetails.bind(variable)))
    .then(debug)
    .then(res => { variableDetails = res; })
    .then(res => promisfy(variable.getValues.bind(variable)))
    .then(debug)
    .then(res => { value = res; })
    .then(res => variable.saveValue(newValue))
    .then(debug)
    .catch((error) => { throw error; });

  /*
   client.auth(() => {
    this.getDatasources((err, data) => {
      console.log(data.results);
      debugger;
    });

    const ds = this.getDatasource('xxxxxxxx');

    ds.getVariables((err, data) => {
      console.log(data.results);
    });

    ds.getDetails((err, details) => {
      console.log(details);
    });

    const v = this.getVariable('xxxxxxx');

    v.getDetails((err, details) => {
      console.log(details);
    });

    v.saveValue(22);

    v.getValues((err, data) => {
      console.log(data.results);
    });
    */
}
init({});

function task(req, device, body, msg) {
  //  The task for this Google Cloud Function: Send the body of the
  //  Sigfox message to Ubidots by calling the Ubidots API.
  //  return processMessage(req, body)
  return Promise.resolve(body) //
    //  Return the message with the body updated.
    .then(updatedBody => Object.assign({}, msg, { body: updatedBody }))
    .catch((error) => { throw error; });
}

//  End Message Processing Code
//  //////////////////////////////////////////////////////////////////////////////////////////

//  //////////////////////////////////////////////////////////////////////////////////////////
//  Main Function

//  When this Google Cloud Function is triggered, we call main() then task().
exports.main = event => sgcloud.main(event, task);

//  Expose the task function for unit test only.
exports.task = task;
