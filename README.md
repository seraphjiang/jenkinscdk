# Introduction

This is a CDK repository for build a Jenkins in AWS.

## CDK

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## Prerequisite to deploy

1. make sure you have an AWS account
2. make sure you have a hostedzone to be use to setup dns
3. Find a AMI for jenkins master (Search for community one of create your own AMI)
4. Setup lib/config.ts accordingly

```
export const config = {
  "account": "123456789012",
  "region": "us-west-2",
  "az":"us-west-2a",
  "hostedZone": "mydomain.com",
  "ami": "ami-0000111122223333e"
};

```

## Deployment

```
# build for each change
npm run build 

# bootstrap cdk environment on aws account
cdk bootstrap aws://123456789012/us-west-2

# Deploy
cdk deploy
```