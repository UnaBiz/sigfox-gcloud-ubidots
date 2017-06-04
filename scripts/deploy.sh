#!/bin/bash

name=sendToUbidots
localpath=.
trigger=--trigger-topic
topic=sigfox.types.${name}

./scripts/functiondeploy.sh ${name}   ${localpath} ${trigger} ${topic}
