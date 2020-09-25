#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { JenkinscdkStack } from '../lib/jenkinscdk-stack';
import { config } from '../lib/config';

const app = new cdk.App();
new JenkinscdkStack(app, 'JenkinscdkStack', {
  env: config
});
