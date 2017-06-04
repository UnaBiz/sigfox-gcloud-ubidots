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
const config = require('./config.json');  //  Ubidots API Key

//  End Common Declarations
//  //////////////////////////////////////////////////////////////////////////////////////////

//  //////////////////////////////////////////////////////////////////////////////////////////
//  Begin Message Processing Code

//  Get the API key from environment or config.json.
const apiKey = process.env['ubidots-api-key'] || config['ubidots-api-key'];
if (!apiKey || apiKey.indexOf('YOUR_') === 0) {  //  Halt if we see YOUR_API_KEY.
  throw new Error('ubidots-api-key is missing from config.json');
}
let client = null;  //  Ubidots API client.

//  Map Sigfox device ID to Ubidots datasource, variables:
//  '2C30EB' => {
//    datasource: Datasource for "Sigfox Device 2C30EB",
//    variables: {
//      lig: { variable record for 'lig' }, ...
//  }}
//  datasource should be present after init().  variables and details are loaded upon reference to the device.
const allDevices = {};

function promisfy(func) {
  //  Convert the callback-style function in func and return as a promise.
  return new Promise((resolve, reject) =>
    func((err, res) => (err ? reject(err) : resolve(res))))
    .catch((error) => { throw error; });
}

/* allDatasources contains [{
    "id": "5933e6897625426a4f6efd1b",
    "owner": "http://things.ubidots.com/api/v1.6/users/26539",
    "label": "sigfox-device-2c30eb",
    "parent": null,
    "name": "Sigfox Device 2C30EB",
    "url": "http://things.ubidots.com/api/v1.6/datasources/5933e6897625426a4f6efd1b",
    "context": {},
    "tags": [],
    "created_at": "2017-06-04T10:52:57.172",
    "variables_url": "http://things.ubidots.com/api/v1.6/datasources/5933e6897625426a4f6efd1b/variables",
    "number_of_variables": 3,
    "last_activity": null,
    "description": null,
    "position": null}, ...] */

function processDatasources(req, allDatasources0) {
  //  Process all the datasources from Ubidots.  Each datasource (e.g. Sigfox Device 2C30EB)
  //  should correspond to a Sigfox device (e.g. 2C30EB). We index all datasources
  //  by Sigfox device ID for faster lookup.  Assume all devices names end with
  //  the 6-char Sigfox device ID.
  let normalName = '';
  for (const ds of allDatasources0) {
    //  Normalise the name to uppercase, hex digits.
    //  "Sigfox Device 2C30EB" => "FDECE2C30EB"
    const name = ds.name.toUpperCase();
    for (let i = 0; i < name.length; i += 1) {
      const ch = name[i];
      if (ch < '0' || ch > 'F' || (ch > '9' && ch < 'A')) continue;
      normalName += ch;
    }
    //  Last 5 chars is the Sigfox ID e.g. '2C30EB'.
    if (normalName.length < 5) {
      sgcloud.log(req, 'processDatasources', { msg: 'name_too_short', name });
      continue;
    }
    const device = normalName.substring(normalName.length - 6);
    allDevices[device] = Object.assign({}, allDevices[device], { datasource: ds });
  }
}

/* A variable record looks like: {
  "id": "5933e6977625426a5efbaaef",
  "name": "lig",
  "icon": "cloud-upload",
  "unit": null,
  "label": "lig",
  "datasource": {
  "id": "5933e6897625426a4f6efd1b",
    "name": "Sigfox Device 2C30EB",
    "url": "http://things.ubidots.com/api/v1.6/datasources/5933e6897625426a4f6efd1b"
  },
  "url": "http://things.ubidots.com/api/v1.6/variables/5933e6977625426a5efbaaef",
  "description": null,
  "properties": {},
  "tags": [],
  "values_url": "http://things.ubidots.com/api/v1.6/variables/5933e6977625426a5efbaaef/values",
  "created_at": "2017-06-04T10:53:11.037",
  "last_value": {},
  "last_activity": null,
  "type": 0,
  "derived_expr": "" } */

function getVariablesByDevice(req, device) {
  //  Fetch the Ubidots variables for the specified Sigfox device ID.
  //  Returns a promise for the variables map (name => variable record).
  const dev = allDevices[device];
  if (!dev || !dev.datasource) {
    return Promise.resolve(null);  //  No such device.
  }
  if (dev && dev.variables) {
    return Promise.resolve(dev.variables);  //  Return cached variables.
  }
  //  Given the datasource, read the variables from Ubidots.
  const datasourceId = dev.datasource.id;
  const datasource = client.getDatasource(datasourceId);
  return promisfy(datasource.getVariables.bind(datasource))
    .then(res => res.results)
    .then((res) => {
      //  Index the variables by name.
      const vars = {};
      for (const v of res) {
        const name = v.name;
        vars[name] = v;
      }
      dev.variables = vars;
      return vars;
    })
    .catch((error) => { throw error; });
}

function setVariable(req, device, varname, value) {
  //  Set the Ubidots variable for the specified Sigfox device ID.  value looks like
  //  {"value": "52.1", "timestamp": 1376056359000,
  //    "context": {"lat": 6.1, "lng": -35.1, "status": "driving"}}'
  //  Returns a promise.
  const dev = allDevices[device];
  if (!dev || !dev.datasource) return Promise.resolve(null);  //  No such device.
  //  Load the variables if not loaded.
  return getVariablesByDevice(req, device)
    .then(() => {
      //  Fetch the var by name.
      const v = dev.variables[varname];
      if (!v) return null;  //  No such variable.
      const varid = v.id;
      const clientvar = client.getVariable(varid);
      return clientvar.saveValue(value);
    })
    .catch((error) => { throw error; });
}

function init(req) {
  //  This function is called to initialise the Ubidots API client.
  //  If already initialised, quit.  Returns a promise for the client.
  if (client) return Promise.resolve(client);
  let allDatasources = null;    //  Array of all Ubidots datasources i.e. devices.

  //  Create the Ubidots API client and authenticate with Ubidots.
  client = ubidots.createClient(apiKey);
  //  Must bind so that "this" is correct.
  return promisfy(client.auth.bind(client))
    .then(() => promisfy(client.getDatasources.bind(client)))
    .then(res => res.results)
    .then((res) => {
      allDatasources = res;
      processDatasources(req, allDatasources);
    })
    .catch((error) => { throw error; });
}

function task(req, device, body, msg) {
  //  The task for this Google Cloud Function: Send the body of the
  //  Sigfox message to Ubidots by calling the Ubidots API.
  //  We match the Sigfox device ID with the datasources already defined
  //  in Ubidots, and match the Sigfox message fields with the Ubidots
  //  variables, and populate the values.  All datasources, variables
  //  must be created in advance.

  //  Load the Ubidots datasources if not done already.
  return init(req)
    //  Load the Ubidots variables for the device if not loaded already.
    .then(() => getVariablesByDevice(req, device))
    .then(() => {
      //  Find the datasource record for the Sigfox device.
      const dev = allDevices[device];
      if (!dev || !dev.datasource) return null;  //  No such device.

      //  Set the Ubidots timestamp.
      //  For each Sigfox message field, set the value of the Ubidots variable.
      const vars = dev.variables;
      for (const key of Object.keys(body)) {
        if (!vars[key]) continue;
        setVariable(req, device, key, body[key]);
      }
      // '{"value": "52.1", "timestamp": 1376056359000}'
      //  {"value": "35.8", "context": {"lat": 6.1, "lng": -35.1, "status": "driving"}}'
      return 'OK';
    })
    //  Return the message for the next processing step.
    .then(() => msg)
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


// .then(() => getVariablesByDevice(req, '2C30EB'))
// .then(() => setVariable(req, '2C30EB', 'lig', 321))
/*
function debug(res) {
  //  Debug the result of a promise.  Return the same promise to the next in chain.
  console.log(JSON.stringify({ res }, null, 2));
  debugger;
  return res;
}
 */
/* Not used: Replicates the datasource already loaded.
function getDetails(req, device) {
  //  Fetch the Ubidots details for the specified Sigfox device ID.
  //  Returns a promise.
  const dev = allDevices[device];
  if (!dev || !dev.datasource) {
    return Promise.resolve(null);  //  No such device.
  }
  if (dev && dev.details) {
    return Promise.resolve(dev.details);  //  Return cached details.
  }
  //  Given the datasource, read the details from Ubidots.
  const datasourceId = dev.datasource.id;
  const datasource = client.getDatasource(datasourceId);
  return promisfy(datasource.getDetails.bind(datasource))
    .then((res) => { dev.details = res; return res; })
    .catch((error) => { throw error; });
} */
