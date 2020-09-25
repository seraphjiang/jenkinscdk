import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Jenkinscdk from '../lib/jenkinscdk-stack';

test('dns cert Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new Jenkinscdk.JenkinscdkStack(app, 'MyTestStack', {
    env: {
      "account": "123456789012",
      "region": "us-west-2",
      "hostedZone": "mydomain.com"
    }
  });
  // THEN
  expectCDK(stack).to(haveResource("AWS::CloudFormation::CustomResource", {
    DomainName: "mydomain.com"
  }));
});
