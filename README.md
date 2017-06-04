**sigfox-gcloud-ubidots** is a `sigfox-gcloud` adapter for integrating Sigfox devices with Ubidots.
`sigfox-gcloud` is a software framework for building a
Sigfox server with Google Cloud Functions and Google Cloud PubSub 
message queues

# Getting Started

Download this source folder to your computer.  For development
   we support Linux, MacOS and [Ubuntu on Windows 10](https://msdn.microsoft.com/en-us/commandline/wsl/about).

```bash
git clone https://github.com/UnaBiz/sigfox-gcloud-ubidots.git
cd sigfox-gcloud-ubidots
```

Create a file named `config.json` in the `sigfox-gcloud-ubidots` folder with the contents below (replace `YOUR_UBIDOTS_API_KEY` by your Ubidots API Key)

```json
{
  "comment": "Configuration file for Ubidots adapter for sigfox-gcloud",
  "ubidots-api-key": "YOUR_UBIDOTS_API_KEY"
}
```

### Setting up Google Cloud

1.  Install `sigfox-gcloud` with the base modules (exclude optional modules):

    https://github.com/UnaBiz/sigfox-gcloud/blob/master/README.md

1.  Add the following `sigfox-route` setting to the Google Cloud Project Metadata store.
    This route says that all received Sigfox messages will be processed by the
    two steps `decodeStructuredMessage` and `sendToUbidots`.

    ```bash
    gcloud compute project-info add-metadata --metadata=^:^sigfox-route=decodeStructuredMessage,sendToUbidots
    ```

1. Create the Google PubSub message queues that we will use to route the
   Sigfox messages between the Cloud Functions:
   
    ```bash
    gcloud beta pubsub topics create sigfox.types.sendToUbidots
    ```
    
    The PubSub queues will be used as follows:
    - `sigfox.devices.sendToUbidots`: The queue that will receive Sigfox messages for all devices
        and will be sent to Ubidots    
    
1. Deploy all the included Cloud Functions (including the demo functions) with the `deployall.sh` script:

    ```bash
    chmod +x */*.sh
    scripts/deployall.sh
    ```

1.  How it works:

    - Sigfox messages are pushed by the Sigfox Cloud to the Google Cloud Function
    [`sigfoxCallback`](https://github.com/UnaBiz/sigfox-gcloud/tree/master/sigfoxCallback)          
    
    - Cloud Function `sigfoxCallback` delivers the message to PubSub message queue
      `sigfox.devices.all`, as well as to the device ID and device type queues
    
    - Cloud Function 
      [`routeMessage`](https://github.com/UnaBiz/sigfox-gcloud/tree/master/routeMessage)
      listens to PubSub message queue 
      `sigfox.devices.all` and picks up the new message
    
    - Cloud Function `routeMessage` assigns a route to the 
      Sigfox message by reading the `sigfox-route` from the Google Compute Metadata Store. 
      The route looks like this: 

      ```
      decodeStructuredMessage, sendToUbidots
      ```

    - This route sends the message to functions `decodeStructuredMessage` and `sendToUbidots`
      via the queues `sigfox.types.decodeStructuredMessage` and `sigfox.types.sendToUbidots`
      
    - `decodeStructuredMessage`decodes the structured fields in the Sigfox message,
        e.g. `ctr`, `lig`, `tmp`
     
    - `sendToUbidots` sends the message to Ubidots by calling the Ubidots API.  It assumes that the Ubidots
        device is named after the Sigfox device ID, e.g. `Sigfox Device 2C30EB`.  (Last 6 characters must be
        the Sigfox device ID.)
        
    - Each device / datasource must have defined the same fields as those in the structured message
        e.g. `ctr`, `lig`, `tmp`

1.  See this for the definition of structured messages:

    https://github.com/UnaBiz/unabiz-arduino/wiki/UnaShield

### Testing the Sigfox server

1.  Send some Sigfox messages from the Sigfox devices. Monitor the progress
    of the processing through the 
    [Google Cloud Logging Console.](https://console.cloud.google.com/logs/viewer?resource=cloud_function&minLogLevel=0&expandAll=false)  
    Select **"Cloud Function"** as the **"Resource"**
        
    [<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/gcloud-log.png" width="1024"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/gcloud-log.png)
        
1.  Processing errors will be reported to the 
    [Google Cloud Error Reporting Console.](https://console.cloud.google.com/errors?time=P1D&filter&order=COUNT_DESC)
            
    [<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/gcloud-error-reporting.png" width="1024"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/gcloud-error-reporting.png)
    
1.  We may configure 
    [Google Cloud Stackdriver Monitoring](https://app.google.stackdriver.com/services/cloud_pubsub/topics) 
    to create incident
    reports upon detecting any errors.  Stackdriver may also be used to
    generate dashboards for monitoring the PubSub message processing queues.       
    
    [<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/gcloud-stackdriver.png" width="1024"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/gcloud-stackdriver.png)

#  Demo    

1. To send messages from a Sigfox device into Ubidots, you may use this Arduino sketch:

    https://github.com/UnaBiz/unabiz-arduino/blob/master/examples/send-light-level/send-light-level.ino
    
    The sketch sends 3 field names and field values, packed into a single structured message:
        
    ```
    ctr (counter)
    lig (light level)
    tmp (temperature)        
    ```
    
1. Alternatively, you may test by sending a Sigfox message
    from your Sigfox device with the `data` field set to:

    ```
    920e82002731b01db0512201
    ```
   
   We may also use a URL testing tool like Postman to send a POST request to the `sigfoxCallback` URL e.g.
      
   `https://us-central1-myproject.cloudfunctions.net/sigfoxCallback`

   Set the `Content-Type` header to `application/json`. 
   If you're using Postman, click `Body` -> `Raw` -> `JSON (application/json)`
   Set the body to:
   
    ```json
    {
      "device":"1A2345",
      "data":"920e82002731b01db0512201",
      "time":"1476980426",
      "duplicate":"false",
      "snr":"18.86",
      "station":"0000",
      "avgSnr":"15.54",
      "lat":"1",
      "lng":"104",
      "rssi":"-123.00",
      "seqNumber":"1492",
      "ack":"false",
      "longPolling":"false"
    }
    ```
    where `device` is your device ID.
    
    Here's the request in Postman:
    
     [<kbd><img src="https://storage.googleapis.com/unabiz-media/sigfox-gcloud/postman-callback.png" width="1024"></kbd>](https://storage.googleapis.com/unabiz-media/sigfox-gcloud/postman-callback.png)
     
    We may use the `curl` command as well.  Remember to change `myproject` and `1A2345`
    to your project ID and device ID.

    ```bash
    curl --request POST \
      --url https://us-central1-myproject.cloudfunctions.net/sigfoxCallback \
      --header 'cache-control: no-cache' \
      --header 'content-type: application/json' \
      --data '{"device":"1A2345", "data":"920e82002731b01db0512201", "time":"1476980426", "duplicate":"false", "snr":"18.86", "station":"0000", "avgSnr":"15.54", "lat":"1", "lng":"104", "rssi":"-123.00", "seqNumber":"1492", "ack":"false", "longPolling":"false"}'
    ```
    
1.  The response from the callback function should look like this:
    
    ```json
    {
      "1A2345": {
        "noData": true
      }
    }
    ```
           
1. The test message sent above will be decoded and sent to Ubidots as 

    ```
    ctr (counter): 13
    lig (light level): 760
    tmp (temperature): 29        
    ```
