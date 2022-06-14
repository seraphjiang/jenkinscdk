# Introduction

This is a CDK repository for build a Jenkins in AWS.

## Environments
All scripts have been verified with the following environments

AWS CDK Version: 1.127.0
NodeJS: v14.18.1

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

1. Make sure you have an AWS account.
2. Make sure you have a hostedzone to be use to setup dns.
3. Find a AMI for jenkins master (Search for community one of create your own AMI).
4. Setup lib/config.ts accordingly. Choose a valid existing key pair to use. Otherwise, the vms are not accessable.
5. Create lib/pvre-reporting-template.yml file, and copy the template content from [SSM Onboarding Wiki](https://w.amazon.com/bin/view/SystemsManager/InternalUse/Onboarding/). Most likely, you will need to update the tag configuration in the template.

```
export const config = {
  "account": "123456789012",
  "region": "us-west-2",
  "az":"us-west-2a",
  "hostedZone": "mydomain.com",
  "ami": "ami-0000111122223333e",
  "keyPair": "your-key",
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

## Free AMIs

version:2.258

user/password:admin/admin

* us-east-1:ami-0474ca24b9eb4c54e
* us-east-2:ami-086c758d14f5d6838
* us-west-1:ami-0fca6ea13117f12a4
* us-west-2:ami-04d27f19c95564d70


![visitors](https://visitor-badge.laobi.icu/badge?page_id=seraphjiang.jenkinscdk)
